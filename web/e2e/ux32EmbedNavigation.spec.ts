import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Dashboard } from '../src/model';

const firstId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const secondId = 'c730b8e2-4990-42b7-80cc-71b47290aec4';
const widget = {
  id: '806e3063-18e9-4ddb-887a-229198c6dd01', title: 'Revenue over time',
  kind: 'area' as const, datasetKey: 'commerce' as const, metricKey: 'revenue', dimensionKey: 'month',
};
const first: Dashboard = {
  id: firstId, organizationId: 'northstar', name: 'Business performance',
  description: 'Fictional sample dashboard', revision: 1, createdBy: 'demo-owner',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [widget, {
    ...widget, id: '806e3063-18e9-4ddb-887a-229198c6dd02',
    title: 'Orders by channel', kind: 'bar', datasetKey: 'channels',
    metricKey: 'orders', dimensionKey: 'channel',
  }],
};
const second: Dashboard = {
  ...first, id: secondId, name: 'Channel performance',
  widgets: [{ ...first.widgets[1]!, id: '78654a5b-615d-4450-8245-243dfbca8bc1' }],
};

async function mockAuthorizedApi(page: Page, mutations: string[]) {
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') mutations.push(`${request.method()} ${path}`);
    if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [first, second] });
    if (path === `/api/organizations/northstar/dashboards/${firstId}`) return route.fulfill({ json: first });
    if (path === `/api/organizations/northstar/dashboards/${secondId}`) return route.fulfill({ json: second });
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] });
    return route.fulfill({ status: 403, json: { title: 'Access denied' } });
  });
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name + '.png');
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}

test('host switches authorized dashboards, preserves per-dashboard filters and owns browser history', async ({ page }, info) => {
  const mutations: string[] = [];
  await mockAuthorizedApi(page, mutations);
  await page.goto('/sample-host.html');
  const choices = page.getByRole('navigation', { name: 'Customer dashboards' });
  const frame = page.frameLocator('.host-frame');
  await expect(choices.getByRole('link', { name: 'Business performance' })).toHaveAttribute('aria-current', 'page');
  await expect(frame.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await frame.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
  await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await expect.poll(() => page.locator('.host-frame').evaluate((el: HTMLIFrameElement) => el.contentWindow?.location.hash))
    .toContain('period=3m&channel=Direct');
  await screenshot(page, info, 'ux32-host-first-filtered');

  const channelChoice = choices.getByRole('link', { name: 'Channel performance' });
  await channelChoice.click();
  await expect(channelChoice).toBeFocused();
  await expect(page).toHaveURL(/#insights\/c730b8e2/);
  await expect(frame.getByRole('heading', { name: 'Channel performance' })).toBeVisible();
  await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Organic search');
  await screenshot(page, info, 'ux32-host-second-filtered');

  const firstChoice = choices.getByRole('link', { name: 'Business performance' });
  await firstChoice.click();
  await expect(firstChoice).toBeFocused();
  await expect(frame.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await expect(frame.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('3m');
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');

  await page.getByRole('link', { name: 'Return to account overview' }).click();
  await expect(page.getByRole('heading', { name: 'Account overview' })).toBeVisible();
  await expect(page.locator('#analytics-section')).toBeHidden();
  await page.getByRole('link', { name: 'Return to customer insights' }).click();
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Account overview' })).toBeVisible();
  await page.goForward();
  await expect(frame.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await expect(frame.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('3m');
  expect(mutations).toEqual([]);
  await screenshot(page, info, 'ux32-host-restored');
});

test('host deep links and guarded invalid dashboard selection', async ({ page }) => {
  const writes: string[] = [];
  await mockAuthorizedApi(page, writes);
  await page.goto(`/sample-host.html#insights/${secondId}`);
  const frame = page.frameLocator('.host-frame');
  await expect(frame.getByRole('heading', { name: 'Channel performance' })).toBeVisible();
  await page.reload();
  await expect(frame.getByRole('heading', { name: 'Channel performance' })).toBeVisible();
  await page.goto('/sample-host.html#insights/11111111-1111-4111-8111-111111111111');
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'not available to your account' })).toBeVisible();
  await expect(page.locator('.host-frame-shell')).toBeHidden();
  await page.getByRole('navigation', { name: 'Customer portal navigation' }).getByRole('link', { name: 'Insights' }).click();
  await expect(frame.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await page.goto(`/embed.html#/organization/northstar/dashboard/${firstId}?period=6m&channel=Direct`);
  await expect(page.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('6m');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');
  expect(writes).toEqual([]);
});

test('host handles unavailable list and retry; embed denies unauthorized and missing resources', async ({ page }) => {
  let fail = true;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/organizations/northstar/dashboards') {
      return route.fulfill(fail ? { status: 503, body: '' } : { json: [first, second] });
    }
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] });
    if (path.endsWith('/' + firstId)) return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
    if (path.endsWith('/' + secondId)) return route.fulfill({ status: 404, json: { title: 'Not found' } });
    return route.fulfill({ status: 403, json: { title: 'Access denied' } });
  });
  await page.goto('/sample-host.html');
  await expect(page.getByRole('button', { name: 'Retry loading dashboards' })).toBeVisible();
  await expect(page.locator('.host-frame-shell')).toBeHidden();
  fail = false;
  await page.getByRole('button', { name: 'Retry loading dashboards' }).click();
  await expect(page.getByRole('navigation', { name: 'Customer dashboards' }).getByRole('link')).toHaveCount(2);
  const frame = page.frameLocator('.host-frame');
  await expect(frame.getByRole('alert')).toContainText('do not have access');
  await page.getByRole('navigation', { name: 'Customer dashboards' }).getByRole('link', { name: 'Channel performance' }).click();
  await expect(frame.getByRole('alert')).toContainText('could not be found');
  await expect(frame.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
});

test('desktop, tablet and narrow host view keep controls accessible and without horizontal overflow', async ({ page }, info) => {
  await mockAuthorizedApi(page, []);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sample-host.html');
    await expect(page.frameLocator('.host-frame').getByRole('heading', { name: 'Business performance' })).toBeVisible();
    const hostScroll = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(hostScroll, `host overflow at ${width}px`).toBeLessThanOrEqual(1);
    const frameScroll = await page.frameLocator('.host-frame').locator('body').evaluate(body =>
      body.ownerDocument.documentElement.scrollWidth - body.ownerDocument.defaultView!.innerWidth);
    expect(frameScroll, `embed overflow at ${width}px`).toBeLessThanOrEqual(1);
    await screenshot(page, info, `ux32-host-${width}`);
  }
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations.map(item => item.id)).toEqual([]);
});

test('real development API exposes two sample dashboards but never authorizes the other tenant', async ({ page, request }) => {
  test.skip(process.env.ANALYTICS_UI_ONLY === '1', 'Requires actual development API.');
  const list = await request.get('http://127.0.0.1:5055/api/organizations/northstar/dashboards');
  expect(list.status()).toBe(200);
  expect((await list.json() as Dashboard[]).map(item => item.id)).toEqual(expect.arrayContaining([firstId, secondId]));
  const denied = await request.get(`http://127.0.0.1:5055/api/organizations/isolated/dashboards/${secondId}`);
  expect(denied.status()).toBe(403);
  await page.goto('/sample-host.html');
  await page.getByRole('navigation', { name: 'Customer dashboards' }).getByRole('link', { name: 'Channel performance' }).click();
  await expect(page.frameLocator('.host-frame').getByRole('heading', { name: 'Channel performance' })).toBeVisible();
});
