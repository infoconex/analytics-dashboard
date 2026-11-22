import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { Dashboard, DashboardWidget } from '../src/model';

const dashboardId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const rows = [
  ['Revenue', 'metric', 'commerce', 'revenue', 'month'],
  ['Channel details', 'table', 'channels', 'orders', 'channel'],
  ['Old revenue definition', 'metric', 'commerce', 'not-a-metric', 'month'],
  ['Legacy pipeline', 'area', 'future-source', 'revenue', 'month'],
  ['Unaddable conversion', 'donut', 'channels', 'conversion', 'channel'],
  ['Revenue trend', 'area', 'commerce', 'revenue', 'month'],
  ['Channel orders', 'bar', 'channels', 'orders', 'channel'],
  ['Monthly orders', 'line', 'commerce', 'orders', 'month'],
  ['Traffic breakdown', 'pie', 'channels', 'sessions', 'channel'],
  ['Revenue detail', 'table', 'commerce', 'revenue', 'month'],
  ['Channel comparison', 'scatter', 'channels', 'orders', 'sessions'],
  ['Session distribution', 'histogram', 'channels', 'sessions', 'channel'],
] as const;

const dashboard: Dashboard = {
  id: dashboardId, organizationId: 'northstar', name: 'Recovery assessment',
  description: 'Mixed fictional records and obsolete sample configurations',
  revision: 1, createdBy: 'demo-owner', createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  widgets: rows.map(([title, kind, datasetKey, metricKey, dimensionKey], index) => ({
    id: `806e3063-18e9-4ddb-887a-229198c6${String(index + 1).padStart(4, '0')}`,
    title, kind, datasetKey: datasetKey as DashboardWidget['datasetKey'], metricKey, dimensionKey,
  })),
};

async function sampleApi(page: Page, control: { dashboardStatus: number; membershipStatus: number; requests: string[]; writes: string[] }) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    control.requests.push(`${route.request().method()} ${path}`);
    if (route.request().method() !== 'GET') control.writes.push(path);
    if (path === '/api/organizations')
      return control.membershipStatus === 200
        ? route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] })
        : route.fulfill({ status: control.membershipStatus, json: { title: 'Access denied' } });
    if (path === `/api/organizations/northstar/dashboards/${dashboardId}`)
      return control.dashboardStatus === 200
        ? route.fulfill({ json: dashboard })
        : route.fulfill({ status: control.dashboardStatus, json: { title: 'Failed request' } });
    if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [dashboard] });
    return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
  });
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}

test.use({ reducedMotion: 'reduce' });

test('mixed 12-widget sample keeps valid cards visible, distinguishes errors and survives host layouts', async ({ page }, info) => {
  test.setTimeout(180_000);
  const control = { dashboardStatus: 200, membershipStatus: 200, requests: [] as string[], writes: [] as string[] };
  await sampleApi(page, control);
  const frame = page.frameLocator('.host-frame');
  const observations = [];
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sample-host.html');
    await expect(frame.locator('.canvas-item')).toHaveCount(12);
    await expect(frame.locator('[data-availability="available"]')).toHaveCount(9);
    await expect(frame.locator('[data-availability="unavailable"]')).toHaveCount(3);
    const availability = frame.getByRole('region', { name: 'Visualization availability' });
    await expect(availability).toContainText('9 of 12 visualizations have usable sample records');
    await expect(availability).toContainText('3 are unavailable or unsupported');
    await expect(frame.getByRole('article', { name: 'Revenue', exact: true }).locator('.metric-number')).toHaveText('$375.3K');
    await expect(frame.getByRole('article', { name: 'Channel details' }).getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
    await expect(frame.getByRole('article', { name: 'Legacy pipeline' })).toContainText('source unavailable in this sample viewer');
    await expect(frame.getByRole('article', { name: 'Unaddable conversion' })).toContainText('cannot be summed');
    await expect(frame.getByRole('article', { name: 'Old revenue definition' })).not.toContainText('$0');
    await expect(frame.getByRole('article', { name: 'Legacy pipeline' }).getByRole('button', { name: /Retry|Refresh/i })).toHaveCount(0);
    await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
    await expect(frame.getByRole('article', { name: 'Revenue', exact: true }).locator('.metric-number')).toHaveText('$375.3K');
    await expect(frame.getByRole('article', { name: 'Channel details' }).getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
    await expect(availability).toContainText('9 of 12 visualizations');
    const bounds = await page.locator('.host-frame').evaluate((iframe: HTMLIFrameElement) => {
      const child = iframe.contentDocument!;
      return {
        hostOverflow: document.documentElement.scrollWidth - innerWidth,
        embeddedOverflow: child.documentElement.scrollWidth - child.defaultView!.innerWidth,
        iframeHeight: iframe.getBoundingClientRect().height,
        contentHeight: child.querySelector<HTMLElement>('.embedded-shell')!.getBoundingClientRect().height,
      };
    });
    expect(bounds.hostOverflow).toBeLessThanOrEqual(1);
    expect(bounds.embeddedOverflow).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.iframeHeight - bounds.contentHeight)).toBeLessThanOrEqual(3);
    observations.push({ width, ...bounds });
    await availability.scrollIntoViewIfNeeded();
    await capture(page, info, `ux36-availability-${width}`);
    await frame.getByRole('article', { name: 'Legacy pipeline' }).scrollIntoViewIfNeeded();
    await capture(page, info, `ux36-unavailable-card-${width}`);
  }
  await page.emulateMedia({ forcedColors: 'active' });
  await frame.getByRole('button', { name: 'Reload dashboard definition' }).focus();
  await expect(frame.getByRole('button', { name: 'Reload dashboard definition' })).toBeFocused();
  const border = await frame.locator('.dashboard-availability').evaluate(el => getComputedStyle(el).borderStyle);
  expect(border).not.toBe('none');
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map(violation => violation.id)).toEqual([]);
  await frame.locator('.dashboard-availability').scrollIntoViewIfNeeded();
  await capture(page, info, 'ux36-forced-colors-320');
  const path = info.outputPath('ux36-layout-evidence.json');
  await writeFile(path, JSON.stringify(observations, null, 2));
  await info.attach('ux36-layout-evidence.json', { path, contentType: 'application/json' });
  expect(control.writes).toEqual([]);
});

