import type { Article, FeatureRow } from '../schema.ts';
import { absoluteUrl, featureRow, normalizeName, type ParsedPage } from './common.ts';
import { sanitizeHtml, textOf } from './sanitize.ts';

/**
 * Manufacturer from the path of an article image: `/Forbo/Marmoleum/Cocoa/3580.jpg` → «Forbo» (legacy logic).
 * Only a brand-like first segment (Latin word, starts with a capital) is accepted: `plintus_Dollken/...` is a folder
 * name, not a manufacturer.
 */
function manufacturerFromImage(image: string | undefined): string {
  if (!image) return '';
  const segment = new URL(image).pathname.split('/').filter(Boolean)[0] ?? '';
  return /^[A-Z][A-Za-z]+$/.test(segment) ? segment : '';
}

/** ooogelingen.ru: selectors of legacy/result.php, checked against the saved pages. */
export function parseOoogelingen(doc: Document, url: string): ParsedPage {
  const entryText = doc.querySelector('.entry-text');
  const entry = entryText?.parentElement ?? null;
  const heading = entry?.querySelector(':scope > h1') ?? doc.querySelector('h1');
  // The kind is the h2 next to h1 in the description block (the legacy index h2[1] skipped a sidebar h2).
  const kindHeading = heading?.parentElement?.querySelector(':scope > h2') ?? null;

  let descriptionHtml = '';
  if (entryText) {
    const next = entryText.nextElementSibling;
    const hidden = next?.classList.contains('collapse') ? next : doc.querySelector('#collapseExample');
    descriptionHtml = sanitizeHtml(entryText.innerHTML + (hidden?.innerHTML ?? ''), url);
  }

  const articles: Article[] = [];
  for (const item of Array.from(doc.querySelectorAll('.collection-container .col-auto'))) {
    const image = absoluteUrl(item.querySelector('img')?.getAttribute('src'), url);
    const code = textOf(item.querySelector('span'));
    if (image && code) articles.push({ code, image });
  }

  const features: FeatureRow[] = [];
  const rows = Array.from(doc.querySelector('.caracter-table')?.querySelectorAll('tr') ?? []);
  // The first row is the «Характеристики …» caption (the legacy code removed it too).
  if (rows[0]?.querySelector('th')) rows.shift();
  for (const row of rows) {
    const parsed = featureRow(row, url);
    if (parsed) features.push(parsed);
  }

  return {
    name: normalizeName(textOf(heading)),
    flooringKind: textOf(kindHeading),
    manufacturer: manufacturerFromImage(articles[0]?.image),
    descriptionHtml,
    mainImage: absoluteUrl(doc.querySelector('.entry-photo img')?.getAttribute('src'), url),
    articles,
    features,
    warnings: [],
  };
}
