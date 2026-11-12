import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Port of `npm run dev:api` (php -S); Vite proxies /api there in development. */
const phpPort = process.env.PHP_PORT ?? '8081';

export default defineConfig({
  // Relative asset URLs: the build works from any subdirectory without server rewrite rules.
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': `http://127.0.0.1:${phpPort}`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'client', include: ['{src,shared}/**/*.test.{ts,tsx}'], environment: 'jsdom' },
      },
      {
        extends: true,
        test: { name: 'node', include: ['tests/**/*.test.ts'], environment: 'node' },
      },
    ],
  },
});
