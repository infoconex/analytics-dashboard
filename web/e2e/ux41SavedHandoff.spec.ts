import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, test, type Page, type TestInfo } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import type { Dashboard, DashboardDraft, DashboardWidget } from '../src/model';

const id = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3888';
const widget = (index: number, title: string, datasetKey: DashboardWidget['datasetKey'],
  metricKey: string, kind: DashboardWidget['kind']): DashboardWidget => ({
  id: '806e3063-18e9-4ddb-887a-229198c6' + String(index).padStart(4, '0'),
  title, datasetKey, metricKey, kind, dimensionKey: datasetKey === 'commerce' ? 'month' : 'channel',
});
const original: Dashboard = {
  id, organizationId: 'northstar', name: 'Saved for recipients', description: 'Fictional commerce and marketing results',
  revision: 1, createdBy: 'editor', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [widget(1, 'Revenue', 'commerce', 'revenue', 'area'),
    widget(2, 'Channel orders', 'channels', 'orders', 'bar')],
};
type Server = { saved: Dashboard; failSave: boolean; revokeViewer: boolean; writes: number[] };
const newServer = (): Server => ({ saved: structuredClone(original), failSave: false, revokeViewer: false, writes: [] });

async function mock(page: Page, server: Server, role: 'editor' | 'viewer' = 'viewer') {
  await page.route('**/api/**', route => {
    const method = route.request().method(), path = new URL(route.request().url()).pathname;
    const denied = role === 'viewer' && server.revokeViewer;
    if (path === '/api/identity') return route.fulfill({ json: { userId: role, displayName: role } });
    if (path === '/api/organizations') return route.fulfill({ json: denied ? [] :
      [{ id: 'northstar', name: 'Northstar Commerce', role }] });
    if (denied) return route.fulfill({ status: 403 });
    if (path === '/api/organizations/northstar/dashboards' && method === 'GET')
      return route.fulfill({ json: [server.saved] });
    if (path === '/api/organizations/northstar/dashboards/' + id) {
      if (method === 'GET') return route.fulfill({ json: server.saved });
      if (method === 'PUT' && role === 'editor') {
        const draft = route.request().postDataJSON() as DashboardDraft & { expectedRevision: number };
        const status = server.failSave ? 503 : draft.expectedRevision === server.saved.revision ? 200 : 409;
        server.writes.push(status);
        if (status !== 200) return route.fulfill({ status });
        server.saved = { ...server.saved, ...draft, revision: server.saved.revision + 1,
          updatedAt: '2026-03-03T00:00:00Z' };
        return route.fulfill({ json: server.saved });
      }
    }
    if (path === '/api/organizations/northstar/visualizations' && method === 'GET')
      return route.fulfill({ json: [] });
    return route.fulfill({ status: 403 });
  });
}

const route = '/#/organization/northstar/dashboard/' + id;
async function openSaved(page: Page) {
  await page.goto(route);
  await expect(page.getByRole('heading', { name: 'Saved for recipients' })).toBeVisible();
}
async function share(page: Page) {
  const button = page.getByRole('button', { name: 'Share', exact: true });
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Share dashboard' });
  await expect(dialog.locator('.share-link-field')).toBeFocused();
  return dialog;
}
async function snap(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath('ux41-' + name + '.png');
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
  const dimensions = await page.evaluate(() => ({
    width: innerWidth, page: document.documentElement.scrollWidth,
    modal: document.querySelector('dialog')?.clientWidth ?? 0,
    modalScroll: document.querySelector('dialog')?.scrollWidth ?? 0,
  }));
  expect(dimensions.page, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.modalScroll, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.modal + 1);
}

test.use({ reducedMotion: 'reduce' });

