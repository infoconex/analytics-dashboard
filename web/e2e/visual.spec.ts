import { chromium, expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dashboard, DashboardDraft } from '../src/model';

// The real React application renders these fixed demonstration API contracts.
// Captures never depend on an external tenant, a secret, or the mutable test database.
const sampleDashboard: Dashboard = {
  id: 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441', organizationId: 'northstar',
  name: 'Business performance', description: 'Revenue, conversion and customer activity in one view.',
  revision: 1, createdBy: 'demo-owner', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [
    ['Total revenue', 'metric', 'commerce', 'revenue', 'month'],
    ['Revenue over time', 'area', 'commerce', 'revenue', 'month'],
    ['Orders by channel', 'bar', 'channels', 'orders', 'channel'],
    ['Traffic sources', 'donut', 'channels', 'sessions', 'channel'],
    ['Monthly orders', 'line', 'commerce', 'orders', 'month'],
    ['Channel details', 'table', 'channels', 'orders', 'channel'],
  ].map(([title, kind, datasetKey, metricKey, dimensionKey], index) => ({
    id: `806e3063-18e9-4ddb-887a-229198c6dd0${index + 1}`, title,
    kind: kind as Dashboard['widgets'][number]['kind'],
    datasetKey: datasetKey as Dashboard['widgets'][number]['datasetKey'], metricKey, dimensionKey,
  })),
};

const denseDashboard: Dashboard = {
  ...sampleDashboard,
  widgets: [...sampleDashboard.widgets, ...sampleDashboard.widgets.map((widget, index) => ({
    ...widget, id: `806e3063-18e9-4ddb-887a-229198c6dd${String(index + 7).padStart(2, '0')}`,
    title: `${widget.title} — regional`,
  }))],
};

async function fixedDemoApi(page: Page, dashboard = sampleDashboard) {
  const dashboards = [dashboard];
  await page.route('**/api/identity', route => route.fulfill({ json: { userId: 'demo-owner', displayName: 'Demo Analyst' } }));
  await page.route('**/api/organizations', route => route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'owner' }] }));
  await page.route('**/api/organizations/northstar/dashboards', async route => {
    if (route.request().method() === 'POST') {
      const draft = route.request().postDataJSON() as DashboardDraft;
      const created = { ...sampleDashboard, id: '33333333-3333-4333-8333-333333333333', name: draft.name,
        description: draft.description, widgets: draft.widgets, revision: 1 };
      dashboards.unshift(created);
      await route.fulfill({ status: 201, json: created });
    } else await route.fulfill({ json: dashboards });
  });
  await page.route('**/api/organizations/northstar/dashboards/*', async route => {
    const id = route.request().url().split('/').pop();
    const found = dashboards.find(item => item.id === id);
    if (!found) return route.fulfill({ status: 404, body: '' });
    if (route.request().method() === 'PUT') {
      const draft = route.request().postDataJSON() as DashboardDraft;
      Object.assign(found, { ...draft, revision: found.revision + 1 });
    }
    return route.fulfill({ json: found });
  });
}

async function capture(page: Page, testInfo: TestInfo, label: string) {
  // Full-page screenshots otherwise paint fixed/sticky controls at the current
  // scroll offset after the preceding interaction instead of their natural top.
  if (!label.includes('dialog') && !label.includes('keyboard-focus')) await page.evaluate(() => window.scrollTo(0, 0));
  const path = testInfo.outputPath(`${label}.png`);
  await page.screenshot({ path, fullPage: !label.includes('dialog') && !label.includes('keyboard-focus'), animations: 'disabled' });
  await testInfo.attach(label, { path, contentType: 'image/png' });
}

async function assertNoDocumentOverflow(page: Page, width: number) {
  const layout = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll<HTMLElement>('body *')]
      .filter(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.width && (bounds.right > window.innerWidth + 1 || bounds.left < -1)
          && getComputedStyle(element).position !== 'fixed';
      })
      .slice(0, 12).map(element => ({
        tag: element.tagName.toLowerCase(), className: typeof element.className === 'string' ? element.className : '',
        right: Math.round(element.getBoundingClientRect().right),
        width: Math.round(element.getBoundingClientRect().width),
      })),
  }));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
    message: `Persistent horizontal overflow at ${width}px (initial width ${layout.pageWidth}): ${JSON.stringify(layout.overflowing)}`,
    timeout: 5_000,
  }).toBeLessThanOrEqual(width);
}

