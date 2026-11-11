import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

export type AppOptions = {
  /** Directory with the built client. Without index.html in it only the API is served (dev: Vite serves the client). */
  clientDir: string;
};

export function createApp({ clientDir }: AppOptions): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true }));
  app.all('/api/*', (c) => c.json({ error: 'Метод API не найден' }, 404));

  const indexPath = join(clientDir, 'index.html');
  if (existsSync(indexPath)) {
    const indexHtml = readFileSync(indexPath, 'utf8');
    app.use('*', serveStatic({ root: clientDir }));
    // SPA fallback: client-side routes (/kp/:id, /managers) get index.html.
    app.get('*', (c) => c.html(indexHtml));
  } else {
    app.get('*', (c) =>
      c.text('Клиент не собран: выполните npm run build (для разработки — npm run dev).', 404),
    );
  }

  return app;
}
