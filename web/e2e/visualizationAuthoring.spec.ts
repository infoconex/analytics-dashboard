import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dashboard, DashboardDraft } from '../src/model';

const dashboardId = '72222222-2222-4222-8222-222222222222';
const initial: Dashboard = {
  id: dashboardId, organizationId: 'northstar', revision: 1,
  name: 'Fictional analytics', description: 'Authoring walkthrough with synthetic data.',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', createdBy: 'demo-owner',
  widgets: [],
};

/** Entirely in-memory fictional API: independent state for each test, no customer transport. */
async function sampleApi(page: Page, role: 'owner' | 'viewer' = 'owner') {
  let saved: Dashboard = structuredClone(initial);
  const requests: string[] = [];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    requests.push(`${method} ${path}`);
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'demo-owner', displayName: 'Demo Analyst' } });
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role }] });
    if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [saved] });
    if (path === `/api/organizations/northstar/dashboards/${dashboardId}`) {
      if (method === 'PUT' && role === 'owner') {
        const draft = route.request().postDataJSON() as DashboardDraft & { expectedRevision: number };
        if (draft.expectedRevision !== saved.revision) return route.fulfill({ status: 409 });
        saved = { ...saved, ...draft, revision: saved.revision + 1 };
      }
      return route.fulfill({ json: saved });
    }
    return route.fulfill({ status: 403 });
  });
  return { requests, saved: () => saved };
}

