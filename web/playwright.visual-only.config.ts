import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Deterministic visual scenarios intercept every requested sample-data API route.
// This optional config runs just those scenarios with Vite, without starting .NET.
export default defineConfig({
  ...base,
  testMatch: 'visual.spec.ts',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
