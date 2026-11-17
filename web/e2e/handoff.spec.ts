import { chromium, expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dashboard, DashboardWidget } from '../src/model';

const id = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const widget = (index: number, title: string, datasetKey: DashboardWidget['datasetKey'], metricKey: string, kind: DashboardWidget['kind']): DashboardWidget => ({
  id: `996e3063-18e9-4ddb-887a-229198c6dd${String(index).padStart(2, '0')}`,
  title, kind, datasetKey, metricKey, dimensionKey: datasetKey === 'commerce' ? 'month' : 'channel',
});
const sample: Dashboard = {
  id, organizationId: 'northstar', name: 'Business performance', description: 'Fictional business insights',
  widgets: [widget(1, 'Revenue over time', 'commerce', 'revenue', 'area'), widget(2, 'Orders by channel', 'channels', 'orders', 'bar')],
  createdBy: 'demo', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', revision: 1,
};
const dense = { ...sample, widgets: Array.from({ length: 12 }, (_, i) => ({
  ...sample.widgets[i % 2]!, id: `996e3063-18e9-4ddb-887a-229198c6dd${String(i + 1).padStart(2, '0')}`,
  title: i === 11 ? 'Regional revenue' : `Visualization ${i + 1}`,
})) };
const isolated = { ...sample, id: '18ff3350-79f4-4bb8-8d73-9b5e6885df89', organizationId: 'isolated', name: 'Isolated insights', widgets: [widget(1, 'Isolated orders', 'commerce', 'orders', 'bar')] };

async function fictionalApi(page: Page, selected: Dashboard = sample, writes: string[] = []) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') {
      writes.push(`${route.request().method()} ${path}`);
      await route.fulfill({ status: 405, body: 'No writes in fixture' });
    } else if (path === '/api/identity') {
      await route.fulfill({ json: { userId: 'sample', displayName: 'Sample Viewer' } });
    } else if (path === '/api/organizations') {
      await route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }, { id: 'isolated', name: 'Isolated Tenant', role: 'viewer' }] });
    } else if (path === '/api/organizations/northstar/dashboards') {
      await route.fulfill({ json: [selected] });
    } else if (path === '/api/organizations/isolated/dashboards') {
      await route.fulfill({ json: [isolated] });
    } else if (path === `/api/organizations/northstar/dashboards/${selected.id}`) {
      await route.fulfill({ json: selected });
    } else if (path === `/api/organizations/isolated/dashboards/${isolated.id}`) {
      await route.fulfill({ json: isolated });
    } else {
      await route.fulfill({ status: 403, body: 'Not authorized' });
    }
  });
}

