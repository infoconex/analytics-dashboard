import { chromium, expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dashboard, DashboardWidget } from '../src/model';

const dashboardId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const widget = (index: number): DashboardWidget => ({
  id: `996e3063-18e9-4ddb-887a-229198c6dd${String(index).padStart(2, '0')}`,
  title: index === 1 ? 'Revenue over time' : index === 2 ? 'Orders by channel' : `Insight ${index}`,
  kind: index === 2 ? 'bar' : 'area', datasetKey: index === 2 ? 'channels' : 'commerce',
  metricKey: index === 2 ? 'orders' : 'revenue', dimensionKey: index === 2 ? 'channel' : 'month',
});
const sample: Dashboard = {
  id: dashboardId, organizationId: 'northstar', name: 'Business performance', description: 'Fictional business insights',
  revision: 1, createdBy: 'sample', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: Array.from({ length: 12 }, (_, index) => widget(index + 1)),
};
const isolated: Dashboard = { ...sample, id: '18ff3350-79f4-4bb8-8d73-9b5e6885df89', organizationId: 'isolated',
  name: 'Isolated report', widgets: [widget(1)] };

async function fixture(page: Page, options: { failedLists?: number; role?: 'owner' | 'viewer'; writes?: string[] } = {}) {
  let requests = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method !== 'GET') {
      options.writes?.push(`${method} ${path}`);
      return route.fulfill({ status: 503, body: 'No writes in fictional task fixture' });
    }
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'sample', displayName: 'Sample Viewer' } });
    if (path === '/api/organizations') return route.fulfill({ json: [
      { id: 'northstar', name: 'Northstar Commerce', role: options.role ?? 'viewer' },
      { id: 'isolated', name: 'Isolated Tenant', role: 'viewer' },
    ] });
    if (path === '/api/organizations/northstar/dashboards') {
      requests++;
      return requests <= (options.failedLists ?? 0) ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fulfill({ json: [sample] });
    }
    if (path === '/api/organizations/isolated/dashboards') return route.fulfill({ json: [isolated] });
    if (path === `/api/organizations/northstar/dashboards/${dashboardId}`) return route.fulfill({ json: sample });
    if (path === `/api/organizations/isolated/dashboards/${isolated.id}`) return route.fulfill({ json: isolated });
    return route.fulfill({ status: 403, body: 'No other data available' });
  });
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`ux11-${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(`ux11-${name}`, { path, contentType: 'image/png' });
}

async function noPageOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(sizes.document, JSON.stringify(sizes)).toBeLessThanOrEqual(sizes.viewport + 1);
}

test.use({ reducedMotion: 'reduce' });

test('SC-UX11-01/02/03/04/05: first value through exact data, independent filters, dense index and saved handoff', async ({ page }, info) => {
  const errors: string[] = [];
  const milestones: string[] = [];
  const scriptedInteractions: string[] = [];
  // A milestone can involve more than one interaction. Neither measure is
  // participant effort, elapsed time, or observed human task success.
  async function interact(label: string, operation: () => Promise<unknown>) {
    await operation();
    scriptedInteractions.push(label);
  }
  page.on('pageerror', error => errors.push(error.message));
  await fixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByText(/fictional sample metrics/)).toBeVisible();
  await interact('Choose revenue question', () => page.getByRole('button', { name: /Explore answer: How is revenue changing/ }).click()); milestones.push('Select a fictional sample question');
  await expect(page.getByRole('heading', { name: 'How is revenue changing?' })).toBeFocused();
  await interact('Open matching chart', () => page.getByRole('button', { name: 'Go to Revenue over time' }).click()); milestones.push('Review question context and jump to chart');
  const chart = page.getByRole('article', { name: 'Revenue over time' });
  await expect(chart.getByRole('heading', { name: 'Revenue over time' })).toBeFocused();
  await interact('Expand metric interpretation', () => chart.getByText('What this means').click()); milestones.push('Inspect definition, source and limits');
  await expect(chart.getByText('Cannot conclude')).toBeVisible();
  await interact('Expand supporting table', () => chart.getByText('View data table').click()); milestones.push('Inspect exact supporting values');
  await expect(chart.getByRole('table').getByText('$18,400')).toBeVisible();
  await interact('Select final three sample months', () => page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m')); milestones.push('Apply final-three-month commerce filter');
  await interact('Select Direct channel', () => page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct')); milestones.push('Apply independent channel filter');
  await expect(chart.getByRole('table').getByText('$41,400')).toBeVisible();
  await expect(chart.getByRole('table').getByText('$18,400')).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Orders by channel' }).locator('.chart-insight')).toContainText('1,530');
  await interact('Clear channel filter', () => page.getByRole('button', { name: 'Clear channel filter' }).click()); milestones.push('Clear channel filter');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('3m');
  await interact('Restore all sample months', () => page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('12m')); milestones.push('Restore full reporting period');
  await expect(page.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('12m');
  await interact('Select visualization twelve', () => page.getByRole('combobox', { name: 'Find a visualization' }).selectOption(widget(12).id));
  await interact('Open visualization twelve', () => page.getByRole('button', { name: 'Go to visualization' }).click()); milestones.push('Find visualization twelve');
  await expect(page.getByRole('heading', { name: 'Insight 12' })).toBeFocused();
  await interact('Return to visualization index', () => page.getByRole('button', { name: 'Back to visualization list from Insight 12' }).click()); milestones.push('Return to exact index entry');
  await expect(page.getByRole('button', { name: '12. Insight 12' })).toBeFocused();
  await interact('Open insight-sharing dialog', () => chart.getByRole('button', { name: 'Share this insight’s context' }).click()); milestones.push('Review insight handoff');
  const dialog = page.getByRole('dialog', { name: 'Share insight context' });
  await interact('Expand optional exact insight context', () => dialog.getByText('Include this insight’s context and exact values').click());
  await expect(dialog.getByRole('textbox', { name: /Context note/ })).toHaveValue(/Jan: \$18,400/);
  await expect(dialog).toContainText('default filters');
  await capture(page, info, 'desktop-handoff');
  await interact('Close sharing dialog', () => dialog.getByRole('button', { name: 'Done' }).click());
  await interact('Reload saved dashboard', () => page.reload()); milestones.push('Revisit saved dashboard with default filters');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('');
  await noPageOverflow(page);
  expect(errors).toEqual([]);
  expect(milestones).toHaveLength(12);
  expect(scriptedInteractions).toHaveLength(15);
  await writeFile(info.outputPath('ux11-customer-journey.json'), JSON.stringify({ os: process.platform,
    chromium: page.context().browser()?.version(), viewport: page.viewportSize(), scriptedMilestones: milestones,
    milestoneCount: milestones.length, scriptedInteractions, interactionCount: scriptedInteractions.length,
    interactionScope: 'Playwright clicks, select changes and a page reload after initial setup; excludes focus assertions and browser-internal steps',
    errors, outcome: 'automated completion',
    limitations: 'Fictional Playwright fixture; interactions are not participant actions, human usability, live-data validation, screen-reader speech or elapsed time',
  }, null, 2));
});

test('SC-UX11-06: dashboard retrieval failure is not misrepresented as empty content; retry restores it', async ({ page }) => {
  await fixture(page, { failedLists: 1 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboards temporarily unavailable' })).toBeVisible();
  await expect(page.getByText('No matching dashboard here yet')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: /Dashboards/ })).toHaveText('Dashboards');
  await expect(page.getByRole('alert')).not.toContainText('Request failed (503)');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('button', { name: /Explore answer: How is revenue changing/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: /Dashboards/ })).toHaveText('Dashboards1');
});

test('SC-UX11-06/07: stale dashboard data is hidden after a failed refresh, and navigation gives a focused recovery', async ({ page }) => {
  let failList = false;
  const writes: string[] = [];
  await fixture(page, { role: 'owner', writes });
  await page.route('**/api/organizations/northstar/dashboards', route => failList
    ? route.fulfill({ status: 403, body: 'Forbidden' }) : route.fulfill({ json: [sample] }));
  await page.goto('/#/organization/northstar/dashboards');
  await expect(page.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', { name: 'Delete Business performance' }).click();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  failList = true;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboards temporarily unavailable' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toHaveCount(0);
  expect(writes).toContain(`DELETE /api/organizations/northstar/dashboards/${dashboardId}`);
  failList = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByRole('button', { name: 'View dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboards', exact: true })).toBeFocused();
  await page.goto('/#/organization/northstar/dashboard/not-found');
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboards', exact: true })).toBeFocused();
});

test('SC-UX11-06/07: malformed destination recovers without echoing the URL or crossing organizations', async ({ page }) => {
  await fixture(page);
  await page.goto('/#/organization/northstar/not-a-page');
  await expect(page.getByText(/requested destination is invalid/)).toBeVisible();
  await expect(page).toHaveURL(/#\/organization\/northstar\/overview$/);
  await page.getByRole('combobox', { name: 'Switch organization' }).selectOption('isolated');
  await expect(page.getByRole('combobox', { name: 'Switch organization' })).toHaveValue('isolated');
  await expect(page.locator('.crumb-root')).toHaveText('Isolated Tenant');
  await expect(page.getByText('Isolated report')).toBeVisible();
  await page.getByRole('button', { name: /^Dashboards/ }).click();
  await expect(page.getByRole('heading', { name: 'Dashboards', exact: true })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toHaveCount(0);
});

test('SC-UX11-05/07: external location changes drop the previous ephemeral question guide', async ({ page }) => {
  await fixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Explore answer: How is revenue changing/ }).click();
  await expect(page.getByRole('heading', { name: 'How is revenue changing?' })).toBeFocused();
  await page.evaluate(() => { window.location.hash = '#/organization/northstar/dashboards'; });
  await expect(page.getByRole('heading', { name: 'Dashboards', exact: true })).toBeFocused();
  await page.evaluate(id => { window.location.hash = `#/organization/northstar/dashboard/${id}`; }, dashboardId);
  await expect(page.getByRole('heading', { name: 'Business performance' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'How is revenue changing?' })).toHaveCount(0);
});

