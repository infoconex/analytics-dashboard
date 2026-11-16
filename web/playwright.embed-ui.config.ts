import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Local UI-only verification: browser paths use fixed, fictional route fixtures.
// The real authorization contract runs separately in .NET tests and CI E2E.
process.env.ANALYTICS_UI_ONLY = '1';
export default defineConfig({
  ...base,
  testMatch: 'embed.spec.ts',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
