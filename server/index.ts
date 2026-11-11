import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { clientDir, readConfig } from './config.ts';

const config = readConfig();
const app = createApp({ clientDir });

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (info) => {
  console.log(`Gelster KP server: http://${info.address}:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