test('SC-UX11-08: same-origin host supports read-only exact values, filter recovery and insight handoff', async ({ page }, info) => {
  const writes: string[] = [];
  await fixture(page, { writes });
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('iframe.host-frame');
  await expect(frame.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  const chart = frame.getByRole('article', { name: 'Revenue over time' });
  await chart.getByText('View data table').click();
  await expect(chart.getByRole('table').getByText('$18,400')).toBeVisible();
  await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await frame.getByRole('button', { name: 'Clear channel filter' }).click();
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toBeFocused();
  await chart.getByText('What this means').click();
  await chart.getByRole('button', { name: 'Share this insight’s context' }).click();
  await expect(frame.getByRole('dialog', { name: 'Share insight context' })).toBeVisible();
  await capture(page, info, 'host-embedded');
  await expect(frame.getByRole('button', { name: /New dashboard|Edit dashboard|Save changes/ })).toHaveCount(0);
  await expect(page.locator('iframe.host-frame')).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(writes).toEqual([]);
});

for (const [width, height, name] of [[1440, 900, 'desktop'], [390, 844, 'mobile'], [320, 900, 'narrow']] as const) {
  test(`SC-UX11-01/06: focused recovery and reflow at ${name} ${width}x${height}`, async ({ page }, info) => {
    await fixture(page);
    await page.setViewportSize({ width, height });
    await page.goto(`/#/organization/northstar/dashboard/not-found`);
    await expect(page.getByRole('heading', { name: 'Dashboard not found' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to dashboards' }).click();
    const heading = page.getByRole('heading', { name: 'Dashboards', exact: true });
    await expect(heading).toBeFocused();
    expect(await heading.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
    await noPageOverflow(page);
    await capture(page, info, `recovery-${name}`);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(scan.violations).toEqual([]);
  });
}

test('SC-UX11-06: forced colors keep errors and recovery operable', async ({ page }, info) => {
  await fixture(page, { failedLists: 1 });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboards temporarily unavailable' })).toBeVisible();
  await capture(page, info, 'forced-colors-error');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await noPageOverflow(page);
});

test('SC-UX11-04: genuine Chromium 200% and 400% tab zoom preserves dense navigation', async ({}, info) => {
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', { channel: 'chromium',
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, headless: true, viewport: null,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1440,900'],
  });
  const results: unknown[] = [];
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await fixture(page);
    await page.goto(`http://127.0.0.1:5173/#/organization/northstar/dashboard/${dashboardId}`);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const zoom = (factor: number) => worker.evaluate(async f => {
      const tabs = (globalThis as unknown as { chrome: { tabs: {
        query(q: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
        setZoom(id: number, factor: number): Promise<void>; getZoom(id: number): Promise<number>;
      } } }).chrome.tabs;
      const tab = (await tabs.query({})).find(item => item.url?.includes('/#/organization/northstar/dashboard/'));
      if (tab?.id === undefined) throw new Error('Customer journey zoom tab missing');
      await tabs.setZoom(tab.id, f);
      return tabs.getZoom(tab.id);
    }, factor);
    const metrics = () => page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, scroll: document.documentElement.scrollWidth }));
    const baseline = await metrics();
    for (const factor of [2, 4]) {
      const actual = await zoom(factor);
      await expect.poll(async () => (await metrics()).width).toBeLessThanOrEqual(baseline.width / factor + 2);
      const observed = await metrics();
      expect(actual).toBeCloseTo(factor, 1);
      expect(observed.dpr / baseline.dpr).toBeCloseTo(factor, 1);
      expect(observed.scroll).toBeLessThanOrEqual(observed.width + 1);
      await page.getByRole('combobox', { name: 'Find a visualization' }).selectOption(widget(12).id);
      await page.getByRole('button', { name: 'Go to visualization' }).click();
      await expect(page.getByRole('heading', { name: 'Insight 12' })).toBeFocused();
      const cdp = await context.newCDPSession(page);
      const raw = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
      const path = info.outputPath(`ux11-native-${factor * 100}-chrome.png`);
      await writeFile(path, Buffer.from(raw.data, 'base64'));
      await info.attach(`ux11-native-${factor * 100}-chrome`, { path, contentType: 'image/png' });
      await cdp.detach();
      await page.getByRole('button', { name: 'Back to visualization list from Insight 12' }).click();
      await expect(page.getByRole('button', { name: '12. Insight 12' })).toBeFocused();
      results.push({ factor, actual, observed, baseline, os: process.platform, chromium: context.browser()?.version() });
    }
  } finally {
    await writeFile(info.outputPath('ux11-native-zoom.json'), JSON.stringify(results, null, 2));
    await context.close();
  }
});
