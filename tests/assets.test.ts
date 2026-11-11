import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const at = (path: string) => `${root}${path}`;

describe('migrated assets', () => {
  it.each(['header.jpg', 'footer.jpg', 'icon.png', 'favicon.ico'])('public/%s exists', (file) => {
    expect(existsSync(at(`public/${file}`))).toBe(true);
  });

  it('every font referenced by document.css exists in public/', () => {
    const css = readFileSync(at('src/styles/document.css'), 'utf8');
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1] ?? '');
    expect(urls).toHaveLength(8);
    for (const url of urls) expect(existsSync(at(`public${url}`)), url).toBe(true);
    expect(css).not.toContain('fonts.gstatic.com');
  });

  it('managers seed lists four managers with existing signature files', () => {
    const managers = JSON.parse(readFileSync(at('data/managers/managers.json'), 'utf8')) as {
      id: string;
      name: string;
      file: string;
    }[];
    expect(managers.map((m) => m.id)).toEqual(['michael_smu', 'ivan_loginov', 'max_mal', 'barilovsky_ga']);
    for (const m of managers) expect(existsSync(at(`data/managers/${m.file}`)), m.file).toBe(true);
  });
});
