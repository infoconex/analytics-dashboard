import { chromium, expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dashboard, DashboardWidget } from '../src/model';

const dashboardId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const makeWidget = (index: number, title: string, kind: DashboardWidget['kind'], datasetKey: DashboardWidget['datasetKey'], metricKey: string): DashboardWidget => ({
  id: `996e3063-18e9-4ddb-887a-229198c6dd${String(index).padStart(2, '0')}`,
  title, kind, datasetKey, metricKey, dimensionKey: datasetKey === 'commerce' ? 'month' : 'channel',
});
const sample: Dashboard = {
  id: dashboardId, organizationId: 'northstar', name: 'Business performance', description: 'Fictional business overview',
  revision: 1, createdBy: 'demo', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [
    makeWidget(1, 'Total revenue', 'metric', 'commerce', 'revenue'),
    makeWidget(2, 'Revenue over time', 'area', 'commerce', 'revenue'),
    makeWidget(3, 'Orders by channel', 'bar', 'channels', 'orders'),
    makeWidget(4, 'Traffic sources', 'donut', 'channels', 'sessions'),
    makeWidget(5, 'Conversion by channel', 'metric', 'channels', 'conversion'),
    makeWidget(6, 'Channel details', 'table', 'channels', 'orders'),
  ],
};
const dense: Dashboard = {
  ...sample, widgets: [...sample.widgets, ...sample.widgets.map((widget, index) => ({
    ...widget, id: `996e3063-18e9-4ddb-887a-229198c6dd${String(index + 7).padStart(2, '0')}`,
    title: `${widget.title} — regional`,
  }))],
};
const inaccessible = { ...sample, id: 'isolated-dashboard', organizationId: 'isolated', name: 'Isolated insights', widgets: [makeWidget(12, 'Unavailable example', 'metric', 'commerce', 'unknown')] };
const memberships = [
  { id: 'northstar', name: 'Northstar Commerce', role: 'viewer' },
  { id: 'isolated', name: 'Isolated Tenant', role: 'viewer' },
];

async function routeFictionalApi(page: Page, dashboard: Dashboard = sample, writes: string[] = []) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') {
      writes.push(`${route.request().method()} ${path}`);
      return route.fulfill({ status: 405, body: 'Read-only fixture' });
    }
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'sample-viewer', displayName: 'Sample Viewer' } });
    if (path === '/api/organizations') return route.fulfill({ json: memberships });
    if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [dashboard] });
    if (path === `/api/organizations/northstar/dashboards/${dashboard.id}`) return route.fulfill({ json: dashboard });
    if (path === '/api/organizations/isolated/dashboards') return route.fulfill({ json: [inaccessible] });
    if (path === `/api/organizations/isolated/dashboards/${inaccessible.id}`) return route.fulfill({ json: inaccessible });
    return route.fulfill({ status: 403, body: 'Not authorized' });
  });
}

async function capture(page: Page, info: TestInfo, label: string, fullPage = true) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const path = info.outputPath(`ux9-${label}.png`);
  await page.screenshot({ path, fullPage, animations: 'disabled' });
  await info.attach(`ux9-${label}`, { path, contentType: 'image/png' });
}

