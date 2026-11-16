import AxeBuilder from '@axe-core/playwright';
import { expect, test, chromium, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dashboard } from '../src/model';

const id = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const sample: Dashboard = {
  id, organizationId: 'northstar', name: 'Business performance',
  description: 'Revenue, conversion and customer activity in one view.',
  revision: 1, createdBy: 'demo-owner', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
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
    datasetKey: datasetKey as Dashboard['widgets'][number]['datasetKey'], metricKey, dimensionKey,
  })),
};
const dense: Dashboard = {
  ...sample, widgets: [...sample.widgets, ...sample.widgets.map((widget, index) => ({
    ...widget, id: `806e3063-18e9-4ddb-887a-229198c6dd${String(index + 7).padStart(2, '0')}`,
    title: `${widget.title} — regional`,
  }))],
};
const embeddedUrl = `/embed.html#/organization/northstar/dashboard/${id}`;
const hostUrl = '/sample-host.html';

async function routeSample(page: Page, dashboard = sample, writes: string[] = []) {
  await page.route('**/api/**', route => {
    const request = route.request();
    if (request.method() !== 'GET') writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
    const path = new URL(request.url()).pathname;
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'owner' }] });
    if (path === `/api/organizations/northstar/dashboards/${id}`) return route.fulfill({ json: dashboard });
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'demo-owner', displayName: 'Demo Owner' } });
    if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [dashboard] });
    return route.fulfill({ status: 403, json: { title: 'Access denied' } });
  });
}

async function capture(page: Page, info: TestInfo, name: string, fullPage = false) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}

async function assertNoOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(sizes.scroll, `Document overflow: ${JSON.stringify(sizes)}`).toBeLessThanOrEqual(sizes.width + 1);
}

test.use({ trace: 'on', video: 'on', reducedMotion: 'reduce' });