test('unchanged share identifies saved revision; previously copied link opens later committed revisions for a separate viewer', async ({ page, browser }, info) => {
  const server = newServer();
  await mock(page, server, 'editor');
  await openSaved(page);
  const dialog = await share(page);
  await expect(dialog).toContainText('Saved revision 1');
  await expect(dialog).toContainText('latest saved revision');
  const link = await dialog.locator('.share-link-field').inputValue();
  expect(link).toBe('http://127.0.0.1:5173' + route);
  expect(link).not.toMatch(/revision|period=|channel=|token=/);
  await dialog.getByText('Include your current viewing context').click();
  const originalNote = await dialog.getByRole('textbox', { name: /Context note/ }).inputValue();
  expect(originalNote).toContain('Saved revision shown to sender: 1');
  expect(originalNote).toContain('not a live or automatically updated report');
  await snap(page, info, 'unchanged-share');
  await dialog.getByRole('button', { name: 'Done' }).click();

  const recipientContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const recipient = await recipientContext.newPage();
    await mock(recipient, server);
    await recipient.goto(link);
    await expect(recipient.getByRole('heading', { name: 'Saved for recipients' })).toBeVisible();
    await expect(recipient.locator('.dashboard-toolbar')).toContainText('Dashboard saved 1');
    await expect(recipient.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Edit dashboard' }).click();
    await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Committed handoff');
    await page.getByRole('button', { name: 'Preview as viewer' }).click();
    await expect(page.getByRole('region', { name: 'Unsaved dashboard preview' })).toContainText('not published');
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Return to editing' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'Committed handoff' })).toBeVisible();
    expect(server.saved.revision).toBe(2);
    const afterSave = await share(page);
    await expect(afterSave).toContainText('Saved revision 2');
    expect(await afterSave.locator('.share-link-field').inputValue()).toBe(link);
    await afterSave.getByRole('button', { name: 'Done' }).click();
    await recipient.goto(link);
    await expect(recipient.getByRole('heading', { name: 'Committed handoff' })).toBeVisible();
    await expect(recipient.locator('.dashboard-toolbar')).toContainText('Dashboard saved 2');
    expect(originalNote).toContain('Saved revision shown to sender: 1');
    expect(originalNote).not.toContain('Committed handoff');

    server.saved = { ...server.saved, name: 'Newer saved handoff', revision: 3 };
    await recipient.reload();
    await expect(recipient.getByRole('heading', { name: 'Newer saved handoff' })).toBeVisible();
    await expect(recipient.locator('.dashboard-toolbar')).toContainText('Dashboard saved 3');
    await snap(recipient, info, 'recipient-latest-saved');
  } finally { await recipientContext.close(); }
});

test('failed Save, cancelled edits and revision conflict do not publish draft content through copied link', async ({ page, browser }) => {
  const server = newServer();
  await mock(page, server, 'editor');
  await openSaved(page);
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Uncommitted draft');
  server.failSave = true;
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Your unsaved work is still available');
  const recipientContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const recipient = await recipientContext.newPage();
    await mock(recipient, server);
    await recipient.goto(route);
    await expect(recipient.getByRole('heading', { name: 'Saved for recipients' })).toBeVisible();
    await expect(recipient.locator('.dashboard-toolbar')).toContainText('Dashboard saved 1');
    page.once('dialog', d => void d.accept());
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit dashboard' }).click();
    await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Local conflict draft');
    server.failSave = false;
    server.saved = { ...server.saved, description: 'Remote committed description', revision: 2 };
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('region', { name: 'Dashboard conflict recovery' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);
    await recipient.reload();
    await expect(recipient.getByRole('heading', { name: 'Saved for recipients' })).toBeVisible();
    await expect(recipient.locator('.dashboard-toolbar')).toContainText('Dashboard saved 2');
    expect(server.writes).toEqual([503, 409]);
  } finally { await recipientContext.close(); }
});

test('temporary independent filters and exact insight notes stay separate from latest saved recipient defaults', async ({ page, browser }) => {
  const server = newServer();
  await mock(page, server, 'editor');
  await openSaved(page);
  await page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  const dialog = await share(page);
  await dialog.getByText('Include your current viewing context').click();
  const note = await dialog.getByRole('textbox', { name: /Context note/ }).inputValue();
  expect(note).toContain('Saved revision shown to sender: 1');
  expect(note).toContain('Commerce: Final 3 sample months');
  expect(note).toContain('Marketing channels: Direct (no dates)');
  expect(note).toContain('filters apply independently');
  const link = await dialog.locator('.share-link-field').inputValue();
  expect(link).not.toMatch(/period=|channel=/);
  await dialog.getByRole('button', { name: 'Done' }).click();

  const recipientContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const recipient = await recipientContext.newPage();
    await mock(recipient, server);
    await recipient.goto(link);
    await expect(recipient.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('12m');
    await expect(recipient.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('');
    await expect(recipient.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  } finally { await recipientContext.close(); }

  const chart = page.getByRole('article', { name: 'Revenue' });
  await chart.locator('.insight-context > summary').click();
  await chart.getByRole('button', { name: 'Share this insight’s context' }).click();
  const insight = page.getByRole('dialog', { name: 'Share insight context' });
  await insight.getByText('Include this insight’s context and exact values').click();
  const values = await insight.getByRole('textbox', { name: /Context note/ }).inputValue();
  expect(values).toContain('Saved revision shown to sender: 1');
  expect(values).toContain('Oct: $41,400');
  expect(values).not.toContain('Jan: $18,400');
  await insight.getByRole('button', { name: 'Done' }).click();
});

test('shared destination remains authorization scoped and deleted or malformed links do not reveal content', async ({ page }) => {
  const server = newServer();
  await mock(page, server);
  server.revokeViewer = true;
  await page.goto(route);
  await expect(page.getByText('No organizations available')).toBeVisible();
  server.revokeViewer = false;
  await page.goto('/#/organization/unknown/dashboard/' + id);
  await expect(page.getByText(/requested organization is unavailable/)).toBeVisible();
  await page.goto('/#/organization/northstar/dashboard/11111111-1111-4111-8111-111111111111');
  await expect(page.getByRole('heading', { name: 'Dashboard not found' })).toBeVisible();
  await page.goto('/#/organization/northstar/dashboard/' + id + '/invalid');
  await expect(page.getByText(/requested destination is invalid/)).toBeVisible();
});

test('sharing remains keyboard accessible at desktop, tablet, mobile, narrow mobile and forced colors', async ({ page }, info) => {
  test.setTimeout(120_000);
  const server = newServer();
  await mock(page, server);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(route);
    const shareButton = page.getByRole('button', { name: 'Share', exact: true });
    await shareButton.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Share dashboard' });
    await expect(dialog).toContainText('Saved revision 1');
    await dialog.getByText('Include your current viewing context').click();
    await snap(page, info, 'share-' + width);
    const axe = await new AxeBuilder({ page }).include('.share-context-modal')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map(v => v.id)).toEqual([]);
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(shareButton).toBeFocused();
  }
  await page.emulateMedia({ forcedColors: 'active' });
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await snap(page, info, 'share-forced-colors');
  await expect(page.getByRole('dialog')).toContainText('Saved revision 1');
});

