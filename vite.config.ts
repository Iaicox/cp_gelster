import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiPort = process.env.PORT ?? '3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['{src,server,shared,tests}/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
