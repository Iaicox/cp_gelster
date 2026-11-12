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

  it('managers seed lists four managers in the Manager format with existing signature files', () => {
    const managers = JSON.parse(readFileSync(at('api/seed/managers.json'), 'utf8')) as Record<string, unknown>[];
    expect(managers.map((m) => m.id)).toEqual(['michael_smu', 'ivan_loginov', 'max_mal', 'barilovsky_ga']);
    for (const m of managers) {
      expect(Object.keys(m).sort()).toEqual(['id', 'name', 'signature']);
      expect(typeof m.name).toBe('string');
      // URL relative to the app once the seed is copied into api/data/; the file itself ships in api/seed/.
      const signature = String(m.signature);
      expect(signature).toMatch(/^api\/data\/signatures\/[a-z0-9_]+\.jpg$/);
      const file = signature.replace('api/data/', 'api/seed/');
      expect(existsSync(at(file)), file).toBe(true);
    }
  });

  it('public/config.json exists (read by the client at startup)', () => {
    expect(existsSync(at('public/config.json'))).toBe(true);
  });
});
