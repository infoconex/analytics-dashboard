import { defineConfig } from '@playwright/test';

// Optional Vite-only fictional-data authoring walkthrough, useful where the
// .NET SDK is unavailable. The standard Playwright config still runs in CI.
export default defineConfig({
  testDir: './e2e', testMatch: 'visualizationAuthoring.spec.ts',
  timeout: 45_000, workers: 1, retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5173', browserName: 'chromium',
    headless: true, launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium', args: ['--no-sandbox'] },
    trace: 'retain-on-failure', reducedMotion: 'reduce',
  },
  webServer: [{ command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', timeout: 60_000, reuseExistingServer: false }],
});
