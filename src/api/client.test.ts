import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../shared/schema.ts';
import { ApiError, createApiClient } from './client.ts';

// vitest runs from the repository root
const FIXTURES = 'shared/parsers/__fixtures__/';
const pageBytes = new Uint8Array(readFileSync(`${FIXTURES}ooogelingen.ru/m_cocoa.htm`));
const ratesBytes = new Uint8Array(readFileSync(`${FIXTURES}cbr_XML_daily.xml`));

const PROXY: AppConfig = { apiBase: 'api', fetchMode: 'proxy' };
const DIRECT: AppConfig = { apiBase: 'api', fetchMode: 'direct' };
const SERVERLESS: AppConfig = { apiBase: null, fetchMode: 'direct' };

const MANAGERS = [{ id: 'a', name: 'Иван', signature: 'api/data/signatures/a.jpg' }];

type Handler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;

function setup(config: AppConfig, handler: Handler) {
  const fetchFn = vi.fn<typeof fetch>(async (input, init) => handler(String(input), init));
  return { client: createApiClient({ config: () => config, fetchFn }), fetchFn };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Response with a fixed `url` like the one fetch() returns after redirects. */
function withUrl(response: Response, url: string): Response {
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('proxy mode', () => {
  it('fetchCollection goes through api/fetch.php and resolves URLs against X-Final-Url', async () => {
    const { client, fetchFn } = setup(PROXY, () =>
      new Response(pageBytes, {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'X-Final-Url': 'https://www.ooogelingen.ru/m_cocoa.htm' },
      }),
    );
    const collection = await client.fetchCollection('https://ooogelingen.ru/m_cocoa.htm');
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      'api/fetch.php?kind=page&url=https%3A%2F%2Fooogelingen.ru%2Fm_cocoa.htm',
    );
    expect(collection.sourceUrl).toBe('https://www.ooogelingen.ru/m_cocoa.htm');
    expect(collection.flooringKind).toBe('Натуральный линолеум с какао');
    expect(collection.articles[0]?.image).toBe('https://www.ooogelingen.ru/Forbo/Marmoleum/Cocoa/3580.jpg');
  });

  it('fetchCollection without X-Final-Url uses the requested address', async () => {
    const { client } = setup(PROXY, () => new Response(pageBytes, { headers: { 'Content-Type': 'text/html' } }));
    const collection = await client.fetchCollection('https://ooogelingen.ru/m_cocoa.htm');
    expect(collection.sourceUrl).toBe('https://ooogelingen.ru/m_cocoa.htm');
  });

  it('apiBase with a trailing slash or a subdirectory', async () => {
    const { client, fetchFn } = setup({ apiBase: 'kp/api/', fetchMode: 'proxy' }, () => json(MANAGERS));
    await client.listManagers();
    expect(fetchFn.mock.calls[0]?.[0]).toBe('kp/api/managers.php');
  });

  it('API errors become ApiError with the Russian text from `error`', async () => {
    const { client } = setup(PROXY, () => json({ error: 'Адрес не разрешён' }, 400));
    const error = await rejection(client.fetchCollection('https://gelster.ru/x.htm'));
    expect(error.message).toBe('Адрес не разрешён');
    expect(error.status).toBe(400);
  });

  it('error without JSON body gets a generic message with the status', async () => {
    const { client } = setup(PROXY, () => new Response('<h1>Bad gateway</h1>', { status: 502 }));
    const error = await rejection(client.fetchImage('https://gelster.ru/a.jpg'));
    expect(error.message).toBe('Ошибка сервера (HTTP 502)');
    expect(error.status).toBe(502);
  });

  it('network failure → ApiError', async () => {
    const { client } = setup(PROXY, () => Promise.reject(new TypeError('Failed to fetch')));
    const error = await rejection(client.fetchRates());
    expect(error.message).toMatch(/Сервер приложения недоступен/);
    expect(error.status).toBe(0);
  });

  it('a page that is not a collection → ApiError with the parser message', async () => {
    const { client } = setup(PROXY, () => new Response('<p>nothing</p>', { headers: { 'Content-Type': 'text/html' } }));
    const error = await rejection(client.fetchCollection('https://gelster.ru/x.htm'));
    expect(error.message).toMatch(/не похожа на коллекцию/);
  });

  it('foreign links are refused before any request', async () => {
    const { client, fetchFn } = setup(PROXY, () => new Response(''));
    await rejection(client.fetchCollection('https://example.com/a.htm'));
    await rejection(client.fetchCollection('http://gelster.ru/a.htm'));
    const image = await rejection(client.fetchImage('https://cdn.example.com/a.jpg'));
    expect(image.message).toMatch(/через прокси не загружается/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fetchImage returns a Blob through kind=image', async () => {
    const { client, fetchFn } = setup(PROXY, () =>
      new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'Content-Type': 'image/jpeg' } }),
    );
    const blob = await client.fetchImage('https://gelster.ru/img/a b.jpg');
    expect(blob.size).toBe(3);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('api/fetch.php?kind=image&url=https%3A%2F%2Fgelster.ru%2Fimg%2Fa+b.jpg');
  });

  it('fetchRates parses api/rates.php', async () => {
    const { client, fetchFn } = setup(PROXY, () => new Response(ratesBytes));
    expect(client.canFetchRates()).toBe(true);
    await expect(client.fetchRates()).resolves.toEqual({ eur: 92.6968, usd: 82.6617, date: '2026-11-12' });
    expect(fetchFn.mock.calls[0]?.[0]).toBe('api/rates.php');
  });

  it('fetchRates: 502 from the API → message for the user', async () => {
    const { client } = setup(PROXY, () => json({ error: 'ЦБ недоступен, введите курс вручную' }, 502));
    expect((await rejection(client.fetchRates())).message).toBe('ЦБ недоступен, введите курс вручную');
  });

  it('managers: list, login, add, delete', async () => {
    const created = { id: 'b', name: 'Пётр', signature: 'api/data/signatures/b.png' };
    const { client, fetchFn } = setup(PROXY, (_url, init) => {
      if (init?.method !== 'POST') return json(MANAGERS);
      const body = init.body as FormData;
      if (body.get('action') === 'add') return json(created);
      return new Response(null, { status: 204 });
    });
    expect(client.canManageManagers()).toBe(true);
    await expect(client.listManagers()).resolves.toEqual(MANAGERS);
    await expect(client.login('secret')).resolves.toBeUndefined();
    const signature = new Blob([new Uint8Array([1, 2])], { type: 'image/png' });
    await expect(client.addManager('secret', 'Пётр', signature)).resolves.toEqual(created);
    await expect(client.deleteManager('secret', 'b')).resolves.toBeUndefined();

    const posts = fetchFn.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts.map(([url]) => url)).toEqual(['api/managers.php', 'api/managers.php', 'api/managers.php']);
    const [login, add, remove] = posts.map(([, init]) => init?.body as FormData);
    expect(Object.fromEntries(login?.entries() ?? [])).toEqual({ action: 'login', password: 'secret' });
    expect(add?.get('name')).toBe('Пётр');
    expect(add?.get('signature')).toBeInstanceOf(Blob);
    expect(Object.fromEntries(remove?.entries() ?? [])).toEqual({ action: 'delete', password: 'secret', id: 'b' });
  });

  it('managers: wrong password and lockout keep the server text', async () => {
    const { client } = setup(PROXY, () => json({ error: 'Неверный пароль' }, 401));
    const error = await rejection(client.login('nope'));
    expect(error).toMatchObject({ message: 'Неверный пароль', status: 401 });
  });

  it('managers: a broken list is reported, not passed on', async () => {
    const { client } = setup(PROXY, () => json([{ id: '', name: 1 }]));
    expect((await rejection(client.listManagers())).message).toBe('Список менеджеров повреждён');
  });
});

