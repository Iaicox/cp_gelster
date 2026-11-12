import type { Rates } from '../schema.ts';

function parseNumber(text: string | null | undefined): number {
  return Number((text ?? '').trim().replace(/\s/g, '').replace(',', '.'));
}

function rateOf(doc: Document, charCode: string): number {
  const valute = Array.from(doc.getElementsByTagName('Valute')).find(
    (node) => node.getElementsByTagName('CharCode')[0]?.textContent?.trim() === charCode,
  );
  if (!valute) throw new Error(`В ответе ЦБ нет курса ${charCode}`);
  const value = parseNumber(valute.getElementsByTagName('Value')[0]?.textContent);
  const nominalText = valute.getElementsByTagName('Nominal')[0]?.textContent;
  const nominal = nominalText ? parseNumber(nominalText) : 1;
  const rate = value / nominal;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Курс ${charCode} в ответе ЦБ не распознан`);
  return Math.round(rate * 10000) / 10000;
}

/** `12.11.2026` → `2026-11-12`; anything else is returned as is. */
function isoDate(cbrDate: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(cbrDate.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : cbrDate.trim();
}

/**
 * Parses https://www.cbr.ru/scripts/XML_daily.asp (windows-1251): roubles per 1 EUR / USD, taking `Nominal` and the
 * decimal comma into account. Throws an Error with a Russian message when the XML is broken or a rate is missing.
 */
export function parseRates(bytes: ArrayBuffer | Uint8Array): Rates {
  const xml = new TextDecoder('windows-1251').decode(bytes);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (doc.getElementsByTagName('parsererror').length > 0 || root.nodeName !== 'ValCurs') {
    throw new Error('Ответ ЦБ не похож на курсы валют');
  }
  return { eur: rateOf(doc, 'EUR'), usd: rateOf(doc, 'USD'), date: isoDate(root.getAttribute('Date') ?? '') };
}
