import type { Article, FeatureCell, FeatureRow } from '../schema.ts';
import { sanitizeHtml, textOf } from './sanitize.ts';

/** What a site adapter extracts; parseCollection() adds the source, the date and the warnings for empty fields. */
export type ParsedPage = {
  name: string;
  flooringKind: string;
  manufacturer: string;
  descriptionHtml: string;
  mainImage: string | null;
  articles: Article[];
  features: FeatureRow[];
  /** Adapter-specific notes (field-level warnings are added by parseCollection). */
  warnings: string[];
};

/** Absolute URL of `src` relative to the final page address; null for empty or unparsable values. */
export function absoluteUrl(src: string | null | undefined, baseUrl: string): string | null {
  const value = src?.trim();
  if (!value) return null;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

function span(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 1 ? parsed : undefined;
}

/** A table cell → FeatureCell with sanitized HTML; span attributes are kept only when > 1. */
export function featureCell(cell: Element, baseUrl: string): FeatureCell {
  const result: FeatureCell = { html: sanitizeHtml(cell.innerHTML, baseUrl) };
  const colSpan = span(cell.getAttribute('colspan'));
  const rowSpan = span(cell.getAttribute('rowspan'));
  if (colSpan) result.colSpan = colSpan;
  if (rowSpan) result.rowSpan = rowSpan;
  if (cell.tagName === 'TH') result.header = true;
  return result;
}

/** A `<tr>` → FeatureRow; null when every cell is empty. */
export function featureRow(row: Element, baseUrl: string): FeatureRow | null {
  const cells = Array.from(row.children)
    .filter((cell) => cell.tagName === 'TD' || cell.tagName === 'TH')
    .map((cell) => featureCell(cell, baseUrl));
  return cells.some((cell) => cell.html !== '') ? { cells } : null;
}

/** «MARMOLEUM COCOA» / «marmoleum cocoa» → «Marmoleum Cocoa»; mixed-case names are kept as written. */
export function normalizeName(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text !== text.toLowerCase() && text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|[\s(«"-])(\p{L})/gu, (_m, before: string, letter: string) => before + letter.toUpperCase());
}

/** Text of the breadcrumb items (any element whose class mentions «breadcr»/«breadcrumb»). */
export function breadcrumbs(doc: Document): string[] {
  const list = doc.querySelector('[class*="breadcr"], nav[aria-label*="bread" i]');
  if (!list) return [];
  return Array.from(list.querySelectorAll('li')).map((item) => textOf(item)).filter((text) => text !== '');
}
