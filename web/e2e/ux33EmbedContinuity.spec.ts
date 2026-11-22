import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Dashboard } from '../src/model';

const firstId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const secondId = 'c730b8e2-4990-42b7-80cc-71b47290aec4';
const sample: Dashboard = {
  id: firstId, organizationId: 'northstar', name: 'Business performance',
  description: 'Fictional sample analytics', revision: 1, createdBy: 'demo-owner',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [
    ['Total revenue', 'metric', 'commerce', 'revenue', 'month'],
    ['Revenue over time', 'area', 'commerce', 'revenue', 'month'],
    ['Orders by channel', 'bar', 'channels', 'orders', 'channel'],
    ['Traffic sources', 'donut', 'channels', 'sessions', 'channel'],
    ['Monthly orders', 'line', 'commerce', 'orders', 'month'],
    ['Channel details', 'table', 'channels', 'orders', 'channel'],
  ].map(([title, kind, datasetKey, metricKey, dimensionKey], index) => ({
    id: `806e3063-18e9-4ddb-887a-229198c6dd0${index + 1}`,
    title, kind: kind as Dashboard['widgets'][number]['kind'],
    datasetKey: datasetKey as Dashboard['widgets'][number]['datasetKey'],
    metricKey, dimensionKey,
  })),
};
const dense: Dashboard = {
  ...sample, widgets: [...sample.widgets, ...sample.widgets.map((widget, index) => ({
    ...widget, id: `806e3063-18e9-4ddb-887a-229198c6dd${String(index + 7).padStart(2, '0')}`,
    title: `${widget.title} — regional`,
  }))],
};
const second: Dashboard = {
  ...sample, id: secondId, name: 'Channel performance',
  widgets: [sample.widgets[2]!],
};

async function mockApi(page: Page, first = dense, secondDashboard: Dashboard | null = second) {
  const writes: string[] = [];
  const requests: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push(`${request.method()} ${path}`);
    if (request.method() !== 'GET') writes.push(`${request.method()} ${path}`);
    if (path === '/api/organizations/northstar/dashboards')
      return route.fulfill({ json: secondDashboard ? [first, secondDashboard] : [first] });
    if (path === `/api/organizations/northstar/dashboards/${firstId}`) return route.fulfill({ json: first });
    if (secondDashboard && path === `/api/organizations/northstar/dashboards/${secondId}`)
      return route.fulfill({ json: secondDashboard });
    if (path === '/api/organizations')
      return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] });
    return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
  });
  return { requests, writes };
}

