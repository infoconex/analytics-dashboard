import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Dedicated local evaluation with deterministic fictional API fixtures.
// Default CI remains the full API-backed Playwright configuration.
export default defineConfig({
  ...base,
  testMatch: 'handoff.spec.ts',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
