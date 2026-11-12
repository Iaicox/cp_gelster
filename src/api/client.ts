/**
 * The only place where the client goes to the network (besides reading config.json in src/config.ts):
 * collection pages, images, CBR rates and managers. Behaviour depends on config.json (docs/spec.md, section 4):
 * - fetchMode "proxy": pages and images through `<apiBase>/fetch.php` (final address in `X-Final-Url`);
 * - fetchMode "direct": the browser fetches the sites itself (needs CORS on the sites);
 * - apiBase null: direct fetching, no CBR button, managers from the static `managers.json`, no management.
 * Every failure is thrown as ApiError with a Russian message ready to be shown to the user.
 */
import { z } from 'zod';
import { decodeHtml, parseCollection, parseRates, siteOf } from '../../shared/parsers/index.ts';
import { ManagerSchema, type AppConfig, type Collection, type Manager, type Rates } from '../../shared/schema.ts';
import { getConfig } from '../config.ts';

export class ApiError extends Error {
  /** HTTP status of the failed response; 0 when the request did not reach a server. */
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type ApiDeps = {
  /** Defaults to the config loaded at startup (getConfig()). */
  config?: () => AppConfig;
  fetchFn?: typeof fetch;
};

const ManagerListSchema = z.array(ManagerSchema);
const ErrorBodySchema = z.object({ error: z.string().min(1) });

/** Text of the `error` field of an API error response, or a generic message with the status. */
async function errorFrom(response: Response): Promise<ApiError> {
  let message = `Ошибка сервера (HTTP ${response.status})`;
  try {
    const parsed = ErrorBodySchema.safeParse(await response.json());
    if (parsed.success) message = parsed.data.error;
  } catch {
    // not JSON: keep the generic message
  }
  return new ApiError(message, response.status);
}

export function createApiClient(deps: ApiDeps = {}) {
  const config = deps.config ?? getConfig;
  // Late lookup so tests and the browser can replace the global fetch after the client is created.
  const doFetch: typeof fetch = (input, init) => (deps.fetchFn ?? fetch)(input, init);

  function apiUrl(file: string, query?: Record<string, string>): string {
    const base = config().apiBase;
    if (base === null) throw new ApiError('Сервер приложения не настроен (apiBase: null)');
    const search = query ? `?${new URLSearchParams(query).toString()}` : '';
    return `${base.replace(/\/+$/, '')}/${file}${search}`;
  }

  function isProxy(): boolean {
    const { apiBase, fetchMode } = config();
    return apiBase !== null && fetchMode === 'proxy';
  }

  /** fetch() that turns network failures and non-2xx answers into ApiError. */
  async function request(url: string, init: RequestInit | undefined, unreachable: string): Promise<Response> {
    let response: Response;
    try {
      response = await doFetch(url, init);
    } catch {
      throw new ApiError(unreachable);
    }
    if (!response.ok) throw await errorFrom(response);
    return response;
  }

  function checkSiteUrl(url: string): void {
    if (!siteOf(url)) {
      throw new ApiError('Ссылка должна вести на страницу коллекции https://gelster.ru или https://ooogelingen.ru', 400);
    }
  }

  const directFailure =
    'Сайт не ответил. Без прокси браузер читает сайт, только если сайт разрешает это заголовками CORS.';

  /** Loads and parses a collection page. */
  async function fetchCollection(url: string): Promise<Collection> {
    checkSiteUrl(url);
    let response: Response;
    let finalUrl: string;
    if (isProxy()) {
      response = await request(apiUrl('fetch.php', { kind: 'page', url }), undefined, 'Сервер приложения недоступен');
      finalUrl = response.headers.get('X-Final-Url') || url;
    } else {
      response = await request(url, { credentials: 'omit' }, directFailure);
      finalUrl = response.url || url;
    }
    const html = decodeHtml(await response.arrayBuffer(), response.headers.get('Content-Type'));
    try {
      return parseCollection(html, finalUrl);
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : 'Страница не разобрана');
    }
  }

  /** Image bytes (for IndexedDB and DOCX). In proxy mode only images from the two sites can be loaded. */
  async function fetchImage(url: string): Promise<Blob> {
    if (isProxy()) {
      if (!siteOf(url)) throw new ApiError('Картинка не с gelster.ru или ooogelingen.ru: через прокси не загружается', 400);
      const response = await request(apiUrl('fetch.php', { kind: 'image', url }), undefined, 'Сервер приложения недоступен');
      return response.blob();
    }
    const response = await request(url, { credentials: 'omit' }, directFailure);
    return response.blob();
  }

  /** Whether the «ЦБ» button makes sense: cbr.ru has no CORS, so rates need the PHP API. */
  function canFetchRates(): boolean {
    return config().apiBase !== null;
  }

  /** Current CBR rates through api/rates.php. */
  async function fetchRates(): Promise<Rates> {
    if (!canFetchRates()) throw new ApiError('Курс ЦБ недоступен без сервера приложения: введите курс вручную');
    const response = await request(apiUrl('rates.php'), undefined, 'Сервер приложения недоступен: введите курс вручную');
    try {
      return parseRates(await response.arrayBuffer());
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : 'Курс ЦБ не распознан');
    }
  }

  /** Whether the managers list can be changed (needs the PHP API). */
  function canManageManagers(): boolean {
    return config().apiBase !== null;
  }

  /** Managers list: api/managers.php, or the static managers.json next to index.html without a server. */
  async function listManagers(): Promise<Manager[]> {
    const url = config().apiBase === null ? 'managers.json' : apiUrl('managers.php');
    const response = await request(url, { cache: 'no-store' }, 'Не удалось загрузить список менеджеров');
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError('Список менеджеров повреждён');
    }
    const parsed = ManagerListSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Список менеджеров повреждён');
    return parsed.data;
  }

  async function post(fields: Record<string, string | Blob>): Promise<Response> {
    if (!canManageManagers()) throw new ApiError('Управление менеджерами недоступно: приложение работает без сервера');
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    return request(apiUrl('managers.php'), { method: 'POST', body }, 'Сервер приложения недоступен');
  }

  /** Checks the administrator password (204 = correct). */
  async function login(password: string): Promise<void> {
    await post({ action: 'login', password });
  }

  async function addManager(password: string, name: string, signature: Blob): Promise<Manager> {
    const response = await post({ action: 'add', password, name, signature });
    const parsed = ManagerSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new ApiError('Сервер вернул непонятный ответ');
    return parsed.data;
  }

  async function deleteManager(password: string, id: string): Promise<void> {
    await post({ action: 'delete', password, id });
  }

  return {
    fetchCollection,
    fetchImage,
    canFetchRates,
    fetchRates,
    canManageManagers,
    listManagers,
    login,
    addManager,
    deleteManager,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The app-wide client: config.json loaded at startup, global fetch. */
export const api: ApiClient = createApiClient();
export const {
  fetchCollection,
  fetchImage,
  canFetchRates,
  fetchRates,
  canManageManagers,
  listManagers,
  login,
  addManager,
  deleteManager,
} = api;
