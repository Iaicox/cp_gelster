import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ServerConfig = {
  port: number;
  host: string;
  /** Runtime data (managers list, signatures). Not used yet; read here so all env settings live in one place. */
  dataDir: string;
};

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

/** Reads server settings from environment variables (see README). */
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const rawPort = env.PORT ?? '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer 1..65535, got "${rawPort}"`);
  }
  return {
    port,
    host: env.HOST || '127.0.0.1',
    dataDir: resolve(projectRoot, env.DATA_DIR || 'data-runtime'),
  };
}

/** Directory with the client built by `npm run build`. */
export const clientDir = resolve(projectRoot, 'dist');
