import type { Collection, Site } from '../schema.ts';
import type { ParsedPage } from './common.ts';
import { parseGelster } from './gelster.ts';
import { parseOoogelingen } from './ooogelingen.ts';

export { decodeHtml } from './decode.ts';
export { parseRates } from './rates.ts';
export { ALLOWED_TAGS, sanitizeHtml } from './sanitize.ts';

/** Hosts the KP generator understands (and the PHP proxy allows). */
export const SITE_BY_HOST: Readonly<Record<string, Site>> = {
  'gelster.ru': 'gelster',
  'www.gelster.ru': 'gelster',
  'ooogelingen.ru': 'ooogelingen',
  'www.ooogelingen.ru': 'ooogelingen',
};

/** Site of an https page address, or null for anything else. */
export function siteOf(url: string): Site | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    return SITE_BY_HOST[parsed.hostname.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

/** The page has neither a name, nor articles, nor a description. */
export class NotACollectionError extends Error {
  constructor() {
    super('Страница не похожа на коллекцию: не найдены ни название, ни артикулы, ни описание');
    this.name = 'NotACollectionError';
  }
}

const ADAPTERS: Record<Site, (doc: Document, url: string) => ParsedPage> = {
  gelster: parseGelster,
  ooogelingen: parseOoogelingen,
};

/** Field-level warnings: a missing field never stops parsing. */
function fieldWarnings(page: ParsedPage, site: Site): string[] {
  const warnings: string[] = [];
  if (!page.name) warnings.push('Не найдено название коллекции');
  if (!page.flooringKind) warnings.push('Не найден вид покрытия: заголовок КП составлен без него');
  if (!page.manufacturer) warnings.push('Не найден производитель: заголовок КП составлен без него');
  if (!page.descriptionHtml) warnings.push('Не найдено описание коллекции');
  // gelster.ru has no main photo by design (docs/spec.md, section 7).
  if (!page.mainImage && site !== 'gelster') warnings.push('Не найдено главное фото');
  if (page.articles.length === 0) warnings.push('Не найдены артикулы');
  if (page.features.length === 0) warnings.push('Не найдены технические характеристики');
  return warnings;
}

/**
 * Parses a collection page of gelster.ru or ooogelingen.ru. `url` is the final address of the page (X-Final-Url):
 * every image and link URL is made absolute against it. Runs on an inert DOMParser document: scripts do not run,
 * images do not load; only sanitized strings leave this function.
 */
export function parseCollection(html: string, url: string, fetchedAt: string = new Date().toISOString()): Collection {
  const site = siteOf(url);
  if (!site) throw new Error('Поддерживаются только страницы https://gelster.ru и https://ooogelingen.ru');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const page = ADAPTERS[site](doc, url);
  if (!page.name && page.articles.length === 0 && !page.descriptionHtml) throw new NotACollectionError();
  return {
    sourceUrl: url,
    site,
    fetchedAt,
    name: page.name,
    flooringKind: page.flooringKind,
    manufacturer: page.manufacturer,
    descriptionHtml: page.descriptionHtml,
    mainImage: page.mainImage,
    articles: page.articles,
    features: page.features,
    warnings: [...page.warnings, ...fieldWarnings(page, site)],
  };
}