async function openEditor(page: Page) {
  await page.goto(`/#/organization/northstar/dashboard/${dashboardId}`);
  await expect(page.getByRole('heading', { name: 'Fictional analytics' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('button', { name: /Add visualization/ }).click();
  await expect(page.getByRole('dialog', { name: 'Configure visualization' })).toBeVisible();
}

async function image(page: Page, info: TestInfo, label: string) {
  const path = info.outputPath(`ux15-${label}.png`);
  // Capture the chart itself, not a transient hover tooltip left by a pointer.
  await page.mouse.move(10, 10);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(label, { path, contentType: 'image/png' });
  const measurements = await page.evaluate(() => ({
    platform: navigator.platform, userAgent: navigator.userAgent,
    cssViewport: { width: innerWidth, height: innerHeight },
    dpr: devicePixelRatio, visualViewportScale: visualViewport?.scale ?? null,
    overflow: document.documentElement.scrollWidth - innerWidth,
    focused: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.slice(0, 90),
  }));
  const measurementFile = info.outputPath(`ux15-${label}-measurements.json`);
  await writeFile(measurementFile, JSON.stringify({ ...measurements, operatingSystem: `${platform()} ${release()}`,
    browserVersion: page.context().browser()?.version(), forcedColors: await page.evaluate(() => matchMedia('(forced-colors: active)').matches),
  }, null, 2));
  await info.attach(`${label}-measurements`, { path: measurementFile, contentType: 'application/json' });
  expect(measurements.overflow).toBeLessThanOrEqual(1);
}

test('author pie, histogram, scatter; preview, edit, save and revisit exact sample rows', async ({ page }, info) => {
  // Multiple full-size original captures plus round trips exceed the generic
  // 30-second single-test limit on slower CI runners; assertions remain strict.
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const api = await sampleApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  const dialog = page.getByRole('dialog', { name: 'Configure visualization' });

  await dialog.getByRole('button', { name: /Pie chart/ }).click();
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Orders by channel pie');
  await dialog.getByRole('combobox', { name: 'Dataset' }).selectOption('channels');
  await expect(dialog.getByRole('region', { name: 'Live visualization preview' })).toContainText('Organic search');
  await expect(dialog.locator('.recharts-pie-sector')).toHaveCount(5);
  await dialog.getByText('View data table').click();
  await expect(dialog.getByRole('table')).toContainText('1,820');
  await image(page, info, '01-pie-preview-desktop');
  await dialog.getByRole('button', { name: 'Add to dashboard' }).click();

  await page.getByRole('button', { name: /Add visualization/ }).click();
  await dialog.getByRole('button', { name: /Histogram/ }).click();
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Revenue distribution');
  await expect(dialog.getByText('12 observed fictional months')).toBeVisible();
  await expect(dialog.locator('.recharts-bar-rectangle')).toHaveCount(4);
  await dialog.locator('.widget-chart').scrollIntoViewIfNeeded();
  await image(page, info, '02-histogram-preview-desktop');
  await dialog.getByRole('button', { name: 'Add to dashboard' }).click();

  await page.getByRole('button', { name: /Add visualization/ }).click();
  await dialog.getByRole('button', { name: /Scatter plot/ }).click();
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Orders versus revenue');
  await expect(dialog.getByRole('combobox', { name: 'Horizontal measure' })).toHaveValue('orders');
  await dialog.getByRole('combobox', { name: 'Vertical measure' }).selectOption('orders');
  await expect(dialog.getByRole('combobox', { name: 'Horizontal measure' })).toHaveValue('revenue');
  await dialog.getByRole('combobox', { name: 'Horizontal measure' }).selectOption('customers');
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Orders versus customers');
  await expect(dialog.locator('.recharts-scatter-symbol')).toHaveCount(12);
  await dialog.getByText('View data table').click();
  await expect(dialog.getByRole('table')).toContainText('280');
  await expect(dialog.getByRole('table')).toContainText('412');
  await image(page, info, '03-scatter-preview-desktop');
  await dialog.getByRole('button', { name: 'Add to dashboard' }).click();

  await expect(page.locator('.canvas-item')).toHaveCount(3);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Orders by channel pie' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revenue distribution' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orders versus customers' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Orders by channel pie' }).locator('.recharts-pie-sector')).toHaveCount(5);
  await image(page, info, '04-saved-three-visualizations-desktop');

  const pie = page.getByRole('article', { name: 'Orders by channel pie' });
  await pie.getByRole('button', { name: 'Show only Direct' }).first().click();
  await expect(pie.locator('.recharts-pie-sector')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Remove Direct filter', exact: true })).toBeVisible();
  await pie.getByText('View data table').click();
  await expect(pie.getByRole('table')).toContainText('1,530');
  await expect(pie.getByRole('table')).not.toContainText('1,820');
  await expect(page.getByRole('article', { name: 'Revenue distribution' })).toContainText('12 observed fictional months');
  await image(page, info, '04b-pie-filter-independent-of-commerce');
  await test.step('remove one channel filter and recover the original pie rows', async () => {
    await page.getByRole('button', { name: 'Remove Direct filter', exact: true }).click({ timeout: 8_000 });
    await expect(pie.getByRole('table')).toContainText('1,820');
  });

  await test.step('reenter editing, update scatter and revisit the saved definition', async () => {
    await page.getByRole('button', { name: 'Edit dashboard' }).click({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Edit Orders versus customers' }).click({ timeout: 8_000 });
    await dialog.getByRole('textbox', { name: 'Title' }).fill('Customers and orders relationship');
    await dialog.getByRole('button', { name: 'Update visualization' }).click({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save changes' }).click({ timeout: 8_000 });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Customers and orders relationship' })).toBeVisible();
  });
  expect(api.saved().widgets.map(widget => widget.kind)).toEqual(['pie', 'histogram', 'scatter']);
  expect(api.saved().widgets[2]?.dimensionKey).toBe('customers');
  expect(api.saved().widgets[2]?.title).toBe('Customers and orders relationship');
  expect(errors).toEqual([]);
});

test('refuses a misleading conversion pie; owner can recover, viewer cannot author', async ({ page }, info) => {
  await sampleApi(page);
  await openEditor(page);
  const dialog = page.getByRole('dialog', { name: 'Configure visualization' });
  await dialog.getByRole('button', { name: /Pie chart/ }).click();
  await dialog.getByRole('combobox', { name: 'Dataset' }).selectOption('channels');
  await dialog.getByRole('combobox', { name: 'Metric' }).selectOption('conversion');
  await expect(dialog.getByRole('alert')).toContainText('cannot be summed');
  await expect(dialog.getByText('Insight unavailable.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Add to dashboard' })).toBeDisabled();
  await dialog.getByRole('alert').scrollIntoViewIfNeeded();
  await image(page, info, '05-invalid-rate-recovery');
  await dialog.getByRole('combobox', { name: 'Metric' }).selectOption('sessions');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Add to dashboard' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.canvas-item')).toHaveCount(0);

  const readonly = await page.context().newPage();
  const viewerApi = await sampleApi(readonly, 'viewer');
  await readonly.goto(`/#/organization/northstar/dashboard/${dashboardId}`);
  await expect(readonly.getByRole('heading', { name: 'Fictional analytics' })).toBeVisible();
  await expect(readonly.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  expect(viewerApi.requests.every(request => request.startsWith('GET'))).toBe(true);
  await readonly.close();
});

