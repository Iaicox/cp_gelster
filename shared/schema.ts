import { z } from 'zod';

/**
 * Client settings from `config.json` next to index.html (docs/spec.md, section 4).
 * Missing keys take their defaults, so `{}` is a valid file.
 */
export const AppConfigSchema = z.object({
  /** Directory of the PHP API relative to the app, or null for the serverless mode. */
  apiBase: z.string().trim().min(1).nullable().default('api'),
  /** "proxy": pages and images go through api/fetch.php; "direct": the browser fetches sites itself. */
  fetchMode: z.enum(['proxy', 'direct']).default('proxy'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
