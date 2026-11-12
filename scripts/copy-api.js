// Copies api/ into dist/api/ after `vite build`, leaving out local secrets and runtime data:
// api/config.php and api/data/ stay where they are (on the hosting they must never be overwritten).
import { cpSync, existsSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const from = resolve(root, 'api');
const to = resolve(root, 'dist', 'api');

/** Paths inside api/ that never go into the build. */
function isExcluded(relPath) {
  const p = relPath.split(sep).join('/');
  return p === 'config.php' || p === 'data' || p.startsWith('data/');
}

if (!existsSync(resolve(root, 'dist'))) {
  console.error('dist/ not found: run vite build first');
  process.exit(1);
}

cpSync(from, to, {
  recursive: true,
  filter: (src) => !isExcluded(relative(from, src)),
});
console.log('api/ copied to dist/api/ (without config.php and data/)');