test('preview reflows at 390 and 320, preserves keyboard focus and forced colors', async ({ page }, info) => {
  await sampleApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  const dialog = page.getByRole('dialog', { name: 'Configure visualization' });
  await dialog.getByRole('button', { name: /Scatter plot/ }).click();
  await dialog.getByRole('combobox', { name: 'Horizontal measure' }).focus();
  await expect(dialog.getByRole('combobox', { name: 'Horizontal measure' })).toBeFocused();
  await image(page, info, '06-scatter-preview-mobile-focus');
  await page.setViewportSize({ width: 320, height: 900 });
  await dialog.locator('.widget-chart').scrollIntoViewIfNeeded();
  await image(page, info, '07-scatter-preview-narrow');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await dialog.locator('.widget-chart').scrollIntoViewIfNeeded();
  const scatterColor = await dialog.locator('.recharts-scatter-symbol').first().evaluate(symbol => {
    const probe = document.createElement('span');
    probe.style.color = 'Highlight';
    document.body.append(probe);
    const result = { actual: getComputedStyle(symbol).fill, expected: getComputedStyle(probe).color };
    probe.remove();
    return result;
  });
  expect(scatterColor.actual).toBe(scatterColor.expected);
  await image(page, info, '08-scatter-preview-forced-colors');
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations).toEqual([]);
});

