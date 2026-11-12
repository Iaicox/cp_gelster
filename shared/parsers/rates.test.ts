import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RatesSchema } from '../schema.ts';
import { parseRates } from './rates.ts';

const xmlBytes = readFileSync('shared/parsers/__fixtures__/cbr_XML_daily.xml'); // vitest runs from the repository root

function cbrXml(valutes: string, date = '01.02.2026'): Uint8Array {
  const xml = `<?xml version="1.0" encoding="windows-1251"?><ValCurs Date="${date}" name="Foreign Currency Market">${valutes}</ValCurs>`;
  return new TextEncoder().encode(xml); // ASCII only, identical in windows-1251
}
function valute(code: string, nominal: string, value: string): string {
  return `<Valute ID="x"><CharCode>${code}</CharCode><Nominal>${nominal}</Nominal><Value>${value}</Value></Valute>`;
}

describe('parseRates', () => {
  it('reads the saved CBR XML (windows-1251)', () => {
    const rates = parseRates(new Uint8Array(xmlBytes).buffer);
    expect(rates).toEqual({ eur: 92.6968, usd: 82.6617, date: '2026-11-12' });
    expect(RatesSchema.parse(rates)).toEqual(rates);
  });

  it('decodes Cyrillic names of the saved XML as windows-1251', () => {
    const text = new TextDecoder('windows-1251').decode(xmlBytes);
    expect(text).toContain('Австралийский доллар');
  });

  it('divides by Nominal and understands the decimal comma', () => {
    const rates = parseRates(cbrXml(valute('EUR', '10', '926,9680') + valute('USD', '1', '82,6617')));
    expect(rates).toEqual({ eur: 92.6968, usd: 82.6617, date: '2026-02-01' });
  });

  it('missing currency or broken XML → Russian error', () => {
    expect(() => parseRates(cbrXml(valute('USD', '1', '82,6')))).toThrow('В ответе ЦБ нет курса EUR');
    expect(() => parseRates(cbrXml(valute('EUR', '1', 'abc') + valute('USD', '1', '1')))).toThrow(/не распознан/);
    expect(() => parseRates(new TextEncoder().encode('<html>Service unavailable'))).toThrow(/не похож/);
    expect(() => parseRates(new Uint8Array())).toThrow(/не похож/);
  });
});
