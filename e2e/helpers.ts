/** Shared pieces of the end-to-end tests: fixtures instead of the network, seeding of IndexedDB, PDF reading. */
import { readFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const SITE_FIXTURES = 'shared/parsers/__fixtures__/'; // Playwright runs from the repository root

/** Collection pages the fake proxy knows: requested URL → saved page. */
const PAGES: Record<string, string> = {
  'https://ooogelingen.ru/m_cocoa.htm': 'ooogelingen.ru/m_cocoa.htm',
  'https://ooogelingen.ru/coral_classic.htm': 'ooogelingen.ru/coral_classic.htm',
};

export const MANAGERS = [
  { id: 'michael_smu', name: 'Михаил Смущенко', signature: 'api/data/signatures/michael_smu.jpg' },
  { id: 'ivan_loginov', name: 'Иван Логинов', signature: 'api/data/signatures/ivan_loginov.jpg' },
];

export function projectFixture(): Record<string, unknown> & { id: string; form: Record<string, unknown> } {
  return JSON.parse(readFileSync('e2e/fixtures/project.json', 'utf8'));
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** A one-colour PNG: stands in for photos of the sites. */
export function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bit, RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3)]);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const SWATCHES: [number, number, number][] = [
  [74, 58, 52], [168, 170, 166], [212, 204, 170], [120, 98, 80], [96, 104, 110], [186, 160, 120],
];

export type Network = { pageRequests: string[]; imageRequests: string[] };

/**
 * Replaces the whole network: the PHP API answers from fixtures, anything outside the dev server is refused.
 * `managers` is what api/managers.php returns.
 */
export async function mockNetwork(page: Page, managers: unknown[] = MANAGERS): Promise<Network> {
  const seen: Network = { pageRequests: [], imageRequests: [] };
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.protocol === 'blob:' || url.protocol === 'data:') return route.continue();
    return route.abort('blockedbyclient'); // no live network in tests
  });
  await page.route('**/api/managers.php', (route) => route.fulfill({ json: managers }));
  await page.route('**/api/data/signatures/*', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    return route.fulfill({ path: `api/seed/signatures/${name}`, contentType: 'image/jpeg' });
  });
  await page.route('**/api/fetch.php?*', (route) => {
    const query = new URL(route.request().url()).searchParams;
    const target = query.get('url') ?? '';
    if (query.get('kind') === 'page') {
      seen.pageRequests.push(target);
      const file = PAGES[target];
      if (!file) return route.fulfill({ status: 502, json: { error: 'Сайт недоступен' } });
      return route.fulfill({
        body: readFileSync(SITE_FIXTURES + file),
        contentType: 'text/html; charset=utf-8',
        headers: { 'X-Final-Url': target },
      });
    }
    seen.imageRequests.push(target);
    const index = seen.imageRequests.length;
    // The main photo is a tall picture, articles are square swatches.
    const isArticle = /collection|art|item|\d{3,}/i.test(target.split('/').pop() ?? '');
    const colour = SWATCHES[index % SWATCHES.length] ?? [128, 128, 128];
    return route.fulfill({
      body: isArticle ? solidPng(160, 160, colour) : solidPng(400, 480, [150, 140, 125]),
      contentType: 'image/png',
    });
  });
  return seen;
}

/** Opens the app on a page that touches no storage and writes records straight into IndexedDB. */
export async function seed(
  page: Page,
  projects: unknown[],
  images: { key: string; type: string; file: string }[] = [],
): Promise<void> {
  await page.goto('./#/e2e-seed');
  const imageRecords = images.map((image) => ({
    key: image.key,
    type: image.type,
    base64: readFileSync(image.file).toString('base64'),
  }));
  await page.evaluate(
    async ({ projects, imageRecords }) => {
      // Same databases and stores as idb-keyval's createStore() in src/storage.
      const put = (dbName: string, storeName: string, entries: [string, unknown][]) =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open(dbName);
          open.onupgradeneeded = () => open.result.createObjectStore(storeName);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const tx = open.result.transaction(storeName, 'readwrite');
            for (const [key, value] of entries) tx.objectStore(storeName).put(value, key);
            tx.oncomplete = () => {
              open.result.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        });
      await put(
        'gelster-kp-projects',
        'projects',
        (projects as { id: string }[]).map((project) => [project.id, project]),
      );
      await put(
        'gelster-kp-images',
        'images',
        imageRecords.map(({ key, type, base64 }) => {
          const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
          return [key, { type, bytes: bytes.buffer }];
        }),
      );
    },
    { projects, imageRecords },
  );
}

/** Opens the KP of a project and waits until the pages are laid out. */
export async function openKp(page: Page, id: string): Promise<number> {
  await page.goto(`./#/kp/${id}`);
  await page.locator('.kp-pages[data-ready="true"]').waitFor();
  return page.locator('.kp-pages .kp-page').count();
}

export type PdfInfo = { pages: { width: number; height: number; text: string }[]; text: string };

/** Page sizes (in points) and text of a PDF. */
export async function readPdf(bytes: Buffer): Promise<PdfInfo> {
  const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const pages: PdfInfo['pages'] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const pdfPage = await pdf.getPage(number);
    const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = pdfPage.view;
    const content = await pdfPage.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pages.push({ width: x1 - x0, height: y1 - y0, text });
  }
  await pdf.cleanup();
  return { pages, text: pages.map((p) => p.text).join('\n') };
}