test('genuine Chromium 200% and 400% tab zoom preserves the creator dialog and its preview', async ({}, info) => {
  test.setTimeout(90_000);
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true, viewport: null,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1440,900'],
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await sampleApi(page);
    await page.goto(`http://127.0.0.1:5173/#/organization/northstar/dashboard/${dashboardId}`);
    await expect(page.getByRole('heading', { name: 'Fictional analytics' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit dashboard' }).click();
    await page.getByRole('button', { name: /Add visualization/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Configure visualization' });
    await dialog.getByRole('button', { name: /Scatter plot/ }).click();
    await expect(dialog.locator('.recharts-scatter-symbol')).toHaveCount(12);

    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const nativeZoom = (factor: number) => worker.evaluate(async requested => {
      const tabs = (globalThis as unknown as { chrome: { tabs: {
        query(query: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
        setZoom(id: number, value: number): Promise<void>;
        getZoom(id: number): Promise<number>;
      } } }).chrome.tabs;
      const tab = (await tabs.query({})).find(item => item.url?.startsWith('http://127.0.0.1:5173/'));
      if (tab?.id === undefined) throw new Error('The authoring tab was not available to the test-only zoom extension');
      await tabs.setZoom(tab.id, requested);
      return tabs.getZoom(tab.id);
    }, factor);
    const metrics = () => page.evaluate(() => ({
      cssViewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio,
      visualViewportScale: visualViewport?.scale ?? null,
      overflow: document.documentElement.scrollWidth - innerWidth,
      focused: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.slice(0, 90),
    }));
    const baseline = await metrics();
    expect(await nativeZoom(1)).toBeCloseTo(1, 1);
    for (const factor of [2, 4]) {
      const actual = await nativeZoom(factor);
      await expect.poll(async () => (await metrics()).cssViewport.width)
        .toBeLessThanOrEqual(baseline.cssViewport.width / factor + 2);
      const observed = await metrics();
      expect(actual).toBeCloseTo(factor, 1);
      expect(observed.dpr / baseline.dpr).toBeCloseTo(factor, 1);
      expect(observed.overflow).toBeLessThanOrEqual(1);
      await expect(dialog.getByRole('button', { name: 'Add to dashboard' })).toBeVisible();
      const horizontalMeasure = dialog.getByRole('combobox', { name: 'Horizontal measure' });
      await horizontalMeasure.scrollIntoViewIfNeeded();
      await horizontalMeasure.focus();
      await expect(horizontalMeasure).toBeFocused();
      await expect(dialog.locator('.recharts-scatter-symbol')).toHaveCount(12);
      const focusedUnobscured = await horizontalMeasure.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const center = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        return center === element || element.contains(center);
      });
      expect(focusedUnobscured, `The selected horizontal measure must not be hidden at native ${factor * 100}% zoom`).toBe(true);
      const captureMeasurements = await metrics();

      // CDP captures the actual browser surface at native tab zoom; Playwright
      // CSS screenshots may normalize scale and cannot establish genuine zoom.
      const client = await context.newCDPSession(page);
      const raw = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
      await client.detach();
      const label = `ux15-${factor === 2 ? '11' : '12'}-native-${factor * 100}-creator`;
      const picture = info.outputPath(`${label}.png`);
      await writeFile(picture, Buffer.from(raw.data, 'base64'));
      await info.attach(label, { path: picture, contentType: 'image/png' });
      const measurementFile = info.outputPath(`${label}-measurements.json`);
      await writeFile(measurementFile, JSON.stringify({ ...captureMeasurements,
        operatingSystem: `${platform()} ${release()}`, browserVersion: context.browser()?.version(),
        nativeZoom: actual, focusedUnobscured, baseline,
        method: 'Chromium chrome.tabs.setZoom/getZoom and CDP browser-surface capture',
      }, null, 2));
      await info.attach(`${label}-measurements`, { path: measurementFile, contentType: 'application/json' });
    }
    await nativeZoom(1);
  } finally {
    await context.close();
  }
});

test('new chart definitions remain read-only in the same-origin embed', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] });
    if (path.endsWith(`/dashboards/${dashboardId}`)) return route.fulfill({ json: { ...initial, widgets: [
      { id: 'w1', kind: 'pie', title: 'Channel share', datasetKey: 'channels', metricKey: 'orders', dimensionKey: 'channel' },
      { id: 'w2', kind: 'histogram', title: 'Revenue distribution', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' },
      { id: 'w3', kind: 'scatter', title: 'Revenue and orders', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'orders' },
    ] } });
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'demo-viewer', displayName: 'Demo Viewer' } });
    return route.fulfill({ status: 403 });
  });
  await page.goto(`/embed.html#/organization/northstar/dashboard/${dashboardId}`);
  for (const title of ['Channel share', 'Revenue distribution', 'Revenue and orders'])
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await expect(page.locator('.recharts-scatter-symbol')).toHaveCount(12);
});

test('guided Explore exposes valid scatter axes and exact fictional values', async ({ page }, info) => {
  await sampleApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/explore');
  await page.getByRole('combobox', { name: 'Chart type' }).selectOption('scatter');
  await page.getByRole('combobox', { name: 'Horizontal measure' }).selectOption('customers');
  await expect(page.locator('.recharts-scatter-symbol')).toHaveCount(12);
  await expect(page.getByRole('heading', { name: /Underlying sample records/ }).locator('..').getByRole('table')).toContainText('18,400');
  await image(page, info, '09-explore-scatter-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('img', { name: /scatter chart comparing Revenue with Customers/ }).scrollIntoViewIfNeeded();
  await image(page, info, '10-explore-scatter-mobile');
});
