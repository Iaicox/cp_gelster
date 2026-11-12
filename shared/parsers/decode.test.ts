import { describe, expect, it } from 'vitest';
import { decodeHtml } from './decode.ts';

const TEXT = 'Натуральный линолеум';
/** windows-1251 bytes of TEXT (А..я = 0xC0..0xFF, space = 0x20). */
function cp1251(text: string): number[] {
  return Array.from(text, (char) => (char === ' ' ? 0x20 : char.charCodeAt(0) - 0x410 + 0xc0));
}
function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}
function page(head: string, body: number[]): Uint8Array {
  return new Uint8Array([...ascii(`<html><head>${head}</head><body>`), ...body, ...ascii('</body></html>')]);
}

describe('decodeHtml', () => {
  it('utf-8 without any hints', () => {
    const bytes = new TextEncoder().encode(`<p>${TEXT}</p>`);
    expect(decodeHtml(bytes, null)).toBe(`<p>${TEXT}</p>`);
    expect(decodeHtml(bytes.buffer, 'text/html')).toBe(`<p>${TEXT}</p>`);
  });

  it('charset from Content-Type wins over meta', () => {
    const bytes = page('<meta charset="utf-8">', cp1251(TEXT));
    expect(decodeHtml(bytes, 'text/html; charset=windows-1251')).toContain(TEXT);
    expect(decodeHtml(bytes, 'text/html;charset="Windows-1251"')).toContain(TEXT);
  });

  it('meta charset in the first 2048 bytes', () => {
    expect(decodeHtml(page('<meta charset="windows-1251">', cp1251(TEXT)), 'text/html')).toContain(TEXT);
    expect(
      decodeHtml(page('<meta http-equiv="Content-Type" content="text/html; charset=cp1251">', cp1251(TEXT)), null),
    ).toContain(TEXT);
  });

  it('meta after the first 2048 bytes is ignored (UTF-8 then)', () => {
    const padding = `<!--${'x'.repeat(2100)}-->`;
    const decoded = decodeHtml(page(`${padding}<meta charset="windows-1251">`, cp1251(TEXT)), null);
    expect(decoded).not.toContain(TEXT);
    expect(decoded).toContain('�');
  });

  it('unknown charset label falls back to the next source', () => {
    const bytes = page('<meta charset="windows-1251">', cp1251(TEXT));
    expect(decodeHtml(bytes, 'text/html; charset=x-unknown-42')).toContain(TEXT);
    expect(decodeHtml(new TextEncoder().encode(TEXT), 'text/html; charset=nonsense')).toBe(TEXT);
  });
});