describe('direct mode', () => {
  it('pages and images are fetched from the site itself, the final URL comes from the response', async () => {
    const { client, fetchFn } = setup(DIRECT, (url) =>
      url.endsWith('.jpg')
        ? new Response(new Uint8Array([1]))
        : withUrl(new Response(pageBytes, { headers: { 'Content-Type': 'text/html' } }), 'https://www.ooogelingen.ru/m_cocoa.htm'),
    );
    const collection = await client.fetchCollection('https://ooogelingen.ru/m_cocoa.htm');
    expect(collection.sourceUrl).toBe('https://www.ooogelingen.ru/m_cocoa.htm');
    // Images from any host are allowed: there is no proxy whitelist in this mode.
    await expect(client.fetchImage('https://cdn.example.com/a.jpg')).resolves.toBeInstanceOf(Blob);
    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      'https://ooogelingen.ru/m_cocoa.htm',
      'https://cdn.example.com/a.jpg',
    ]);
    expect(fetchFn.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit' });
  });

  it('a site without CORS (network error) gives an explanation', async () => {
    const { client } = setup(DIRECT, () => Promise.reject(new TypeError('Failed to fetch')));
    expect((await rejection(client.fetchCollection('https://gelster.ru/a.htm'))).message).toMatch(/CORS/);
  });

  it('rates and managers still use the API', async () => {
    const { client, fetchFn } = setup(DIRECT, (url) => (url.endsWith('rates.php') ? new Response(ratesBytes) : json(MANAGERS)));
    await expect(client.fetchRates()).resolves.toMatchObject({ eur: 92.6968 });
    await expect(client.listManagers()).resolves.toEqual(MANAGERS);
    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual(['api/rates.php', 'api/managers.php']);
  });
});