test('synthetic unmatched channel offers only local clear and returns focus to that card', async ({ page }) => {
  const control = { dashboardStatus: 200, membershipStatus: 200, requests: [] as string[], writes: [] as string[] };
  await sampleApi(page, control);
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('.host-frame');
  const select = frame.getByRole('combobox', { name: 'Marketing channel' });
  await expect(select).toBeVisible();
  // A missing channel is impossible from the current fixed choices. Inject
  // only an in-memory selection to cover future/legacy no-match safety.
  await select.evaluate((element: HTMLSelectElement) => {
    element.add(new Option('Absent fictional channel', 'Absent fictional channel'));
    element.value = 'Absent fictional channel';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const card = frame.getByRole('article', { name: 'Channel details' });
  await expect(card).toContainText('No matching sample data.');
  await expect(card).not.toContainText('1,530');
  await expect(frame.getByRole('region', { name: 'Visualization availability' })).toContainText('no records matching');
  await card.getByRole('button', { name: 'Clear channel filter for Channel details' }).press('Enter');
  await expect(card.getByRole('heading', { name: 'Channel details' })).toBeFocused();
  await expect(select).toHaveValue('');
  await expect(card.getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
  expect(control.writes).toEqual([]);
});

test('embedded reload preserves visible cards during recheck, fails closed on 503 and restores URL filters on retry', async ({ page }, info) => {
  const control = { dashboardStatus: 200, membershipStatus: 200, requests: [] as string[], writes: [] as string[] };
  await sampleApi(page, control);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('.host-frame');
  await expect(frame.getByRole('heading', { name: 'Recovery assessment' })).toBeVisible();
  await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await frame.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
  const historyBefore = await page.evaluate(() => window.history.length);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const endpoint = `**/api/organizations/northstar/dashboards/${dashboardId}`;
  await page.route(endpoint, async route => {
    await gate;
    return route.fulfill({ status: 503, json: { title: 'Temporarily unavailable' } });
  });
  const reload = frame.getByRole('button', { name: 'Reload dashboard definition' });
  await reload.focus();
  await reload.press('Enter');
  await expect(frame.getByRole('button', { name: 'Checking dashboard…' })).toBeFocused();
  await expect(frame.getByRole('article', { name: 'Revenue', exact: true }).locator('.metric-number')).toHaveText('$128.3K');
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');
  await expect(page.getByRole('navigation', { name: 'After the embedded dashboard' })).toBeVisible();
  await capture(page, info, 'ux36-definition-check-pending-390');
  release();
  await expect(frame.getByRole('alert')).toContainText('could not load');
  await expect(frame.getByRole('article', { name: 'Revenue', exact: true })).toHaveCount(0);
  const retry = frame.getByRole('button', { name: 'Try again' });
  await expect(retry).toBeFocused();
  await capture(page, info, 'ux36-definition-check-failed-390');
  await page.unroute(endpoint);
  await retry.press('Enter');
  await expect(frame.getByRole('heading', { name: 'Recovery assessment' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Reload dashboard definition' })).toBeFocused();
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');
  await expect(frame.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('3m');
  expect(await page.evaluate(() => window.history.length)).toBe(historyBefore);
  expect(control.writes).toEqual([]);
});

test('rechecked 403 and failed membership revoke previously loaded embedded content', async ({ page }) => {
  const control = { dashboardStatus: 200, membershipStatus: 200, requests: [] as string[], writes: [] as string[] };
  await sampleApi(page, control);
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('.host-frame');
  await expect(frame.getByRole('heading', { name: 'Recovery assessment' })).toBeVisible();
  control.dashboardStatus = 403;
  await frame.getByRole('button', { name: 'Reload dashboard definition' }).click();
  await expect(frame.getByRole('alert')).toContainText('do not have access');
  await expect(frame.getByRole('article', { name: 'Revenue', exact: true })).toHaveCount(0);
  await expect(frame.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Customer dashboards' })).toBeVisible();
  control.dashboardStatus = 200;
  control.membershipStatus = 403;
  await page.reload();
  await expect(frame.getByRole('heading', { name: 'Dashboard unavailable' })).toBeVisible();
  await expect(frame.getByRole('article', { name: 'Revenue', exact: true })).toHaveCount(0);
  expect(control.writes).toEqual([]);
});
