import { chromium, expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const memberships = [
  { id: 'northstar', name: 'Northstar Commerce', role: 'owner' },
  { id: 'isolated', name: 'Isolated Tenant', role: 'viewer' },
];

test('switching organizations retains a scoped context after reload and browser Back', async ({ page }, info) => {
  await page.route('**/api/organizations', route => route.fulfill({ json: memberships }));
  await page.route('**/api/organizations/isolated/dashboards', route => route.fulfill({ json: [{
    id: '18ff3350-79f4-4bb8-8d73-9b5e6885df89', organizationId: 'isolated', name: 'Isolated customer report',
    description: 'Fictional orders for the isolated workspace', widgets: [], revision: 1,
    createdBy: 'sample-viewer', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  }] }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Switch organization' }).selectOption('isolated');
  await expect(page).toHaveURL(/#\/organization\/isolated\/overview$/);
  await expect(page.getByText('Your access is view-only.')).toBeVisible();
  await page.getByRole('button', { name: 'Dashboards' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboards' })).toBeVisible();
  await expect(page.getByText('Isolated customer report')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New dashboard' })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('ux7-organization-dashboard-viewer.png'), fullPage: true });
  await page.reload();
  await expect(page.getByText('Isolated customer report')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Switch organization' })).toHaveValue('isolated');
  await page.goBack();
  await expect(page).toHaveURL(/#\/organization\/isolated\/overview$/);
  await expect(page.getByText('Your access is view-only.')).toBeVisible();
});

test('unavailable organization URL cannot become selected tenant context', async ({ page }) => {
  await page.route('**/api/organizations', route => route.fulfill({ json: memberships }));
  await page.goto('/#/organization/untrusted/dashboard/18ff3350-79f4-4bb8-8d73-9b5e6885df89');
  await expect(page.getByText('The requested organization is unavailable to your account. Showing an authorized workspace.')).toBeVisible();
  await expect(page).toHaveURL(/#\/organization\/northstar\/overview$/);
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByText('Isolated customer report')).toHaveCount(0);
});

test('viewer understands permissions and disconnected source metadata', async ({ page }) => {
  await page.route('**/api/organizations', route => route.fulfill({ json: memberships }));
  await page.route('**/api/organizations/isolated/dashboards', route => route.fulfill({ json: [] }));
  await page.route('**/api/organizations/isolated/data-sources', route => route.fulfill({ json: [] }));
  await page.goto('/#/organization/isolated/settings');
  await expect(page.getByRole('heading', { name: 'Your access' })).toBeVisible();
  await expect(page.getByText('Your role: viewer')).toBeVisible();
  await expect(page.getByText('Live connections', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Data sources' }).click();
  await expect(page.getByText('Registration only — no live connections')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register data source' })).toHaveCount(0);
  await expect(page.getByText('No data sources registered')).toBeVisible();
});

for (const { width, height, name } of [
  { width: 1440, height: 900, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
  { width: 320, height: 900, name: 'narrow' },
]) {
  test(`organization context stays readable at ${name} ${width}×${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.goto('/#/organization/northstar/settings');
    await expect(page.getByRole('heading', { name: 'Organization', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your access' })).toBeVisible();
    await expect(page.getByText('Metadata only', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`ux7-organization-${name}.png`), fullPage: true });
  });
}

test('organization view survives forced colors without hiding role semantics', async ({ page }, info) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/#/organization/northstar/settings');
  await expect(page.getByText('Your role: owner')).toBeVisible();
  await page.screenshot({ path: info.outputPath('ux7-organization-forced-colors.png'), fullPage: true });
});

test('genuine Chromium 200% and 400% zoom preserves organization access context', async ({}, info) => {
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true, viewport: null,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1440,900'],
  });
  const evidence: unknown[] = [];
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5173/#/organization/northstar/settings');
    await expect(page.getByRole('heading', { name: 'Your access' })).toBeVisible();
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const setZoom = (factor: number) => worker.evaluate(async f => {
      const tabs = (globalThis as unknown as { chrome: { tabs: {
        query(details: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
        setZoom(id: number, zoom: number): Promise<void>;
        getZoom(id: number): Promise<number>;
      } } }).chrome.tabs;
      const tab = (await tabs.query({})).find(item => item.url?.includes('/#/organization/northstar/settings'));
      if (tab?.id === undefined) throw new Error('Organization browser tab unavailable');
      await tabs.setZoom(tab.id, f);
      return tabs.getZoom(tab.id);
    }, factor);
    const metrics = () => page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, overflow: document.documentElement.scrollWidth > innerWidth }));
    const baseline = await metrics();
    for (const factor of [2, 4]) {
      const actual = await setZoom(factor);
      await expect.poll(async () => (await metrics()).width).toBeLessThanOrEqual(baseline.width / factor + 2);
      const observed = await metrics();
      expect(actual).toBeCloseTo(factor, 1);
      expect(observed.dpr / baseline.dpr).toBeCloseTo(factor, 1);
      expect(observed.overflow).toBe(false);
      await expect(page.getByRole('heading', { name: 'Your access' })).toBeVisible();
      const cdp = await context.newCDPSession(page);
      const raw = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
      const path = info.outputPath(`ux7-organization-native-${factor * 100}-chrome.png`);
      await writeFile(path, Buffer.from(raw.data, 'base64'));
      await info.attach(`ux7-organization-native-${factor * 100}-chrome`, { path, contentType: 'image/png' });
      evidence.push({ factor, actual, observed, chrome: context.browser()?.version(), os: process.platform });
    }
  } finally {
    const path = info.outputPath('ux7-organization-native-zoom.json');
    await writeFile(path, JSON.stringify(evidence, null, 2));
    await info.attach('ux7-organization-native-zoom.json', { path, contentType: 'application/json' });
    await context.close();
  }
});