describe('serverless mode (apiBase: null)', () => {
  it('pages go directly to the site even if fetchMode says proxy', async () => {
    const { client, fetchFn } = setup({ apiBase: null, fetchMode: 'proxy' }, () =>
      new Response(pageBytes, { headers: { 'Content-Type': 'text/html' } }),
    );
    await client.fetchCollection('https://ooogelingen.ru/m_cocoa.htm');
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://ooogelingen.ru/m_cocoa.htm');
  });

  it('rates are unavailable without a request', async () => {
    const { client, fetchFn } = setup(SERVERLESS, () => new Response(''));
    expect(client.canFetchRates()).toBe(false);
    expect((await rejection(client.fetchRates())).message).toMatch(/введите курс вручную/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('managers come from the static managers.json; changes are refused', async () => {
    const { client, fetchFn } = setup(SERVERLESS, () => json(MANAGERS));
    expect(client.canManageManagers()).toBe(false);
    await expect(client.listManagers()).resolves.toEqual(MANAGERS);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('managers.json');
    for (const call of [
      client.login('x'),
      client.addManager('x', 'Имя', new Blob([])),
      client.deleteManager('x', 'a'),
    ]) {
      expect((await rejection(call)).message).toMatch(/недоступно/);
    }
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('missing managers.json → ApiError', async () => {
    const { client } = setup(SERVERLESS, () => new Response('Not found', { status: 404 }));
    expect((await rejection(client.listManagers())).status).toBe(404);
  });
});

describe('fetchSignature', () => {
  it('loads the app-relative signature file as is, in any mode', async () => {
    const { client, fetchFn } = setup(PROXY, () => new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/jpeg' } }));
    const blob = await client.fetchSignature('api/data/signatures/a.jpg');
    expect(fetchFn.mock.calls[0]?.[0]).toBe('api/data/signatures/a.jpg');
    expect(blob.size).toBe(2);
  });

  it('refuses absolute addresses without a request', async () => {
    const { client, fetchFn } = setup(PROXY, () => new Response(''));
    for (const url of ['https://evil.example/a.jpg', '//evil.example/a.jpg', 'javascript:alert(1)']) {
      expect((await rejection(client.fetchSignature(url))).status).toBe(400);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
