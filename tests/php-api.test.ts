// Endpoint tests: start `php -S` on a free port with a temporary data directory and talk HTTP to it.
// Skipped when php is not installed; tests/run.sh then prints a loud warning (REQUIRE_PHP=1 makes it an error).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const TEST_PASSWORD = 'test-only-password-123';

async function startPhp(docroot: string, env: Record<string, string>): Promise<{ php: ChildProcess; base: string }> {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', docroot], {
    env: { ...process.env, ...env },
    stdio: 'ignore',
  });
  await waitForServer(`${base}/`, php);
  return { php, base };
}

function post(base: string, fields: Record<string, string | Blob>): Promise<Response> {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return fetch(`${base}/api/managers.php`, { method: 'POST', body });
}

/** Runs api/tools/set-password.php with the password typed twice on stdin. */
function setPassword(configPath: string, input: string) {
  return spawnSync('php', ['api/tools/set-password.php'], {
    cwd: root,
    input,
    encoding: 'utf8',
    env: { ...process.env, GELSTER_CONFIG: configPath },
  });
}

describe.skipIf(!hasPhp)('PHP API (php -S)', () => {
  const servers: ChildProcess[] = [];
  let base: string;
  let noPasswordBase: string;
  let dataBase: string;
  let tmp: string;
  let configPath: string;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'gelster-api-'));
    configPath = join(tmp, 'config.php');
    // A config with a custom key first: set-password.php must keep it.
    writeFileSync(configPath, "<?php return ['admin_password_hash' => '', 'allowed_hosts' => ['gelster.ru'], 'extra' => 'kept'];");
    const result = setPassword(configPath, `${TEST_PASSWORD}\n${TEST_PASSWORD}\n`);
    if (result.status !== 0) throw new Error(`set-password failed: ${result.stderr}`);

    const dataDir = join(tmp, 'data');
    const main = await startPhp(root, { GELSTER_DATA_DIR: dataDir, GELSTER_CONFIG: configPath });
    const noPassword = await startPhp(root, {
      GELSTER_DATA_DIR: join(tmp, 'data-nopass'),
      GELSTER_CONFIG: join(tmp, 'missing-config.php'),
    });
    // Serves the temporary directory itself, as a web server would serve api/ with data/ inside it.
    const data = await startPhp(tmp, {});
    servers.push(main.php, noPassword.php, data.php);
    base = main.base;
    noPasswordBase = noPassword.base;
    dataBase = data.base;
  });

  afterAll(() => {
    for (const php of servers) php.kill();
    rmSync(tmp, { recursive: true, force: true });
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
    expect(body.passwordSet).toBe(true);
    const other = (await (await fetch(`${noPasswordBase}/api/health.php`)).json()) as Record<string, unknown>;
    expect(other.passwordSet).toBe(false);
  });

  it('health.php rejects POST with a JSON error', async () => {
    const response = await fetch(`${base}/api/health.php`, { method: 'POST' });
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Метод не поддерживается.' });
  });

  it('set-password.php kept other keys, stored only a hash and refuses mismatched input', () => {
    const config = readFileSync(configPath, 'utf8');
    expect(config).toContain("'extra' => 'kept'");
    expect(config).toContain("'allowed_hosts'");
    expect(config).not.toContain(TEST_PASSWORD);
    expect(config).toMatch(/'admin_password_hash' => '\$/);
    const mismatch = setPassword(join(tmp, 'other-config.php'), 'aaaaaaaa1\nbbbbbbbb2\n');
    expect(mismatch.status).not.toBe(0);
    expect(existsSync(join(tmp, 'other-config.php'))).toBe(false);
  });

  it('api/tools/*.php answers 404 through the web', async () => {
    const response = await fetch(`${base}/api/tools/set-password.php`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('fetch.php refuses bad requests without touching the network', async () => {
    const cases: [string, number][] = [
      ['kind=page&url=http://gelster.ru/', 400],
      ['kind=page&url=https://evil.com/', 400],
      ['kind=page&url=https://gelster.ru.evil.com/', 400],
      ['kind=page&url=https://gelster.ru:8080/', 400],
      ['kind=page&url=https://user:pass@gelster.ru/', 400],
      ['kind=image&url=file:///etc/passwd', 400],
      ['kind=page', 400],
      ['kind=script&url=https://gelster.ru/', 400],
    ];
    for (const [query, status] of cases) {
      const response = await fetch(`${base}/api/fetch.php?${query}`);
      expect(response.status, query).toBe(status);
      const body = (await response.json()) as { error: string };
      expect(typeof body.error, query).toBe('string');
    }
    const post = await fetch(`${base}/api/fetch.php?kind=page&url=https://gelster.ru/`, { method: 'POST' });
    expect(post.status).toBe(405);
  });

  it('GET managers.php returns the seed list', async () => {
    const response = await fetch(`${base}/api/managers.php`);
    expect(response.status).toBe(200);
    const list = (await response.json()) as { id: string; name: string; signature: string }[];
    expect(list.map((m) => m.id)).toEqual(['michael_smu', 'ivan_loginov', 'max_mal', 'barilovsky_ga']);
    expect(list[0]).toEqual({ id: 'michael_smu', name: 'Михаил Смущенко', signature: 'api/data/signatures/michael_smu.jpg' });
  });

  it('login: right password 204, wrong password 401 after a delay', async () => {
    const ok = await post(base, { action: 'login', password: TEST_PASSWORD });
    expect(ok.status).toBe(204);
    const started = Date.now();
    const wrong = await post(base, { action: 'login', password: 'wrong-password' });
    expect(wrong.status).toBe(401);
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
    const text = await wrong.text();
    expect(text).not.toContain('$2y$');
    expect(text).not.toContain('$argon');
    expect(JSON.parse(text)).toEqual({ error: 'Неверный пароль.' });
  });

  it('add with a real JPEG, then delete', async () => {
    const jpeg = new Blob([readFileSync(join(root, 'api/seed/signatures/max_mal.jpg'))], { type: 'image/jpeg' });
    const added = await post(base, { action: 'add', password: TEST_PASSWORD, name: '  Пётр Петров ', signature: new Blob([jpeg], { type: 'text/plain' }) });
    expect(added.status).toBe(200);
    const manager = (await added.json()) as { id: string; name: string; signature: string };
    expect(manager.name).toBe('Пётр Петров');
    expect(manager.signature).toMatch(/^api\/data\/signatures\/[0-9a-f]{32}\.jpg$/);
    expect(Object.keys(manager).sort()).toEqual(['id', 'name', 'signature']);

    const list = (await (await fetch(`${base}/api/managers.php`)).json()) as { id: string }[];
    expect(list.at(-1)).toEqual(manager);

    const deleted = await post(base, { action: 'delete', password: TEST_PASSWORD, id: manager.id });
    expect(deleted.status).toBe(204);
    const again = await post(base, { action: 'delete', password: TEST_PASSWORD, id: manager.id });
    expect(again.status).toBe(404);
    const after = (await (await fetch(`${base}/api/managers.php`)).json()) as { id: string }[];
    expect(after.map((m) => m.id)).not.toContain(manager.id);
  });

  it('add refuses a missing password, a non-image and a bad name', async () => {
    const jpeg = new Blob([readFileSync(join(root, 'api/seed/signatures/max_mal.jpg'))]);
    const noPassword = await post(base, { action: 'add', name: 'X', signature: jpeg });
    expect(noPassword.status).toBe(401);
    const php = new Blob(['<?php echo 1; ?>']);
    const fd = new FormData();
    fd.append('action', 'add');
    fd.append('password', TEST_PASSWORD);
    fd.append('name', 'X');
    fd.append('signature', php, 'shell.jpg');
    const notImage = await fetch(`${base}/api/managers.php`, { method: 'POST', body: fd });
    expect(notImage.status).toBe(400);
    const badName = await post(base, { action: 'add', password: TEST_PASSWORD, name: '   ', signature: jpeg });
    expect(badName.status).toBe(400);
    const unknown = await post(base, { action: 'drop', password: TEST_PASSWORD });
    expect(unknown.status).toBe(400);
    const list = (await (await fetch(`${base}/api/managers.php`)).json()) as unknown[];
    expect(list).toHaveLength(4);
  });

  it('every POST answers 503 while the password is not set; the list still reads', async () => {
    for (const action of ['login', 'add', 'delete']) {
      const response = await post(noPasswordBase, { action, password: 'whatever', id: 'max_mal' });
      expect(response.status, action).toBe(503);
      expect(((await response.json()) as { error: string }).error).toMatch(/Пароль администратора не задан/);
    }
    const list = await fetch(`${noPasswordBase}/api/managers.php`);
    expect(list.status).toBe(200);
  });

  it('private data files are not served over HTTP', async () => {
    // The wrong login above created data/private/login-attempts.php.
    expect(existsSync(join(tmp, 'data/private/login-attempts.php'))).toBe(true);
    for (const path of ['/data/private/login-attempts.php', '/data/private/managers-lock.php']) {
      const response = await fetch(`${dataBase}${path}`);
      expect(response.status, path).toBe(404);
      expect(await response.text(), path).toBe('');
    }
    const signature = await fetch(`${dataBase}/data/signatures/max_mal.jpg`);
    expect(signature.status).toBe(200);
  });
});
