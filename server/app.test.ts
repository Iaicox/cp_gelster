import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { readConfig } from './config.ts';

const tmp = mkdtempSync(join(tmpdir(), 'gelster-cp-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function builtClientDir(): string {
  const dir = join(tmp, 'dist');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>KP</title><div id="root"></div>');
  writeFileSync(join(dir, 'header.jpg'), 'jpg-bytes');
  return dir;
}

describe('API', () => {
  const app = createApp({ clientDir: join(tmp, 'missing') });

  it('GET /api/health answers {ok:true}', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('unknown API route answers 404 with {error}', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });

  it('without a built client explains how to build it', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('npm run build');
  });
});

describe('built client', () => {
  const app = createApp({ clientDir: builtClientDir() });

  it('serves index.html at /', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<div id="root">');
  });

  it('serves static files', async () => {
    const res = await app.request('/header.jpg');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
  });

  it.each(['/kp/abc', '/managers'])('falls back to index.html for client route %s', async (path) => {
    const res = await app.request(path);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<div id="root">');
  });

  it('keeps API answers as JSON', async () => {
    const res = await app.request('/api/health');
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('readConfig', () => {
  it('defaults to 127.0.0.1:3000', () => {
    const config = readConfig({});
    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3000);
    expect(config.dataDir).toMatch(/data-runtime$/);
  });

  it('reads PORT, HOST and DATA_DIR', () => {
    const dataDir = join(tmp, 'kp-data');
    const config = readConfig({ PORT: '8080', HOST: '0.0.0.0', DATA_DIR: dataDir });
    expect(config).toEqual({ port: 8080, host: '0.0.0.0', dataDir });
  });

  it.each(['abc', '0', '70000', '3.5'])('rejects invalid PORT=%s', (port) => {
    expect(() => readConfig({ PORT: port })).toThrow(/PORT/);
  });
});
