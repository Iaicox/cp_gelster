import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The only client files allowed to go to the network (docs/spec.md, section 4.2). */
const ALLOWED = new Set(['src/api/client.ts', 'src/config.ts']);
/** Any use of the global fetch (call or reference: `fetch(`, `?? fetch)`, `typeof fetch`), XHR, sockets, beacons. */
const NETWORK = /\bfetch\b(?!\.php)|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|\bimport\s*\(\s*['"`]https?:/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__fixtures__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('network access', () => {
  it('src/ and shared/ reach the network only through src/api/client.ts and src/config.ts', () => {
    const offenders = ['src', 'shared']
      .flatMap((dir) => sourceFiles(dir))
      .filter((file) => !ALLOWED.has(file.split('\\').join('/')))
      .filter((file) => NETWORK.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the check itself sees fetch in the allowed files', () => {
    expect(NETWORK.test(readFileSync('src/api/client.ts', 'utf8'))).toBe(true);
  });
});
