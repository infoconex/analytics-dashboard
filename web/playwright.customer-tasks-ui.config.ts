import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Deterministic fictional API in the browser tests; CI still runs the full API-backed suite.
export default defineConfig({
  ...base,
  testMatch: 'customerTasks.spec.ts',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
