// Endpoint tests: start `php -S` on a free port with a temporary data directory and talk HTTP to it.
// Skipped when php is not installed; tests/run.sh then prints a loud warning (REQUIRE_PHP=1 makes it an error).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const hasPhp = spawnSync('php', ['-v'], { stdio: 'ignore' }).status === 0;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('no port'));
      });
    });
  });
}

async function waitForServer(url: string, php: ChildProcess): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (php.exitCode !== null) throw new Error(`php -S exited with ${php.exitCode}`);
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  throw new Error(`php -S did not start at ${url}`);
}

describe.skipIf(!hasPhp)('PHP API (php -S)', () => {
  let php: ChildProcess;
  let base: string;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'gelster-api-'));
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', root], {
      env: { ...process.env, GELSTER_DATA_DIR: join(dataDir, 'data') },
      stdio: 'ignore',
    });
    await waitForServer(`${base}/api/health.php`, php);
  });

  afterAll(() => {
    php?.kill();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('GET api/health.php reports readiness flags without versions or paths', async () => {
    const response = await fetch(`${base}/api/health.php`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['curl', 'dataWritable', 'ok', 'passwordSet', 'phpOk']);
    expect(body.phpOk).toBe(true);
    expect(body.dataWritable).toBe(true);
    expect(body.ok).toBe(body.curl);
    expect(typeof body.passwordSet).toBe('boolean');
  });

  it('health.php rejects POST with a JSON error', async () => {
    const response = await fetch(`${base}/api/health.php`, { method: 'POST' });
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Метод не поддерживается.' });
  });
});