async function screenshot(page: Page, info: TestInfo, label: string) {
  const path = info.outputPath(`ux10-${label}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(`ux10-${label}`, { path, contentType: 'image/png' });
}

async function noOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth, document: document.documentElement.scrollWidth,
    dialogWidth: document.querySelector('dialog')?.clientWidth, dialogScrollWidth: document.querySelector('dialog')?.scrollWidth,
  }));
  expect(sizes.document, `page overflow ${JSON.stringify(sizes)}`).toBeLessThanOrEqual(sizes.viewport + 1);
  if (sizes.dialogWidth) expect(sizes.dialogScrollWidth, `dialog overflow ${JSON.stringify(sizes)}`).toBeLessThanOrEqual(sizes.dialogWidth + 1);
}

test.use({ reducedMotion: 'reduce' });

test('SC-UX10-01/02/03: discover, share, interpret, keyboard, copy failure, and revisit', async ({ page }, info) => {
  const errors: string[] = [];
  const steps: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await fictionalApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^Dashboards/ }).click();
  const catalogShare = page.getByRole('button', { name: 'Share Business performance' });
  await catalogShare.focus();
  await page.keyboard.press('Enter'); steps.push('Open catalog share with keyboard');
  const dialog = page.getByRole('dialog', { name: 'Share dashboard' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Northstar Commerce')).toBeVisible();
  await expect(dialog.getByText(/default filters for people authorized/)).toBeVisible();
  await expect(dialog.locator('.share-link-field')).toBeFocused();
  await expect(dialog.locator('.share-link-field')).toHaveValue(`http://127.0.0.1:5173/#/organization/northstar/dashboard/${id}`);
  await dialog.getByRole('button', { name: 'Done' }).click(); steps.push('Close dialog and return focus');
  await expect(catalogShare).toBeFocused();

  await page.getByRole('button', { name: 'View dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct'); steps.push('Apply independent month/channel filters');
  const share = page.getByRole('button', { name: 'Share', exact: true });
  await share.focus(); await page.keyboard.press('Enter');
  await dialog.getByText('Include your current viewing context').click();
  const context = dialog.getByRole('textbox', { name: /Context note/ });
  await expect(context).toHaveValue(/Commerce: Final 3 sample months/);
  await expect(context).toHaveValue(/Marketing channels: Direct \(no dates\)/);
  await expect(context).toHaveValue(/not preserved by this link/);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Blocked in fixture')) } }));
  await dialog.getByRole('button', { name: 'Copy context note' }).click(); steps.push('Recover from unavailable clipboard');
  await expect(dialog.getByRole('status')).toContainText('copy it manually');
  await expect(context).toBeFocused();
  await screenshot(page, info, 'filtered-share-desktop');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(share).toBeFocused();

  const chart = page.getByRole('article', { name: 'Revenue over time' });
  await chart.locator('.insight-context > summary').click();
  await chart.getByRole('button', { name: 'Share this insight’s context' }).click(); steps.push('Open a metric-specific note from expanded interpretation');
  const insightDialog = page.getByRole('dialog', { name: 'Share insight context' });
  await insightDialog.getByText('Include this insight’s context and exact values').click();
  const note = insightDialog.getByRole('textbox', { name: /Context note/ });
  await expect(note).toHaveValue(/Oct: \$41,400/);
  await expect(note).toHaveValue(/Dec: \$48,300/);
  await expect(note).not.toHaveValue(/Jan: \$18,400/);
  await expect(note).toHaveValue(/channel filter does not apply to commerce/);
  await screenshot(page, info, 'insight-note-desktop');
  await insightDialog.getByRole('button', { name: 'Done' }).click();
  await page.reload(); steps.push('Revisit saved dashboard and observe default filters');
  await expect(page.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('12m');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('');
  await expect(page.getByRole('article', { name: 'Revenue over time' })).toContainText('Jan–Dec');
  expect(errors).toEqual([]);
  const record = {
    os: process.platform, chromium: page.context().browser()?.version(), viewport: page.viewportSize(),
    scriptedSteps: steps, focusRestored: ['catalog share', 'dashboard share'], errors,
    evidence: 'fictional frontend fixtures; automated script, not validated human usability or production authorization',
  };
  await writeFile(info.outputPath('ux10-handoff-task.json'), JSON.stringify(record, null, 2));
});

test('SC-UX10-04/05: dense keyboard index, organization reset, invalid location recovery', async ({ page }, info) => {
  await fictionalApi(page, dense);
  await page.goto(`/#/organization/northstar/dashboard/${id}`);
  await page.getByRole('combobox', { name: 'Find a visualization' }).selectOption(dense.widgets[11]!.id);
  await page.getByRole('button', { name: 'Go to visualization' }).focus();
  await page.keyboard.press('Enter');
  const last = page.getByRole('article', { name: 'Regional revenue' });
  await expect(last.getByRole('heading', { name: 'Regional revenue' })).toBeFocused();
  await last.getByRole('button', { name: 'Back to visualization list from Regional revenue' }).click();
  await expect(page.getByRole('button', { name: '12. Regional revenue' })).toBeFocused();
  await screenshot(page, info, 'dense-index-focus');
  await page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
  await page.getByRole('combobox', { name: 'Switch organization' }).selectOption('isolated');
  await page.getByRole('button', { name: /^Dashboards/ }).click();
  await page.getByRole('button', { name: 'Share Isolated insights' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share dashboard' });
  await expect(dialog).toContainText('Isolated Tenant');
  await expect(dialog).not.toContainText('Northstar Commerce');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.goto(`/#/organization/unknown/dashboard/${id}`);
  await expect(page.getByText(/requested organization is unavailable/)).toBeVisible();
  await expect(page).toHaveURL(/#\/organization\/northstar\/overview$/);
  await page.goto(`/#/organization/isolated/dashboard/${id}`);
  await expect(page.getByRole('heading', { name: 'Dashboard not found' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboards' })).toBeVisible();
});

test('SC-UX10-06: same-origin framed viewer can copy context without authoring', async ({ page }, info) => {
  const writes: string[] = [];
  await fictionalApi(page, sample, writes);
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('iframe.host-frame');
  const chart = frame.getByRole('article', { name: 'Revenue over time' });
  await chart.locator('.insight-context > summary').click();
  await chart.getByRole('button', { name: 'Share this insight’s context' }).click();
  const dialog = frame.getByRole('dialog', { name: 'Share insight context' });
  await expect(dialog).toContainText('Northstar Commerce');
  await dialog.getByText('Include this insight’s context and exact values').click();
  await expect(dialog.getByRole('textbox', { name: /Context note/ })).toHaveValue(/Jan: \$18,400/);
  await expect(frame.getByRole('button', { name: /Edit dashboard|Save changes|New dashboard/ })).toHaveCount(0);
  await screenshot(page, info, 'embedded-insight-dialog');
  expect(writes).toEqual([]);
});

for (const { width, height, label } of [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 390, height: 844, label: 'mobile' },
  { width: 320, height: 900, label: 'narrow' },
]) {
  test(`SC-UX10-07: accessible context handoff at ${width}×${height}`, async ({ page }, info) => {
    await fictionalApi(page);
    await page.setViewportSize({ width, height });
    await page.goto(`/#/organization/northstar/dashboard/${id}`);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share dashboard' });
    await expect(dialog.locator('.share-link-field')).toBeFocused();
    await dialog.getByText('Include your current viewing context').click();
    await noOverflow(page);
    const result = await new AxeBuilder({ page }).include('.share-context-modal').analyze();
    expect(result.violations).toEqual([]);
    await screenshot(page, info, `share-${label}`);
    await dialog.getByRole('button', { name: 'Done' }).click();
  });
}

test('SC-UX10-07: forced colors preserve labels, scope and focus', async ({ page }, info) => {
  await fictionalApi(page);
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto(`/#/organization/northstar/dashboard/${id}`);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share dashboard' });
  await dialog.getByText('Include your current viewing context').click();
  await expect(dialog.getByText(/not saved in the link/)).toBeVisible();
  await screenshot(page, info, 'forced-colors');
  await noOverflow(page);
});

test('SC-UX10-07: genuine native Chromium zoom at 200%/400% preserves handoff and focus', async ({}, info) => {
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true, viewport: null,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1440,900'],
  });
  const evidence: unknown[] = [];
  try {
    const page = await context.newPage();
    await fictionalApi(page);
    await page.goto(`http://127.0.0.1:5173/#/organization/northstar/dashboard/${id}`);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const setZoom = (factor: number) => worker.evaluate(async f => {
      const tabs = (globalThis as unknown as { chrome: { tabs: {
        query(details: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
        setZoom(id: number, zoom: number): Promise<void>;
        getZoom(id: number): Promise<number>;
      } } }).chrome.tabs;
      const tab = (await tabs.query({})).find(item => item.url?.includes('/#/organization/northstar/dashboard/'));
      if (tab?.id === undefined) throw new Error('Handoff tab missing');
      await tabs.setZoom(tab.id, f);
      return tabs.getZoom(tab.id);
    }, factor);
    const metrics = () => page.evaluate(() => ({ viewport: innerWidth, dpr: devicePixelRatio, overflow: document.documentElement.scrollWidth > innerWidth }));
    const baseline = await metrics();
    for (const factor of [2, 4]) {
      const actual = await setZoom(factor);
      await expect.poll(async () => (await metrics()).viewport).toBeLessThanOrEqual(baseline.viewport / factor + 2);
      const observed = await metrics();
      expect(actual).toBeCloseTo(factor, 1);
      expect(observed.dpr / baseline.dpr).toBeCloseTo(factor, 1);
      expect(observed.overflow).toBe(false);
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Share dashboard' })).toBeVisible();
      await noOverflow(page);
      const cdp = await context.newCDPSession(page);
      const raw = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
      const path = info.outputPath(`ux10-native-${factor * 100}-chrome.png`);
      await writeFile(path, Buffer.from(raw.data, 'base64'));
      await info.attach(`ux10-native-${factor * 100}-chrome`, { path, contentType: 'image/png' });
      evidence.push({ factor, actual, baseline, observed, chromium: context.browser()?.version(), os: process.platform });
      await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    }
  } finally {
    const path = info.outputPath('ux10-native-zoom.json');
    await writeFile(path, JSON.stringify(evidence, null, 2));
    await info.attach('ux10-native-zoom.json', { path, contentType: 'application/json' });
    await context.close();
  }
});
