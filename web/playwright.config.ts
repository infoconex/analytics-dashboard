import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dotnet = process.env.ANALYTICS_DOTNET ?? 'dotnet';
const catalogPath = join(tmpdir(), `analytics-e2e-${randomUUID()}.db`);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      args: ['--no-sandbox'],
    },
  },
  webServer: [
    {
      command: `${dotnet} run --no-build --no-launch-profile --project src/AnalyticsDashboard.Api/AnalyticsDashboard.Api.csproj --urls http://127.0.0.1:5055`,
      cwd: '..',
      url: 'http://127.0.0.1:5055/api/health',
      timeout: 120_000,
      env: { ASPNETCORE_ENVIRONMENT: 'Development', Catalog__Path: catalogPath },
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
