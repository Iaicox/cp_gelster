import publicConfig from '../public/config.json';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppConfigSchema } from '../shared/schema.ts';
import { DEFAULT_CONFIG, getConfig, initConfig, loadConfig } from './config.ts';

function fetchReturning(body: string, status = 200): typeof fetch {
  return vi.fn(async () => new Response(body, { status }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadConfig', () => {
  it('reads config.json by a relative URL', async () => {
    const fetchFn = fetchReturning('{"apiBase":"backend","fetchMode":"direct"}');
    await expect(loadConfig(fetchFn)).resolves.toEqual({ apiBase: 'backend', fetchMode: 'direct' });
    expect(fetchFn).toHaveBeenCalledWith('config.json', { cache: 'no-store' });
  });

  it('fills missing keys with defaults', async () => {
    await expect(loadConfig(fetchReturning('{}'))).resolves.toEqual(DEFAULT_CONFIG);
    await expect(loadConfig(fetchReturning('{"fetchMode":"direct"}'))).resolves.toEqual({
      apiBase: 'api',
      fetchMode: 'direct',
    });
  });

  it('apiBase null forces direct mode', async () => {
    await expect(loadConfig(fetchReturning('{"apiBase":null,"fetchMode":"proxy"}'))).resolves.toEqual({
      apiBase: null,
      fetchMode: 'direct',
    });
  });

  it.each([
    ['missing file', fetchReturning('not found', 404)],
    ['broken JSON', fetchReturning('{"apiBase":')],
    ['wrong fetchMode', fetchReturning('{"fetchMode":"tunnel"}')],
    ['empty apiBase', fetchReturning('{"apiBase":"  "}')],
    ['not an object', fetchReturning('[1,2]')],
    ['network error', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))],
  ])('%s → defaults with a warning', async (_name, fetchFn) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(loadConfig(fetchFn)).resolves.toEqual(DEFAULT_CONFIG);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('initConfig stores the loaded config for getConfig', async () => {
    await initConfig(fetchReturning('{"apiBase":null}'));
    expect(getConfig()).toEqual({ apiBase: null, fetchMode: 'direct' });
  });
});

describe('public/config.json', () => {
  it('matches the schema and the documented defaults', () => {
    const raw: unknown = publicConfig;
    expect(raw).toEqual({ apiBase: 'api', fetchMode: 'proxy' });
    expect(AppConfigSchema.parse(raw)).toEqual(DEFAULT_CONFIG);
  });
});