async function layout(page: Page) {
  return page.locator('.host-frame').evaluate((element: HTMLIFrameElement) => {
    const child = element.contentDocument!;
    const shell = child.querySelector<HTMLElement>('.embedded-shell');
    return {
      hostWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      frameHeight: element.getBoundingClientRect().height,
      frameContentHeight: shell?.getBoundingClientRect().height ?? 0,
      embeddedScrollHeight: child.documentElement.scrollHeight,
      embeddedViewportHeight: child.defaultView!.innerHeight,
      embeddedScrollWidth: child.documentElement.scrollWidth,
      embeddedViewportWidth: child.defaultView!.innerWidth,
      hostDocumentHeight: document.documentElement.scrollHeight,
    };
  });
}
async function expectContentSized(page: Page) {
  await expect.poll(async () => {
    const metrics = await layout(page);
    return Math.abs(metrics.frameHeight - metrics.frameContentHeight);
  }).toBeLessThanOrEqual(3);
  const metrics = await layout(page);
  expect(metrics.embeddedScrollHeight - metrics.embeddedViewportHeight, 'no nested vertical iframe scroll').toBeLessThanOrEqual(3);
  expect(metrics.embeddedScrollWidth - metrics.embeddedViewportWidth, 'no horizontal iframe overflow').toBeLessThanOrEqual(1);
  expect(metrics.hostWidth - metrics.viewportWidth, 'no host horizontal overflow').toBeLessThanOrEqual(1);
  return metrics;
}
async function screenshot(page: Page, info: TestInfo, name: string, fullPage = false) {
  const path = info.outputPath(name + '.png');
  await page.screenshot({ path, fullPage, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}

test('long host embed owns scrolling at desktop, tablet, mobile and narrow widths; disclosures resize', async ({ page }, info) => {
  test.setTimeout(90_000);
  const { writes } = await mockApi(page);
  const observations = [];
  const frame = page.frameLocator('.host-frame');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sample-host.html');
    await expect(frame.locator('.canvas-item')).toHaveCount(12);
    const before = await expectContentSized(page);
    expect(before.frameHeight).toBeGreaterThan(900);
    expect(before.hostDocumentHeight).toBeGreaterThan(900);
    await frame.getByRole('article', { name: 'Revenue over time' }).locator('summary').filter({ hasText: 'View data table' }).click();
    const expanded = await expectContentSized(page);
    expect(expanded.frameHeight).toBeGreaterThan(before.frameHeight);
    await frame.getByRole('article', { name: 'Revenue over time' }).locator('summary').filter({ hasText: 'View data table' }).click();
    const closed = await expectContentSized(page);
    expect(closed.frameHeight).toBeLessThan(expanded.frameHeight);
    const after = page.getByRole('navigation', { name: 'After the embedded dashboard' });
    await after.getByRole('link', { name: 'Return to account overview' }).scrollIntoViewIfNeeded();
    await expect(after).toBeInViewport();
    await screenshot(page, info, `ux33-host-${width}`);
    observations.push({ width, before, expanded, closed });
  }
  await info.attach('ux33-viewport-evidence.json', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' });
  expect(writes).toEqual([]);
});

test('same-tab host reload preserves only allowed per-dashboard sample filters and keeps host history', async ({ page }, info) => {
  const { writes } = await mockApi(page, sample);
  await page.goto('/sample-host.html');
  const choices = page.getByRole('navigation', { name: 'Customer dashboards' });
  const frame = page.frameLocator('.host-frame');
  await expect(frame.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await frame.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
  await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await page.reload();
  await expect(frame.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('3m');
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');

  await choices.getByRole('link', { name: 'Channel performance' }).click();
  await expect(frame.getByRole('heading', { name: 'Channel performance' })).toBeVisible();
  await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Organic search');
  await page.reload();
  await expect(frame.getByRole('heading', { name: 'Channel performance' })).toBeVisible();
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Organic search');
  await choices.getByRole('link', { name: 'Business performance' }).click();
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');
  await page.getByRole('link', { name: 'Return to account overview' }).click();
  await expect(page.getByRole('heading', { name: 'Account overview' })).toBeFocused();
  await page.getByRole('link', { name: 'Return to customer insights' }).click();
  await expect(choices.getByRole('link', { name: 'Business performance' })).toBeFocused();
  await expectContentSized(page);
  await screenshot(page, info, 'ux33-reload-return');
  expect(writes).toEqual([]);
});

test('authorization is rechecked on reload; denied host cannot pre-render a cached frame', async ({ page }, info) => {
  const { requests, writes } = await mockApi(page, sample);
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('.host-frame');
  await expect(frame.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await page.reload();
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');

  await page.unroute('**/api/**');
  const deniedRequests: string[] = [];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    deniedRequests.push(path);
    return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry loading dashboards' })).toBeVisible();
  await expect(page.locator('.host-frame-shell')).toBeHidden();
  await expect(page.locator('.host-frame')).toHaveAttribute('src', 'about:blank');
  expect(deniedRequests).toEqual(['/api/organizations/northstar/dashboards']);
  await screenshot(page, info, 'ux33-denied-host');

  await page.unroute('**/api/**');
  await mockApi(page, sample, null);
  await page.getByRole('button', { name: 'Retry loading dashboards' }).click();
  await expect(frame.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');
  await page.goto(`/sample-host.html#insights/${secondId}`);
  await expect(page.locator('.host-frame-shell')).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'not available to your account' })).toBeVisible();
  expect(writes).toEqual([]);
  expect(requests.some(path => path.includes('/isolated/'))).toBe(false);
});

test('embedded short, empty and error states shrink without clipping; forced-colors host remains accessible', async ({ page }, info) => {
  test.setTimeout(60_000);
  const { writes } = await mockApi(page, { ...sample, widgets: [] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('.host-frame');
  await expect(frame.getByText('No visualizations yet')).toBeVisible();
  const empty = await expectContentSized(page);
  expect(empty.frameHeight).toBeLessThan(900);
  await page.emulateMedia({ forcedColors: 'active' });
  await expectContentSized(page);
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations.map(item => item.id)).toEqual([]);
  await screenshot(page, info, 'ux33-empty-forced-colors');
  await page.emulateMedia({ forcedColors: 'none' });
  await page.goto(`/embed.html#/organization/northstar/dashboard/${firstId}?period=6m&channel=Direct`);
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveCount(0);
  await page.reload();
  await expect(page).toHaveURL(/period=6m&channel=Direct/);
  expect(writes).toEqual([]);
});
