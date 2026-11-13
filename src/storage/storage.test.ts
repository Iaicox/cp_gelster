import 'fake-indexeddb/auto';
import { createStore, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import type { KpEdits, Project } from '../../shared/schema.ts';
import {
  applyImport,
  exportAllProjects,
  exportFileName,
  exportProject,
  findConflicts,
  ImportError,
  parseExportFile,
  serializeExport,
} from './exportFile.ts';
import { newId } from './id.ts';
import { clearImages, getImage, listImageKeys, saveImage, signatureKey, toDataUrl, fromDataUrl } from './images.ts';
import {
  clearProjects,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  migrateProject,
  saveProject,
} from './projects.ts';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 250, 255]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7]);

async function bytesOf(blob: Blob | null): Promise<number[]> {
  expect(blob).not.toBeNull();
  return [...new Uint8Array(await (blob as Blob).arrayBuffer())];
}

function makeProject(client: string, extra: Partial<Project> = {}): Project {
  const project = createProject();
  return {
    ...project,
    form: { ...project.form, client, managerId: 'm1', managerName: 'Иван' },
    ...extra,
  };
}

function withImages(client: string): Project {
  return makeProject(client, {
    collection: {
      sourceUrl: 'https://gelster.ru/c',
      site: 'gelster',
      fetchedAt: '2026-11-12T00:00:00Z',
      name: 'Coll',
      flooringKind: '',
      manufacturer: '',
      descriptionHtml: '',
      mainImage: 'https://gelster.ru/main.png',
      articles: [],
      features: [],
      warnings: [],
    },
    kp: {
      date: null,
      title: null,
      greeting: null,
      intro: null,
      collectionHeading: null,
      descriptionHtml: '<p>x</p>',
      selectedArticles: [{ code: 'A1', image: 'https://gelster.ru/a1.jpg', caption: 'A1' }],
      featuresTitle: 'Характеристики',
      features: [],
      comments: [],
      mainImageHidden: false,
      paletteText: null,
      paletteHidden: false,
    },
  });
}

/** A project as it was stored before the fields of docs/spec.md, section 8.1 existed. */
function withoutNewKpFields(project: Project): unknown {
  if (!project.kp) throw new Error('fixture');
  const kp: Partial<KpEdits> = { ...project.kp };
  delete kp.mainImageHidden;
  delete kp.paletteText;
  delete kp.paletteHidden;
  return { ...project, kp };
}

beforeEach(async () => {
  await clearProjects();
  await clearImages();
});

