import type { Article, FeatureRow } from '../schema.ts';
import { absoluteUrl, breadcrumbs, featureCell, featureRow, normalizeName, type ParsedPage } from './common.ts';
import { sanitizeHtml, textOf } from './sanitize.ts';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Heading text without the collection name: «Натуральный линолеум<br>marmoleum cocoa» → «Натуральный линолеум». */
function withoutName(heading: Element, name: string): string {
  const text = textOf(heading);
  if (!name) return text;
  return text.replace(new RegExp(escapeRegExp(name), 'gi'), ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Kind of flooring: the first h2 that still has text once the collection name is removed (gelster puts
 * «<вид покрытия><br><название>» in `h2.description__title`), otherwise the second-to-last breadcrumb, otherwise ''.
 */
function flooringKind(doc: Document, name: string): string {
  const headings = [doc.querySelector('h2.description__title'), ...Array.from(doc.querySelectorAll('h2'))];
  for (const heading of headings) {
    const kind = heading ? withoutName(heading, name) : '';
    if (kind) return kind;
  }
  const crumbs = breadcrumbs(doc);
  return crumbs.length >= 2 ? (crumbs[crumbs.length - 2] ?? '') : '';
}

/** Description text plus the hidden «читать далее» part, without the toggle button. */
function description(doc: Document, url: string): string {
  const block = doc.querySelector('.description__text');
  if (!block) return '';
  const copy = block.cloneNode(true) as Element;
  for (const extra of Array.from(copy.querySelectorAll('.description__show, .white-shadow'))) extra.remove();
  return sanitizeHtml(copy.innerHTML, url);
}

/**
 * `table.attributes`: the head is transposed (a row of names, then a row of values) and becomes name/value pairs;
 * every body row is a name/value row already.
 */
function features(doc: Document, url: string): FeatureRow[] {
  const table = doc.querySelector('table.attributes');
  if (!table) return [];
  const rows: FeatureRow[] = [];
  const [names, values] = Array.from(table.querySelectorAll('thead tr')).map((row) =>
    Array.from(row.children).filter((cell) => cell.tagName === 'TD' || cell.tagName === 'TH'),
  );
  if (names && values && names.length === values.length) {
    names.forEach((cell, i) => {
      const value = values[i];
      if (value) rows.push({ cells: [featureCell(cell, url), featureCell(value, url)] });
    });
  } else {
    for (const row of Array.from(table.querySelectorAll('thead tr'))) {
      const parsed = featureRow(row, url);
      if (parsed) rows.push(parsed);
    }
  }
  for (const row of Array.from(table.querySelectorAll('tr')).filter((tr) => tr.parentElement?.tagName !== 'THEAD')) {
    const parsed = featureRow(row, url);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

function articles(doc: Document, url: string): Article[] {
  const result: Article[] = [];
  // Only the palette block: «к этому материалу вам понадобится» below repeats .article-item for other products.
  for (const item of Array.from(doc.querySelectorAll('#articles .article-item'))) {
    const image = absoluteUrl(item.querySelector('img.article-img')?.getAttribute('src'), url);
    const label = item.querySelector('.article-text');
    const titleNode = label?.querySelector('span');
    const title = textOf(titleNode);
    const code = textOf(label?.firstChild);
    if (!image || !code) continue;
    result.push(title ? { code, title, image } : { code, image });
  }
  return result;
}

/** gelster.ru: selectors derived from the saved pages (marmoleum_cocoa, coral-class, dollken_al). */
export function parseGelster(doc: Document, url: string): ParsedPage {
  const name = normalizeName(textOf(doc.querySelector('h1.name') ?? doc.querySelector('h1')));
  // No breadcrumbs on the current pages; when they appear, the manufacturer has to be picked there by hand.
  return {
    name,
    flooringKind: flooringKind(doc, name),
    manufacturer: '',
    descriptionHtml: description(doc, url),
    // gelster.ru has no main photo next to the description.
    mainImage: null,
    articles: articles(doc, url),
    features: features(doc, url),
    warnings: [],
  };
}