test.use({ video: 'on', trace: 'on', reducedMotion: 'reduce' });

test('desktop UX journey captures all primary states using fixed sample data', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await fixedDemoApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await capture(page, testInfo, '01-workspace-desktop');

  await page.goto('/#/dashboards');
  await expect(page.getByRole('heading', { name: 'Dashboards', exact: true })).toBeVisible();
  await capture(page, testInfo, '02-library-desktop');

  await page.goto('/#/explore');
  await expect(page.getByRole('heading', { name: 'Turn data into a story.' })).toBeVisible();
  await capture(page, testInfo, '03-explore-desktop');

  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await capture(page, testInfo, '04-consumption-desktop');
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await capture(page, testInfo, '05-active-filters-desktop');
  await page.getByRole('button', { name: 'Reset filters' }).click();

  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await capture(page, testInfo, '06-composition-desktop');
  await page.getByRole('button', { name: /Add visualization/ }).click();
  await expect(page.getByRole('dialog', { name: 'Configure visualization' })).toBeVisible();
  await capture(page, testInfo, '07-visualization-dialog-desktop');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await page.getByRole('button', { name: 'New dashboard', exact: true }).click();
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('New sample workspace');
  await page.getByRole('button', { name: 'Create dashboard' }).click();
  await expect(page.getByText('No visualizations yet')).toBeVisible();
  await capture(page, testInfo, '08-empty-dashboard-desktop');

  await page.route('**/api/organizations', route => route.fulfill({ status: 503, body: '' }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Request failed (503)');
  await expect(page.getByRole('heading', { name: 'Workspace unavailable' })).toBeVisible();
  await capture(page, testInfo, '09-error-desktop');
});

test('mobile journey captures responsive navigation, filters and creator modal', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixedDemoApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await capture(page, testInfo, '10-workspace-mobile');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Explore' }).click();
  await capture(page, testInfo, '11-explore-mobile');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Dashboards' }).click();
  await capture(page, testInfo, '12-library-mobile');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await capture(page, testInfo, '13-consumption-mobile');
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Social');
  await capture(page, testInfo, '14-active-filters-mobile');
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await capture(page, testInfo, '15-composition-mobile');
  await page.getByRole('button', { name: /Add visualization/ }).click();
  await capture(page, testInfo, '16-visualization-dialog-mobile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('tablet, narrow reflow and forced-colors views preserve readable sample data', async ({ page }, testInfo) => {
  await fixedDemoApi(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await capture(page, testInfo, '17-consumption-tablet');

  await page.setViewportSize({ width: 320, height: 900 });
  await assertNoDocumentOverflow(page, 320);
  await capture(page, testInfo, '18-consumption-reflow-320');

  await page.getByText('View data table').first().click();
  await capture(page, testInfo, '19-chart-data-reflow-320');

  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await capture(page, testInfo, '20-forced-colors-320');
});

test('dense dashboard preserves reading order and supports keyboard jump navigation', async ({ page }, testInfo) => {
  await fixedDemoApi(page, denseDashboard);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();

  const cards = page.locator('.canvas-item');
  await expect(cards).toHaveCount(12);
  await expect(page.getByRole('navigation', { name: 'Jump to visualization' })).toHaveCount(0);
  const index = page.locator('details.dashboard-index');
  await index.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(index).toHaveAttribute('open', '');
  await expect(page.getByRole('navigation', { name: 'Jump to visualization' })).toBeVisible();
  await capture(page, testInfo, '21-dense-dashboard-desktop');

  const jump = page.getByRole('button', { name: /12\. Channel details — regional/ });
  await jump.focus();
  await page.keyboard.press('Enter');
  const lastHeading = cards.last().getByRole('heading', { name: 'Channel details — regional' });
  await expect(lastHeading).toBeFocused();
  await capture(page, testInfo, '22-dense-keyboard-focus');

  const headings = await cards.locator('h2.widget-title').allTextContents();
  expect(headings).toEqual(denseDashboard.widgets.map(widget => widget.title));
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations).toEqual([]);

  await page.setViewportSize({ width: 768, height: 1024 });
  await capture(page, testInfo, '23-dense-dashboard-tablet');
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoDocumentOverflow(page, 390);
  await capture(page, testInfo, '24-dense-dashboard-mobile');
  await page.setViewportSize({ width: 320, height: 900 });
  await assertNoDocumentOverflow(page, 320);
  await capture(page, testInfo, '25-dense-reflow-320');
  await cards.first().getByText('View data table').press('Enter');
  await expect(cards.first().getByRole('table', { name: /Total revenue/ })).toBeVisible();
  await capture(page, testInfo, '26-dense-data-table-320');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await capture(page, testInfo, '27-dense-forced-colors-320');
});

test('compact metrics do not stretch to match chart cards and short dashboards avoid an index', async ({ page }) => {
  await fixedDemoApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await expect(page.locator('.dashboard-index')).toHaveCount(0);
  const sizes = await page.locator('.canvas-item').evaluateAll(items => items.slice(0, 2).map(item => item.getBoundingClientRect().height));
  expect(sizes[0]).toBeLessThan(sizes[1] - 45);
  const widths = await page.locator('.canvas-item').evaluateAll(items => items.slice(0, 2).map(item => item.getBoundingClientRect().width));
  expect(widths[0]).toBeGreaterThan(widths[1] * 1.8);
});

test('chart data alternative exposes an announced keyboard channel selection', async ({ page }) => {
  await fixedDemoApi(page);
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  const bar = page.getByRole('article', { name: 'Orders by channel' });
  await expect(bar.getByRole('img', { name: /Channel selection is also available from the data table/ })).toBeVisible();
  await bar.getByText('View data table').focus();
  await page.keyboard.press('Enter');
  const category = bar.getByRole('button', { name: 'Show only Direct' });
  await category.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Dashboard filter changes' })).toContainText('Direct');
  await expect(bar.getByRole('button', { name: 'Show all channels instead of Direct' })).toHaveAttribute('aria-pressed', 'true');
  await expect(bar.getByRole('heading', { name: 'Orders by channel' })).toBeVisible();
});

test('dense keyboard journey returns to the index and compares filtered chart facts with exact table values', async ({ page }, testInfo) => {
  await fixedDemoApi(page, denseDashboard);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();

  const index = page.locator('details.dashboard-index');
  await index.locator('summary').focus();
  await page.keyboard.press('Enter');
  const lastEntry = index.getByRole('button', { name: '12. Channel details — regional' });
  for (let step = 0; step < 12; step++) await page.keyboard.press('Tab');
  await expect(lastEntry).toBeFocused();
  await page.keyboard.press('Enter');
  const lastCard = page.getByRole('article', { name: 'Channel details — regional' });
  await expect(lastCard.getByRole('heading', { name: 'Channel details — regional' })).toBeFocused();

  const returnAction = lastCard.getByRole('button', { name: 'Back to visualization list from Channel details — regional' });
  // From a focused heading, traverse the scrollable table, its five row
  // selection buttons and then the local return action with actual Tab keys.
  for (let step = 0; step < 7; step++) await page.keyboard.press('Tab');
  await expect(returnAction).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(lastEntry).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(index.getByRole('button', { name: '11. Monthly orders — regional' })).toBeFocused();
  await capture(page, testInfo, '28-return-to-index-desktop');

  const lastTable = lastCard.getByRole('table', { name: /Channel details — regional/ });
  await expect(lastTable.getByRole('columnheader', { name: 'orders' })).toBeVisible();
  await expect(lastTable.getByRole('row', { name: /Organic search.*1,820/ })).toBeVisible();
  await expect(lastTable.getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
  await capture(page, testInfo, '35-exact-native-table-desktop');

  const bar = page.getByRole('article', { name: 'Orders by channel', exact: true });
  const metricWidth = await page.locator('.canvas-item-metric .widget-tile').first().evaluate(element => element.getBoundingClientRect().width);
  const metricReturnWidth = await page.locator('.canvas-item-metric .widget-return').first().evaluate(element => element.getBoundingClientRect().width);
  expect(metricReturnWidth).toBeGreaterThan(metricWidth * 0.8);
  await expect(bar.getByText('At a glance:')).toBeVisible();
  await expect(bar.locator('.chart-insight')).toContainText('Highest: Organic search, 1,820 orders across 5 channels.');
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await expect(page.getByRole('status', { name: 'Dashboard filter changes' })).toContainText('Direct');
  await expect(bar.locator('.chart-insight')).toContainText('Showing Direct: 1,530 orders (1 channel).');
  await expect(bar.locator('details.chart-data summary')).toContainText('(1 record)');
  await bar.getByText('View data table').focus();
  await page.keyboard.press('Enter');
  await expect(bar.getByRole('table', { name: /Orders by channel/ }).getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
  await capture(page, testInfo, '29-filtered-chart-insight-and-table');
  await expect(lastTable.getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Direct filter' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toBeFocused();
  await expect(page.getByRole('status', { name: 'Dashboard filter changes' })).toHaveText('Showing all sample records.');
  await capture(page, testInfo, '36-filter-removal-focus-desktop');
  await expect(bar.locator('.chart-insight')).toContainText('Highest: Organic search');
  await expect(bar.getByRole('rowheader', { name: 'Organic search' })).toBeVisible();

  const timeSeries = page.getByRole('article', { name: 'Revenue over time', exact: true });
  await expect(timeSeries.locator('.chart-insight')).toContainText('From Jan ($18,400) to Dec ($48,300): increased across 12 months.');
  const tree = await index.ariaSnapshot();
  expect(tree).toContain('navigation "Jump to visualization"');
  expect(tree).toContain('12. Channel details — regional');
  const cardTree = await bar.ariaSnapshot();
  expect(cardTree).toContain('At a glance:');
  expect(cardTree).toContain('table');

  await page.setViewportSize({ width: 768, height: 1024 });
  await assertNoDocumentOverflow(page, 768);
  await capture(page, testInfo, '30-chart-insights-tablet');
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoDocumentOverflow(page, 390);
  await capture(page, testInfo, '31-chart-insights-mobile');
  await page.setViewportSize({ width: 320, height: 900 });
  await assertNoDocumentOverflow(page, 320);
  // Scope the WCAG 2.2 AA target inspection to the dense consumer workflow.
  // A full site-wide target inventory (including spacing exceptions) remains open.
  for (const locator of [
    index.getByRole('button').first(),
    lastCard.getByRole('button', { name: /Back to visualization list/ }),
    lastCard.getByRole('button', { name: 'Show only Direct' }),
    page.getByRole('combobox', { name: 'Marketing channel' }),
  ]) {
    const bounds = await locator.boundingBox();
    expect(bounds, 'Dense consumer target must have a measurable box').not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(24);
    expect(bounds!.height).toBeGreaterThanOrEqual(24);
  }
  await capture(page, testInfo, '32-chart-insights-reflow-320');
  await lastCard.getByRole('button', { name: /Back to visualization list/ }).focus();
  await expect(lastCard.getByRole('button', { name: /Back to visualization list/ })).toBeFocused();
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await capture(page, testInfo, '33-chart-insights-forced-colors');
});

test('browser zoom attempts report genuine viewport changes rather than treating CSS reflow as zoom', async ({ page }, testInfo) => {
  await fixedDemoApi(page, denseDashboard);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  const baseline = await page.evaluate(() => ({ width: window.innerWidth, dpr: window.devicePixelRatio }));
  const observed: { target: number; width: number; dpr: number; achieved: boolean }[] = [];

  for (const target of [2, 4]) {
    let state = baseline;
    for (let attempt = 0; attempt < 14; attempt++) {
      await page.keyboard.press('Control+Equal');
      state = await page.evaluate(() => ({ width: window.innerWidth, dpr: window.devicePixelRatio }));
      if (state.width <= baseline.width / target + 2 && state.dpr >= baseline.dpr * (target - 0.1)) break;
      // The headless browser may not implement Chrome's browser-UI zoom shortcut.
      if (attempt === 1 && state.width === baseline.width && state.dpr === baseline.dpr) break;
    }
    const achieved = state.width <= baseline.width / target + 2
      && state.dpr >= baseline.dpr * (target - 0.1);
    observed.push({ target, ...state, achieved });
    if (achieved) {
      await assertNoDocumentOverflow(page, state.width);
      await capture(page, testInfo, `34-actual-browser-zoom-${target * 100}`);
    }
    if (!achieved && target === 2) break;
  }
  await page.keyboard.press('Control+0');
  console.log(`[UX-4d browser zoom evidence] ${JSON.stringify({ baseline, observed })}`);
  await testInfo.attach('actual-browser-zoom-attempt.json', {
    body: JSON.stringify({ baseline, observed, note: 'Only a changed CSS viewport AND devicePixelRatio count as actual zoom evidence. Failed targets are untested.' }, null, 2),
    contentType: 'application/json',
  });
  expect(observed).toHaveLength(observed[0]?.achieved ? 2 : 1);
});

// Uses Chromium's own chrome.tabs.setZoom/getZoom API, not a simulated narrow
// viewport, device metrics override, CSS zoom, or CDP page scale. The bundled
// Playwright Chromium loads a local, inert Manifest V3 extension only for this
// test. This is browser-native zoom automation, NOT hands-on user testing.
interface ChromeZoomTabs {
  query(details: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
  setZoom(id: number, factor: number): Promise<void>;
  getZoom(id: number): Promise<number>;
  getZoomSettings(id: number): Promise<{ mode?: string; scope?: string }>;
}

async function readBrowserZoom(worker: import('@playwright/test').Worker, target: number | null) {
  return worker.evaluate(async ({ factor, origin }) => {
    const tabs = (globalThis as unknown as { chrome: { tabs: ChromeZoomTabs } }).chrome.tabs;
    const tab = (await tabs.query({})).find(candidate => candidate.url?.startsWith(origin));
    if (tab?.id === undefined) throw new Error('The sample dashboard browser tab is not available to the zoom driver.');
    if (factor !== null) await tabs.setZoom(tab.id, factor);
    return { factor: await tabs.getZoom(tab.id), settings: await tabs.getZoomSettings(tab.id) };
  }, { factor: target, origin: 'http://127.0.0.1:5173/' });
}

async function zoomPageMetrics(page: Page) {
  return page.evaluate(() => {
    const focused = document.activeElement as HTMLElement | null;
    const rect = focused?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      horizontalDocumentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      focus: {
        tag: focused?.tagName.toLowerCase() ?? null,
        name: focused?.getAttribute('aria-label') ?? focused?.textContent?.trim().slice(0, 110) ?? null,
        visibleWithinViewport: Boolean(rect && rect.width > 0 && rect.height > 0
          && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth),
      },
    };
  });
}

test('browser-native zoom at 200% and 400% preserves the 12-widget keyboard and filter journey', async ({}, testInfo) => {
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, viewport: null,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1280,900'],
  });
  const observations: Array<Record<string, unknown>> = [];
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await fixedDemoApi(page, denseDashboard);
    await page.goto('http://127.0.0.1:5173/#/dashboards');
    await page.getByRole('button', { name: /Open Business performance/ }).click();
    await expect(page.locator('.canvas-item')).toHaveCount(12);

    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const baselineBrowserZoom = await readBrowserZoom(worker, null);
    const baseline = await zoomPageMetrics(page);
    expect(baselineBrowserZoom.factor).toBeCloseTo(1, 1);
    observations.push({ target: 100, browserZoom: baselineBrowserZoom, metrics: baseline });
    const baselineScreenshot = testInfo.outputPath('37-native-zoom-baseline-100.png');
    await page.screenshot({ path: baselineScreenshot, animations: 'disabled', scale: 'device' });
    await testInfo.attach('37-native-zoom-baseline-100', { path: baselineScreenshot, contentType: 'image/png' });

    for (const target of [2, 4]) {
      const browserZoom = await readBrowserZoom(worker, target);
      await expect.poll(async () => (await zoomPageMetrics(page)).innerWidth).toBeLessThanOrEqual(baseline.innerWidth / target + 2);
      const metrics = await zoomPageMetrics(page);
      const genuineZoom = Math.abs(browserZoom.factor - target) < 0.02
        && Math.abs(metrics.devicePixelRatio / baseline.devicePixelRatio - target) < 0.1
        && metrics.innerWidth <= baseline.innerWidth / target + 2
        && browserZoom.settings.mode === 'automatic';
      observations.push({ target: target * 100, genuineZoom, browserZoom, metrics,
        environment: { os: process.platform, chromium: context.browser()?.version(), runner: 'CI Chromium, headless with browser tab extension API' } });
      expect(genuineZoom, 'Only confirmed browser-native tab zoom plus viewport and DPR changes count').toBe(true);
      await assertNoDocumentOverflow(page, metrics.innerWidth);

      const index = page.locator('details.dashboard-index');
      if (!(await index.evaluate(element => (element as HTMLDetailsElement).open))) {
        await index.locator('summary').focus();
        await page.keyboard.press('Enter');
      }
      await index.locator('summary').focus();
      for (let step = 0; step < 12; step++) await page.keyboard.press('Tab');
      const entry = index.getByRole('button', { name: '12. Channel details — regional' });
      await expect(entry).toBeFocused();
      await page.keyboard.press('Enter');
      const lastCard = page.getByRole('article', { name: 'Channel details — regional' });
      await expect(lastCard.getByRole('heading', { name: 'Channel details — regional' })).toBeFocused();
      await expect(lastCard.getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
      for (let step = 0; step < 7; step++) await page.keyboard.press('Tab');
      await expect(lastCard.getByRole('button', { name: 'Back to visualization list from Channel details — regional' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(entry).toBeFocused();
      const indexScreenshot = testInfo.outputPath(`38-native-zoom-${target * 100}-index-focus.png`);
      await page.screenshot({ path: indexScreenshot, animations: 'disabled', scale: 'device' });
      await testInfo.attach(`38-native-zoom-${target * 100}-index-focus`, { path: indexScreenshot, contentType: 'image/png' });

      const bar = page.getByRole('article', { name: 'Orders by channel', exact: true });
      if (!(await bar.getByRole('table').isVisible())) {
        await bar.getByText('View data table').focus();
        await page.keyboard.press('Enter');
      }
      await expect(bar.getByRole('row', { name: /Organic search.*1,820/ })).toBeVisible();
      const channel = page.getByRole('combobox', { name: 'Marketing channel' });
      await channel.selectOption('Direct');
      await expect(page.getByRole('status', { name: 'Dashboard filter changes' })).toContainText('Direct');
      await expect(bar.getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
      await expect(page.getByRole('article', { name: 'Traffic sources', exact: true })
        .getByRole('button', { name: 'Show all channels instead of Direct' })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Remove Direct filter' }).focus();
      await page.keyboard.press('Enter');
      await expect(channel).toBeFocused();
      await expect(page.getByRole('status', { name: 'Dashboard filter changes' })).toHaveText('Showing all sample records.');
      const recovered = await zoomPageMetrics(page);
      expect(recovered.focus.visibleWithinViewport).toBe(true);
      observations.push({ target: target * 100, postFilterRecovery: recovered });
      const filterScreenshot = testInfo.outputPath(`39-native-zoom-${target * 100}-filter-focus.png`);
      await page.screenshot({ path: filterScreenshot, animations: 'disabled', scale: 'device' });
      await testInfo.attach(`39-native-zoom-${target * 100}-filter-focus`, { path: filterScreenshot, contentType: 'image/png' });
    }
    await readBrowserZoom(worker, 1);
  } finally {
    const evidencePath = testInfo.outputPath('native-browser-zoom-evidence.json');
    await writeFile(evidencePath, JSON.stringify({
      note: 'Programmatic real Chromium tab zoom; not manual keyboard zoom or actual screen-reader speech.',
      observations,
    }, null, 2));
    await testInfo.attach('native-browser-zoom-evidence.json', { path: evidencePath, contentType: 'application/json' });
    await context.close();
  }
});
