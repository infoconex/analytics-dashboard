import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Local UX-only runs use deterministic fictional response fixtures, not an API.
// The default CI configuration continues to run the real .NET authorization tests.
process.env.ANALYTICS_UI_ONLY = '1';
export default defineConfig({
  ...base,
  testMatch: 'interpretation.spec.ts',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