describe('ids', () => {
  it('are 32 hex chars and unique, without crypto.randomUUID', () => {
    const ids = new Set(Array.from({ length: 200 }, newId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('projects store', () => {
  it('saves, reads, lists newest first and deletes', async () => {
    const a = { ...makeProject('Альфа'), updatedAt: '2026-11-01T00:00:00.000Z' };
    const b = { ...makeProject('Бета'), updatedAt: '2026-11-02T00:00:00.000Z' };
    await saveProject(a);
    await saveProject(b);
    expect(await getProject(a.id)).toEqual(a);
    expect((await listProjects()).map((p) => p.form.client)).toEqual(['Бета', 'Альфа']);
    await deleteProject(a.id);
    expect(await getProject(a.id)).toBeNull();
    expect(await listProjects()).toHaveLength(1);
  });

  it('refuses to save an invalid project', async () => {
    const bad = { ...makeProject('x'), version: 2 } as unknown as Project;
    await expect(saveProject(bad)).rejects.toThrow();
  });

  it('migrateProject rejects unknown and future versions', () => {
    expect(migrateProject(makeProject('x'))).not.toBeNull();
    expect(migrateProject({ ...makeProject('x'), version: 2 })).toBeNull();
    expect(migrateProject({ id: 'x' })).toBeNull();
    expect(migrateProject(null)).toBeNull();
  });
});

describe('records saved before the palette and photo flags', () => {
  it('a stored project without the new kp fields opens with their defaults and saves again', async () => {
    const old = withImages('Старый');
    await set(old.id, withoutNewKpFields(old), createStore('gelster-kp-projects', 'projects'));
    const read = await getProject(old.id);
    expect(read?.kp).toMatchObject({ mainImageHidden: false, paletteText: null, paletteHidden: false });
    expect(read).toEqual(old);
    if (read) await saveProject(read);
    expect(await getProject(old.id)).toEqual(old);
  });

  it('an old export file without the new kp fields is imported', () => {
    const old = withImages('Старый');
    const text = JSON.stringify({
      format: 'gelster-kp',
      version: 1,
      exportedAt: '2026-11-01T00:00:00.000Z',
      projects: [withoutNewKpFields(old)],
      images: {},
    });
    const parsed = parseExportFile(text);
    expect(parsed.file.projects).toEqual([old]);
  });
});

describe('images store', () => {
  it('keeps bytes and type by URL', async () => {
    await saveImage('https://gelster.ru/a.png', new Blob([PNG], { type: 'image/png' }));
    const blob = await getImage('https://gelster.ru/a.png');
    expect(blob?.type).toBe('image/png');
    expect(await bytesOf(blob)).toEqual([...PNG]);
    expect(await getImage('https://gelster.ru/none.png')).toBeNull();
  });

  it('data: URL round trip', () => {
    const url = toDataUrl({ type: 'image/png', bytes: PNG.slice().buffer });
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    const back = fromDataUrl(url);
    expect(back?.type).toBe('image/png');
    expect([...new Uint8Array(back?.bytes ?? new ArrayBuffer(0))]).toEqual([...PNG]);
    expect(fromDataUrl('data:image/png;base64,***')).toBeNull();
    expect(fromDataUrl('https://x')).toBeNull();
  });
});

describe('export and import', () => {
  it('export all → clear → import returns the same projects and images', async () => {
    const p1 = withImages('Альфа');
    const p2 = makeProject('Бета');
    await saveProject(p1);
    await saveProject(p2);
    await saveImage('https://gelster.ru/main.png', new Blob([PNG], { type: 'image/png' }));
    await saveImage('https://gelster.ru/a1.jpg', new Blob([JPG], { type: 'image/jpeg' }));
    await saveImage(signatureKey('m1'), new Blob([JPG], { type: 'image/jpeg' }));
    await saveImage('https://gelster.ru/unused.png', new Blob([PNG], { type: 'image/png' }));

    const file = await exportAllProjects();
    expect(file.format).toBe('gelster-kp');
    expect(file.version).toBe(1);
    expect(Object.keys(file.images).sort()).toEqual(
      ['https://gelster.ru/a1.jpg', 'https://gelster.ru/main.png', signatureKey('m1')].sort(),
    );
    const text = serializeExport(file);

    await clearProjects();
    await clearImages();

    const parsed = parseExportFile(text);
    expect(await findConflicts(parsed)).toEqual([]);
    const result = await applyImport(parsed);
    expect(result).toMatchObject({ added: 2, replaced: 0, copied: 0, skipped: 0 });

    const restored = await listProjects();
    expect(restored.map((p) => p.id).sort()).toEqual([p1.id, p2.id].sort());
    expect(await getProject(p1.id)).toEqual(p1);
    expect(await getProject(p2.id)).toEqual(p2);
    expect(await bytesOf(await getImage('https://gelster.ru/main.png'))).toEqual([...PNG]);
    expect((await getImage('https://gelster.ru/a1.jpg'))?.type).toBe('image/jpeg');
    expect(await bytesOf(await getImage(signatureKey('m1')))).toEqual([...JPG]);
    expect(await listImageKeys()).not.toContain('https://gelster.ru/unused.png');
  });

  it('exports one project with its images only', async () => {
    const p1 = withImages('Альфа');
    await saveProject(p1);
    await saveProject(makeProject('Бета'));
    await saveImage('https://gelster.ru/main.png', new Blob([PNG], { type: 'image/png' }));
    const file = await exportProject(p1.id);
    expect(file.projects.map((p) => p.id)).toEqual([p1.id]);
    expect(Object.keys(file.images)).toEqual(['https://gelster.ru/main.png']);
    expect(exportFileName(file, true)).toMatch(/^gelster-kp_Альфа_\d{4}-\d\d-\d\d\.json$/);
  });

  it('conflicting id: replace, copy or skip', async () => {
    const original = makeProject('Старое');
    await saveProject(original);
    const changed = { ...original, form: { ...original.form, client: 'Новое' } };
    const fresh = makeProject('Ещё');
    const text = serializeExport({
      format: 'gelster-kp',
      version: 1,
      exportedAt: '2026-11-12T00:00:00Z',
      projects: [changed, fresh],
      images: {},
    });
    const parsed = parseExportFile(text);
    expect((await findConflicts(parsed)).map((p) => p.id)).toEqual([original.id]);

    // No choice → the existing project is not touched.
    expect(await applyImport(parsed)).toMatchObject({ added: 1, skipped: 1 });
    expect((await getProject(original.id))?.form.client).toBe('Старое');

    expect(await applyImport(parseExportFile(text), { [original.id]: 'copy', [fresh.id]: 'skip' })).toMatchObject({
      copied: 1,
      skipped: 1,
    });
    const clients = (await listProjects()).map((p) => p.form.client).sort();
    expect(clients).toEqual(['Ещё', 'Новое (копия)', 'Старое']);

    expect(await applyImport(parseExportFile(text), { [original.id]: 'replace' })).toMatchObject({ replaced: 1 });
    expect((await getProject(original.id))?.form.client).toBe('Новое');
    expect(await listProjects()).toHaveLength(3);
  });

  it.each([
    ['not JSON', '{"format": "gelster-kp", ', /не JSON/],
    ['other JSON', '{"hello": 1}', /не файл экспорта/],
    ['future version', '{"format":"gelster-kp","version":9,"exportedAt":"","projects":[],"images":{}}', /новой версией/],
    [
      'broken project',
      '{"format":"gelster-kp","version":1,"exportedAt":"x","projects":[{"id":"a","version":1}],"images":{}}',
      /повреждён \(поле projects\.0/,
    ],
    [
      'broken image',
      '{"format":"gelster-kp","version":1,"exportedAt":"x","projects":[],"images":{"u":"data:image/png;base64,%%"}}',
      /Картинка u/,
    ],
  ])('broken file (%s): clear error, data unchanged', async (_name, text, message) => {
    const keep = makeProject('Не трогать');
    await saveProject(keep);
    await saveImage('k', new Blob([PNG], { type: 'image/png' }));
    expect(() => parseExportFile(text)).toThrow(ImportError);
    expect(() => parseExportFile(text)).toThrow(message);
    expect(await listProjects()).toEqual([keep]);
    expect(await listImageKeys()).toEqual(['k']);
  });
});