test('host integration preserves context, filtering, keyboard exit and standalone journey', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const mutations: string[] = [];
  await routeSample(page, sample, mutations);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await capture(page, info, 'ux6-01-standalone-baseline');

  await page.goto(hostUrl);
  await expect(page.getByRole('heading', { name: 'Customer insights' })).toBeVisible();
  const embedResponse = await page.request.get('/embed.html');
  expect(embedResponse.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(embedResponse.headers()['x-frame-options']).toBe('SAMEORIGIN');
  const frameElement = page.locator('iframe.host-frame');
  await expect(frameElement).toHaveAttribute('title', 'Business performance analytics — Northstar Commerce sample');
  const frame = page.frameLocator('.host-frame');
  await expect(frame.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await expect(frame.getByText('Northstar Commerce', { exact: false }).first()).toBeVisible();
  await expect(frame.getByText('Sample data', { exact: true }).first()).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await expect(frame.getByRole('navigation', { name: 'Workspace navigation' })).toHaveCount(0);
  await expect(frame.getByRole('button', { name: /Create|Delete|Register|Save changes/ })).toHaveCount(0);
  await capture(page, info, 'ux6-02-host-embedded-desktop');

  await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await expect(frame.getByRole('button', { name: 'Remove Direct filter' })).toBeVisible();
  await expect(frame.getByRole('article', { name: 'Channel details' }).getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
  await capture(page, info, 'ux6-03-host-embedded-filter');
  await frame.getByRole('button', { name: 'Remove Direct filter' }).press('Enter');
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toBeFocused();
  await expect(frame.getByRole('status', { name: 'Dashboard filter changes' })).toContainText('all sample records');

  // Follow the real host-to-frame tab sequence. Calling iframe.focus() first
  // starts at the frame boundary and the next Tab may *leave* the iframe.
  const portalLink = page.getByRole('navigation', { name: 'Customer portal navigation' }).getByRole('link', { name: 'Insights' });
  const embeddedSkip = frame.getByRole('button', { name: 'Skip to dashboard content' });
  await portalLink.focus();
  for (let step = 0; step < 2; step++) {
    await page.keyboard.press('Tab');
    if (await embeddedSkip.evaluate(node => node.ownerDocument.activeElement === node)) break;
  }
  await expect(embeddedSkip).toBeFocused();
  await embeddedSkip.press('Enter');
  await expect(frame.locator('#embedded-main')).toBeFocused();
  await embeddedSkip.focus();
  for (let step = 0; step < 2; step++) {
    await page.keyboard.press('Shift+Tab');
    if (await portalLink.evaluate(node => node.ownerDocument.activeElement === node)) break;
  }
  await expect(portalLink).toBeFocused();
  const after = page.getByRole('navigation', { name: 'After the embedded dashboard' });
  await after.getByRole('link', { name: 'Return to account overview' }).focus();
  await expect(after.getByRole('link', { name: 'Return to account overview' })).toBeFocused();
  await assertNoOverflow(page);
  expect(mutations).toEqual([]);
  await info.attach('ux6-host-integration.json', { body: JSON.stringify({ title: await frameElement.getAttribute('title'), sameOrigin: new URL(await frameElement.getAttribute('src') ?? '', page.url()).origin === new URL(page.url()).origin, mutations }, null, 2), contentType: 'application/json' });
});

test('dense embed: direct navigation to visualization 12, exact index return and no write', async ({ page }, info) => {
  const writes: string[] = [];
  await routeSample(page, dense, writes);
  await page.goto(embeddedUrl);
  await expect(page.locator('.canvas-item')).toHaveCount(12);
  await capture(page, info, 'ux6-04-dense-embed', true);
  const finder = page.getByRole('combobox', { name: 'Find a visualization' });
  await finder.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const last = page.getByRole('article', { name: 'Channel details — regional' });
  await expect(last.getByRole('heading', { name: 'Channel details — regional' })).toBeFocused();
  await capture(page, info, 'ux6-05-dense-navigation-focused');
  await last.getByRole('button', { name: 'Back to visualization list from Channel details — regional' }).click();
  const entry = page.getByRole('button', { name: '12. Channel details — regional' });
  await expect(entry).toBeFocused();
  await expect(page.locator('.dashboard-index')).toHaveAttribute('open', '');
  expect(writes).toEqual([]);
});

test('empty, server error, retry, and invalid location provide useful outcomes without unauthorized navigation', async ({ page }, info) => {
  const empty = { ...sample, widgets: [] };
  await routeSample(page, empty);
  await page.goto(embeddedUrl);
  await expect(page.getByText('No visualizations yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add first visualization' })).toHaveCount(0);
  await capture(page, info, 'ux6-06-empty-embed');

  let fail = true;
  await page.unroute('**/api/**');
  await page.route('**/api/**', route => fail && route.request().url().includes('/dashboards/')
    ? route.fulfill({ status: 503, body: '' }) : route.fulfill({ json: route.request().url().endsWith('/api/organizations')
      ? [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] : sample }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('could not load');
  await capture(page, info, 'ux6-07-unavailable-embed');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toBeVisible();

  await page.goto('/embed.html#/settings');
  await expect(page.getByRole('alert')).toContainText('link is invalid');
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await page.goto(`/embed.html#/organization/isolated/dashboard/${id}`);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toHaveCount(0);
});

test('host and embed survive mobile, narrow reflow and forced colors with accessible controls', async ({ page }, info) => {
  await routeSample(page, dense);
  for (const [width, height, label] of [[390, 844, 'ux6-08-mobile-390'], [320, 900, 'ux6-09-narrow-320']] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(embeddedUrl);
    await expect(page.getByRole('heading', { name: 'Business performance' })).toBeVisible();
    await assertNoOverflow(page);
    await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
    await expect(page.getByRole('button', { name: 'Remove Direct filter' })).toBeVisible();
    await capture(page, info, label);
  }
  await page.emulateMedia({ forcedColors: 'active' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await capture(page, info, 'ux6-10-forced-colors');
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations, JSON.stringify(scan.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })))).toEqual([]);
  await page.emulateMedia({ forcedColors: 'none' });
  await page.goto(hostUrl);
  await assertNoOverflow(page);
  await expect(page.frameLocator('.host-frame').getByRole('heading', { name: 'Business performance' })).toBeVisible();
});

test('actual API denies cross-tenant dashboard access despite a known resource id', async ({ request }) => {
  test.skip(process.env.ANALYTICS_UI_ONLY === '1', 'Local UI-only runner does not start the .NET service; CI verifies real API.');
  const denied = await request.get(`http://127.0.0.1:5055/api/organizations/isolated/dashboards/${id}`);
  expect(denied.status()).toBe(403);
  const wrongResource = await request.get(`http://127.0.0.1:5055/api/organizations/northstar/dashboards/11111111-1111-4111-8111-111111111111`);
  expect(wrongResource.status()).toBe(404);
});

interface ZoomTabs {
  query(details: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
  setZoom(id: number, factor: number): Promise<void>;
  getZoom(id: number): Promise<number>;
}

test('real Chromium tab zoom at 200% and 400% retains embedded navigation and filter recovery', async ({}, info) => {
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true, viewport: null,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1440,900'],
  });
  const evidence: Record<string, unknown>[] = [];
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await routeSample(page, dense);
    await page.goto(`http://127.0.0.1:5173${embeddedUrl}`);
    await expect(page.locator('.canvas-item')).toHaveCount(12);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const zoom = (factor: number | null) => worker.evaluate(async f => {
      const tabs = (globalThis as unknown as { chrome: { tabs: ZoomTabs } }).chrome.tabs;
      const tab = (await tabs.query({})).find(item => item.url?.startsWith('http://127.0.0.1:5173/embed.html'));
      if (tab?.id === undefined) throw new Error('Embedded browser tab unavailable');
      if (f !== null) await tabs.setZoom(tab.id, f);
      return tabs.getZoom(tab.id);
    }, factor);
    const metrics = () => page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, scroll: document.documentElement.scrollWidth }));
    const baseline = await metrics();
    expect(await zoom(null)).toBeCloseTo(1, 1);
    for (const factor of [2, 4]) {
      const actual = await zoom(factor);
      await expect.poll(async () => (await metrics()).width).toBeLessThanOrEqual(baseline.width / factor + 2);
      const observed = await metrics();
      expect(actual).toBeCloseTo(factor, 1);
      expect(observed.dpr / baseline.dpr).toBeCloseTo(factor, 1);
      expect(observed.scroll).toBeLessThanOrEqual(observed.width + 1);
      const finder = page.getByRole('combobox', { name: 'Find a visualization' });
      await finder.selectOption(dense.widgets[11]!.id);
      await page.getByRole('button', { name: 'Go to visualization' }).click();
      await expect(page.getByRole('heading', { name: 'Channel details — regional' })).toBeFocused();
      const client = await page.context().newCDPSession(page);
      const raw = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
      const path = info.outputPath(`ux6-11-native-${factor * 100}-chrome-view.png`);
      await writeFile(path, Buffer.from(raw.data, 'base64'));
      await info.attach(`ux6-11-native-${factor * 100}-chrome-view`, { path, contentType: 'image/png' });
      await client.detach();
      await page.getByRole('button', { name: 'Back to visualization list from Channel details — regional' }).click();
      await expect(page.getByRole('button', { name: '12. Channel details — regional' })).toBeFocused();
      await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
      await expect(page.getByRole('row', { name: /Direct.*1,530/ }).last()).toBeVisible();
      await page.getByRole('button', { name: 'Remove Direct filter' }).click();
      await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toBeFocused();
      evidence.push({ factor, actual, metrics: observed, chromium: context.browser()?.version(), os: process.platform });
    }
    await zoom(1);
  } finally {
    const path = info.outputPath('ux6-native-zoom-evidence.json');
    await writeFile(path, JSON.stringify(evidence, null, 2));
    await info.attach('ux6-native-zoom-evidence.json', { path, contentType: 'application/json' });
    await context.close();
  }
});