async function noHorizontalOverflow(page: Page) {
  const { visibleWidth, documentWidth } = await page.evaluate(() => ({ visibleWidth: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  expect(documentWidth, `Horizontal overflow at viewport ${visibleWidth}px`).toBeLessThanOrEqual(visibleWidth + 1);
}

test.use({ reducedMotion: 'reduce' });

test('SC-UX9-01/02/03/08: precise overview, context, filtering, exact values and keyboard inspection', async ({ page }, info) => {
  await routeFictionalApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  const steps: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  const figures = page.locator('.summary-card');
  await expect(figures).toHaveCount(4);
  await expect(figures.nth(0)).toContainText('$375.3K');
  await expect(figures.nth(1)).toContainText('7,891');
  await expect(figures.nth(2)).toContainText('4,994');
  await expect(figures.nth(3)).toContainText('26,740');
  await expect(page.getByText('vs. previous year')).toHaveCount(0);
  await figures.nth(0).getByText('About this figure').click(); steps.push('Expand overview metric definition');
  await expect(figures.nth(0)).toContainText('Exact value: $375,300');
  await page.getByRole('combobox', { name: 'Period' }).selectOption('3m'); steps.push('Select final three fictional months');
  await expect(figures.nth(0)).toContainText('$128.3K');
  await expect(figures.nth(1)).toContainText('2,623');
  await expect(figures.nth(3)).toContainText('26,740');
  await capture(page, info, 'overview-desktop');

  await page.goto(`/#/organization/northstar/dashboard/${dashboardId}`);
  const chart = page.getByRole('article', { name: 'Revenue over time' });
  await expect(chart).toContainText('Jan–Dec (12 fictional sample months; year unspecified)');
  const disclosure = chart.locator('.insight-context > summary');
  await disclosure.focus(); steps.push('Focus and open meaning disclosure with keyboard');
  await page.keyboard.press('Enter');
  await expect(chart.locator('.insight-context')).toHaveAttribute('open', '');
  await expect(chart).toContainText('no customer data, live connection or refresh timestamp');
  await expect(chart).toContainText('channel filter does not apply');
  await chart.locator('.chart-data > summary').focus(); steps.push('Open exact data with keyboard');
  await page.keyboard.press('Enter');
  await expect(chart.getByRole('table')).toBeVisible();
  await expect(chart.getByRole('row', { name: /Jan.*18,400/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m'); steps.push('Apply commerce-only filter');
  await expect(chart).toContainText('Oct–Dec (3 fictional sample months; year unspecified)');
  await expect(chart.getByRole('row', { name: /Oct.*41,400/ })).toBeVisible();
  await expect(chart.getByRole('row', { name: /Jan.*18,400/ })).toHaveCount(0);
  const channels = page.getByRole('article', { name: 'Orders by channel' });
  await expect(channels).toContainText('5 fictional channels; no dates');
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct'); steps.push('Apply channel-only filter');
  await expect(channels).toContainText('Direct (1 of 5 fictional channels; no dates)');
  await expect(channels).toContainText('Showing Direct: 1,530 orders');
  await expect(chart).toContainText('Oct–Dec (3 fictional sample months');
  await page.getByRole('button', { name: 'Remove Direct filter' }).focus();
  await page.keyboard.press('Enter'); steps.push('Remove channel filter and restore focus');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toBeFocused();
  await expect(channels).toContainText('Highest: Organic search, 1,820 orders');
  const rate = page.getByRole('article', { name: 'Conversion by channel' });
  await expect(rate).toContainText('Combined rate unavailable');
  await expect(rate).not.toContainText('21.3%');
  await capture(page, info, 'interpreted-filtered-desktop');
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('ux9-interpretation-task.json'), JSON.stringify({
    os: process.platform, chromium: page.context().browser()?.version(), viewport: page.viewportSize(),
    scriptedSteps: steps.length, steps, result: 'completed', errors,
    focusAfterRemoval: 'Marketing channel selector', dataSource: 'fixed fictional API fixtures',
    limitations: 'Automation, not human task comprehension, screen-reader spoken output, or production authorization evidence',
  }, null, 2));
});

test('SC-UX9-04/05/06: unavailable answer, tenant switch, dense keyboard index and focus return', async ({ page }, info) => {
  await routeFictionalApi(page, dense);
  await page.goto(`/#/organization/northstar/dashboard/${dashboardId}`);
  await expect(page.locator('.canvas-item')).toHaveCount(12);
  const finder = page.getByRole('combobox', { name: 'Find a visualization' });
  await finder.selectOption(dense.widgets[11]!.id);
  await page.getByRole('button', { name: 'Go to visualization' }).focus();
  await page.keyboard.press('Enter');
  const last = page.getByRole('article', { name: 'Channel details — regional' });
  await expect(last.getByRole('heading', { name: 'Channel details — regional' })).toBeFocused();
  await last.getByRole('button', { name: 'Back to visualization list from Channel details — regional' }).click();
  await expect(page.getByRole('button', { name: '12. Channel details — regional' })).toBeFocused();
  await capture(page, info, 'dense-focus');
  await page.getByRole('combobox', { name: 'Switch organization' }).selectOption('isolated');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toHaveCount(0);
  await page.goto('/#/organization/isolated/dashboard/isolated-dashboard');
  await expect(page.getByRole('heading', { name: 'Isolated insights' })).toBeVisible();
  await expect(page.getByText('Insight unavailable.')).toBeVisible();
  await expect(page.getByText('No value has been inferred.', { exact: false })).toBeVisible();
  await expect(page.getByText('At a glance:')).toHaveCount(0);
  await capture(page, info, 'unavailable-tenant');
});

test('SC-UX9-07: same-origin host keeps interpretation read-only, keyboard-accessible and transparent', async ({ page }, info) => {
  const writes: string[] = [];
  await routeFictionalApi(page, sample, writes);
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('iframe.host-frame');
  await expect(frame.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  const chart = frame.getByRole('article', { name: 'Revenue over time' });
  await chart.locator('.insight-context > summary').focus();
  await page.keyboard.press('Enter');
  await expect(chart.locator('.insight-context')).toHaveAttribute('open', '');
  await chart.locator('.chart-data > summary').click();
  await expect(chart.getByRole('table')).toBeVisible();
  await expect(frame.getByText('Sample freshness unavailable')).toBeVisible();
  await expect(frame.getByRole('button', { name: /Edit dashboard|Save changes|New dashboard/ })).toHaveCount(0);
  await capture(page, info, 'sample-host-embedded');
  expect(writes).toEqual([]);
});

for (const { width, height, label } of [
  { width: 390, height: 844, label: 'mobile-390' },
  { width: 320, height: 900, label: 'narrow-320' },
]) {
  test(`SC-UX9-05: interpretation reflows at ${width}×${height}`, async ({ page }, info) => {
    await routeFictionalApi(page);
    await page.setViewportSize({ width, height });
    await page.goto(`/#/organization/northstar/dashboard/${dashboardId}`);
    const chart = page.getByRole('article', { name: 'Revenue over time' });
    await chart.locator('.insight-context > summary').click();
    await chart.locator('.chart-data > summary').click();
    await noHorizontalOverflow(page);
    await capture(page, info, label);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(scan.violations, JSON.stringify(scan.violations.map(item => item.id))).toEqual([]);
  });
}

test('SC-UX9-05: forced colors retains meaningful text and disclosure focus', async ({ page }, info) => {
  await routeFictionalApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto(`/#/organization/northstar/dashboard/${dashboardId}`);
  const disclosure = page.getByRole('article', { name: 'Revenue over time' }).locator('.insight-context > summary');
  await disclosure.focus();
  await expect(disclosure).toBeFocused();
  await page.keyboard.press('Enter');
  await capture(page, info, 'forced-colors');
  await noHorizontalOverflow(page);
});

test('SC-UX9-05/09: genuine Chromium 200% and 400% tab zoom reveals context without overflow', async ({}, info) => {
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true, viewport: null,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1440,900'],
  });
  const zoomEvidence: unknown[] = [];
  try {
    const page = await context.newPage();
    await routeFictionalApi(page);
    await page.goto(`http://127.0.0.1:5173/#/organization/northstar/dashboard/${dashboardId}`);
    await expect(page.getByRole('article', { name: 'Revenue over time' })).toBeVisible();
    const baseline = await page.evaluate(() => ({ innerWidth, dpr: devicePixelRatio }));
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const setZoom = (factor: number) => worker.evaluate(async factorValue => {
      const tabs = (globalThis as unknown as { chrome: { tabs: {
        query(details: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
        setZoom(id: number, zoom: number): Promise<void>;
        getZoom(id: number): Promise<number>;
      } } }).chrome.tabs;
      const tab = (await tabs.query({})).find(item => item.url?.includes('127.0.0.1:5173/'));
      if (tab?.id === undefined) throw new Error('Native zoom browser tab missing');
      await tabs.setZoom(tab.id, factorValue);
      return tabs.getZoom(tab.id);
    }, factor);
    for (const factor of [2, 4]) {
      const actual = await setZoom(factor);
      await expect.poll(() => page.evaluate(() => innerWidth)).toBeLessThanOrEqual(baseline.innerWidth / factor + 2);
      const measurement = await page.evaluate(() => ({ cssWidth: innerWidth, dpr: devicePixelRatio, scrollWidth: document.documentElement.scrollWidth }));
      expect(actual).toBeCloseTo(factor, 1);
      expect(measurement.dpr / baseline.dpr).toBeCloseTo(factor, 1);
      expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.cssWidth + 1);
      const disclosure = page.getByRole('article', { name: 'Revenue over time' }).locator('.insight-context > summary');
      await disclosure.focus();
      await expect(disclosure).toBeFocused();
      const cdp = await context.newCDPSession(page);
      const frame = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
      const path = info.outputPath(`ux9-native-${factor * 100}-chrome.png`);
      await writeFile(path, Buffer.from(frame.data, 'base64'));
      await info.attach(`ux9-native-${factor * 100}-chrome`, { path, contentType: 'image/png' });
      zoomEvidence.push({ factor, actual, measurement, baseline, chromium: context.browser()?.version(), os: process.platform, focused: true });
    }
  } finally {
    const path = info.outputPath('ux9-native-zoom.json');
    await writeFile(path, JSON.stringify(zoomEvidence, null, 2));
    await info.attach('ux9-native-zoom', { path, contentType: 'application/json' });
    await context.close();
  }
});