test('copy success and clipboard failure keep distinct feedback and a selectable fallback', async ({ page }) => {
  await mock(page, newServer());
  await openSaved(page);
  const dialog = await share(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: () => Promise.resolve() },
  }));
  await dialog.getByRole('button', { name: 'Copy dashboard link' }).click();
  await expect(dialog.getByRole('status')).toContainText('Dashboard link copied');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: { writeText: () => Promise.reject(new Error('blocked')) },
  }));
  await dialog.getByText('Include your current viewing context').click();
  await dialog.getByRole('button', { name: 'Copy context note' }).click();
  await expect(dialog.getByRole('status')).toContainText('copy it manually');
  await expect(dialog.getByRole('textbox', { name: /Context note/ })).toBeFocused();
});

test('embedded consumer displays the saved revision without editing or granting access through insight handoff', async ({ page }, info) => {
  const server = newServer();
  await mock(page, server);
  await page.goto('/embed.html#/organization/northstar/dashboard/' + id);
  await expect(page.getByRole('heading', { name: 'Saved for recipients' })).toBeVisible();
  await expect(page.locator('.dashboard-toolbar')).toContainText('Dashboard saved 1');
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  const chart = page.getByRole('article', { name: 'Revenue' });
  await chart.locator('.insight-context > summary').click();
  await chart.getByRole('button', { name: 'Share this insight’s context' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share insight context' });
  await expect(dialog).toContainText('Saved revision 1');
  await snap(page, info, 'embedded-share');
  await dialog.getByRole('button', { name: 'Done' }).click();
  server.saved = { ...server.saved, revision: 2, name: 'Updated embedded view' };
  await page.getByRole('button', { name: 'Reload dashboard definition' }).click();
  await expect(page.getByRole('heading', { name: 'Updated embedded view' })).toBeVisible();
  await expect(page.locator('.dashboard-toolbar')).toContainText('Dashboard saved 2');
});

test('native Chromium 200% and 400% zoom keeps saved revision and copy controls available', async ({}, info) => {
  test.setTimeout(120_000);
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true, viewport: null,
    args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension, '--window-size=1440,900'],
  });
  try {
    const page = await context.newPage();
    await mock(page, newServer());
    await page.goto('http://127.0.0.1:5173' + route);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const setZoom = (factor: number) => worker.evaluate(async f => {
      const tabs = (globalThis as unknown as { chrome: { tabs: {
        query(details: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
        setZoom(id: number, zoom: number): Promise<void>;
        getZoom(id: number): Promise<number>;
      } } }).chrome.tabs;
      const tab = (await tabs.query({})).find(item => item.url?.includes('/#/organization/northstar/dashboard/'));
      if (tab?.id === undefined) throw new Error('Missing saved handoff tab');
      await tabs.setZoom(tab.id, f);
      return tabs.getZoom(tab.id);
    }, factor);
    const baseline = await page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio }));
    for (const factor of [2, 4]) {
      expect(await setZoom(factor)).toBeCloseTo(factor, 1);
      await expect.poll(() => page.evaluate(() => innerWidth)).toBeLessThanOrEqual(baseline.width / factor + 2);
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText('Saved revision 1');
      const axe = await new AxeBuilder({ page }).include('.share-context-modal').analyze();
      expect(axe.violations.map(v => v.id)).toEqual([]);
      await snap(page, info, 'native-' + factor * 100);
      const cdp = await context.newCDPSession(page);
      const raw = await cdp.send('Page.captureScreenshot',
        { format: 'png', fromSurface: false, captureBeyondViewport: false });
      const file = info.outputPath('ux41-native-' + factor * 100 + '.png');
      await writeFile(file, Buffer.from(raw.data, 'base64'));
      await info.attach('ux41-native-' + factor * 100, { path: file, contentType: 'image/png' });
      await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    }
  } finally { await context.close(); }
});
