/**
 * Projects in IndexedDB (idb-keyval, database `gelster-kp-projects`, key = project id).
 * Every record is checked by ProjectSchema on the way in and out; records of an older `version` go through
 * migrateProject() first. Only this module touches the projects database (docs/context/stack.md).
 */
import { clear, createStore, del, get, set, values, type UseStore } from 'idb-keyval';
import { ProjectSchema, type Item, type Project, type ProjectForm } from '../../shared/schema.ts';
import { newId } from './id.ts';

export const PROJECT_VERSION = 1;

let store: UseStore | null = null;
/** Opened lazily: idb-keyval opens the database as soon as the store is created. */
function projectsStore(): UseStore {
  store ??= createStore('gelster-kp-projects', 'projects');
  return store;
}

/**
 * Upgrades a stored or imported project to the current format and validates it; null when it is unusable.
 * Add a step here for every format change: `if (version === 1) raw = from1to2(raw)` and so on.
 */
export function migrateProject(raw: unknown): Project | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const version = (raw as { version?: unknown }).version;
  if (typeof version !== 'number' || version > PROJECT_VERSION) return null;
  // No older versions exist yet: version 1 is the first format.
  const parsed = ProjectSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function newItem(unit: Item['unit'] = 'м²'): Item {
  return { id: newId(), name: '', qty: null, unit, priceRub: null };
}

export function emptyForm(): ProjectForm {
  return {
    managerId: '',
    managerName: '',
    client: '',
    clientName: '',
    clientSex: 'm',
    link: '',
    euroRate: null,
    mainCurrency: 'rub',
    extraCurrency: 'rub',
    mainItems: [newItem()],
    extraItems: [newItem()],
    delivery: { mode: 'default', custom: [''] },
  };
}

/** A new project in memory (not saved yet). */
export function createProject(): Project {
  return {
    id: newId(),
    version: PROJECT_VERSION,
    updatedAt: new Date().toISOString(),
    form: emptyForm(),
    collection: null,
    kp: null,
  };
}

/** All readable projects, most recently changed first. Broken records are skipped with a console warning. */
export async function listProjects(): Promise<Project[]> {
  const raw = await values<unknown>(projectsStore());
  const projects: Project[] = [];
  for (const record of raw) {
    const project = migrateProject(record);
    if (project) projects.push(project);
    else console.warn('Проект в IndexedDB не читается и пропущен', record);
  }
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string): Promise<Project | null> {
  return migrateProject(await get<unknown>(id, projectsStore()));
}

/** Validates and stores the project as is (the caller sets updatedAt). */
export async function saveProject(project: Project): Promise<void> {
  const valid = ProjectSchema.parse(project);
  await set(valid.id, valid, projectsStore());
}

export async function deleteProject(id: string): Promise<void> {
  await del(id, projectsStore());
}

export async function clearProjects(): Promise<void> {
  await clear(projectsStore());
}

/* The project open in the form survives a page reload; one small key, so localStorage is enough. */
const CURRENT_KEY = 'gelster-kp:current-project';

export function getCurrentProjectId(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function setCurrentProjectId(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(CURRENT_KEY);
    else localStorage.setItem(CURRENT_KEY, id);
  } catch {
    // storage disabled: the form opens the latest project instead
  }
}
