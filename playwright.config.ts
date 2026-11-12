import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium, defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5199);

/**
 * Playwright's own Chromium when it is downloaded; otherwise a Chromium that is already on the machine
 * (PLAYWRIGHT_CHROMIUM_EXECUTABLE, an older download in the Playwright cache, the system package).
 */
function fallbackChromium(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (existsSync(chromium.executablePath())) return undefined;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const cached = existsSync(cache)
    ? readdirSync(cache)
        .filter((name) => /^chromium-\d+$/.test(name))
        .sort()
        .reverse()
        .flatMap((name) => ['chrome-linux64', 'chrome-linux'].map((dir) => join(cache, name, dir, 'chrome')))
    : [];
  return [...cached, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find((path) =>
    existsSync(path),
  );
}

const executablePath = fallbackChromium();

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.output',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    viewport: { width: 1280, height: 900 },
    locale: 'ru-RU',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  // The dev server only serves the client; every request to api/ and to the sites is answered by fixtures.
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
