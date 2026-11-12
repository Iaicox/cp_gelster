import { AppConfigSchema, type AppConfig } from '../shared/schema.ts';

export const DEFAULT_CONFIG: AppConfig = { apiBase: 'api', fetchMode: 'proxy' };

/** `apiBase: null` means there is no server, so there is no proxy either. */
function normalize(config: AppConfig): AppConfig {
  return config.apiBase === null ? { apiBase: null, fetchMode: 'direct' } : config;
}

/**
 * Reads `config.json` next to index.html (relative URL, so it works from a subdirectory).
 * A missing or broken file falls back to the defaults with a console warning instead of breaking the app.
 */
export async function loadConfig(fetchFn: typeof fetch = fetch): Promise<AppConfig> {
  try {
    const response = await fetchFn('config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = AppConfigSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error(parsed.error.message);
    return normalize(parsed.data);
  } catch (error) {
    console.warn('config.json не прочитан, используются настройки по умолчанию:', error);
    return { ...DEFAULT_CONFIG };
  }
}

let current: AppConfig = { ...DEFAULT_CONFIG };

/** Loads config.json once at startup; later reads go through getConfig(). */
export async function initConfig(fetchFn: typeof fetch = fetch): Promise<AppConfig> {
  current = await loadConfig(fetchFn);
  return current;
}

export function getConfig(): AppConfig {
  return current;
}
