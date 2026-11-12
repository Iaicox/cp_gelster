/**
 * Export and import of projects (docs/spec.md, sections 3.7 and 5): a JSON file of format ExportFile with the
 * projects and the images they use as data: URLs. Import validates the whole file before writing anything,
 * so a broken file never changes stored data.
 */
import { ExportFileSchema, type ExportFile, type Project } from '../../shared/schema.ts';
import { newId } from './id.ts';
import { fromDataUrl, getImagesAsDataUrls, putImages, signatureKey, type StoredImage } from './images.ts';
import { getProject, listProjects, migrateProject, saveProject } from './projects.ts';

export const EXPORT_FORMAT = 'gelster-kp';
export const EXPORT_VERSION = 1;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

/** Image keys a project uses: main photo, chosen articles, the manager's signature. */
export function projectImageKeys(project: Project): string[] {
  const keys: string[] = [];
  if (project.collection?.mainImage) keys.push(project.collection.mainImage);
  for (const article of project.kp?.selectedArticles ?? []) keys.push(article.image);
  if (project.form.managerId) keys.push(signatureKey(project.form.managerId));
  return keys;
}

export async function buildExport(projects: readonly Project[]): Promise<ExportFile> {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    projects: [...projects],
    images: await getImagesAsDataUrls(projects.flatMap(projectImageKeys)),
  };
}

export async function exportProject(id: string): Promise<ExportFile> {
  const project = await getProject(id);
  if (!project) throw new Error('Проект не найден');
  return buildExport([project]);
}

export async function exportAllProjects(): Promise<ExportFile> {
  return buildExport(await listProjects());
}

function datePart(iso: string): string {
  return iso.slice(0, 10);
}

/** File name: `gelster-kp_<company>_<date>.json` for one project, `gelster-kp_все_<date>.json` for all. */
export function exportFileName(file: ExportFile, single: boolean): string {
  const client = single ? (file.projects[0]?.form.client.trim() ?? '') : 'все';
  const safe = client.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'проект';
  return `gelster-kp_${safe}_${datePart(file.exportedAt)}.json`;
}

export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file);
}

/** Saves the file through a temporary link (works over plain http, no File System Access API). */
export function downloadExport(file: ExportFile, fileName: string): void {
  const url = URL.createObjectURL(new Blob([serializeExport(file)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ---- import ---- */

export type ParsedImport = {
  file: ExportFile;
  /** Decoded images, ready to be written. */
  images: Map<string, StoredImage>;
};

/**
 * Reads the text of an export file. Throws ImportError with a message for the user; touches nothing.
 * Older file versions are upgraded here (projects one by one through migrateProject).
 */
export function parseExportFile(text: string): ParsedImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('Файл повреждён или это не JSON: импорт отменён, данные не изменены.');
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== EXPORT_FORMAT) {
    throw new ImportError('Это не файл экспорта КП Gelster: импорт отменён, данные не изменены.');
  }
  const version = (raw as { version?: unknown }).version;
  if (typeof version !== 'number' || version > EXPORT_VERSION) {
    throw new ImportError('Файл создан более новой версией приложения: обновите приложение и повторите импорт.');
  }
  const rawProjects = (raw as { projects?: unknown }).projects;
  const migrated = Array.isArray(rawProjects) ? rawProjects.map((p) => migrateProject(p) ?? p) : rawProjects;
  const parsed = ExportFileSchema.safeParse({ ...raw, version: EXPORT_VERSION, projects: migrated });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue ? issue.path.join('.') : '';
    throw new ImportError(
      `Файл экспорта повреждён${where ? ` (поле ${where})` : ''}: импорт отменён, данные не изменены.`,
    );
  }
  const images = new Map<string, StoredImage>();
  for (const [key, url] of Object.entries(parsed.data.images)) {
    const image = fromDataUrl(url);
    if (!image) throw new ImportError(`Картинка ${key} в файле повреждена: импорт отменён, данные не изменены.`);
    images.set(key, image);
  }
  const ids = parsed.data.projects.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    throw new ImportError('В файле несколько проектов с одним id: импорт отменён, данные не изменены.');
  }
  return { file: parsed.data, images };
}

export type ConflictChoice = 'replace' | 'copy' | 'skip';

/** Projects from the file whose id already exists in this browser. */
export async function findConflicts(parsed: ParsedImport): Promise<Project[]> {
  const existing = new Set((await listProjects()).map((p) => p.id));
  return parsed.file.projects.filter((p) => existing.has(p.id));
}

export type ImportResult = { added: number; replaced: number; copied: number; skipped: number; ids: string[] };

/**
 * Writes the projects. A project whose id already exists needs a choice in `choices`; without one it is
 * skipped (nothing is replaced silently). A copy gets a new id and « (копия)» after the company name.
 */
export async function applyImport(
  parsed: ParsedImport,
  choices: Readonly<Record<string, ConflictChoice>> = {},
): Promise<ImportResult> {
  const existing = new Set((await listProjects()).map((p) => p.id));
  const result: ImportResult = { added: 0, replaced: 0, copied: 0, skipped: 0, ids: [] };
  const toSave: Project[] = [];
  for (const project of parsed.file.projects) {
    if (!existing.has(project.id)) {
      toSave.push(project);
      result.added++;
      continue;
    }
    const choice = choices[project.id] ?? 'skip';
    if (choice === 'skip') {
      result.skipped++;
    } else if (choice === 'replace') {
      toSave.push(project);
      result.replaced++;
    } else {
      const client = project.form.client.trim();
      toSave.push({ ...project, id: newId(), form: { ...project.form, client: client ? `${client} (копия)` : '(копия)' } });
      result.copied++;
    }
  }
  const neededKeys = new Set(toSave.flatMap(projectImageKeys));
  await putImages([...parsed.images].filter(([key]) => neededKeys.has(key)));
  for (const project of toSave) {
    await saveProject(project);
    result.ids.push(project.id);
  }
  return result;
}
