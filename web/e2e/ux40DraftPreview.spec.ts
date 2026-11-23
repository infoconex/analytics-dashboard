import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, test, type Page, type TestInfo } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import type { Dashboard, DashboardDraft, DashboardWidget } from '../src/model';

const id = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3888';
const widget = (index: number, title: string): DashboardWidget => ({
  id: '806e3063-18e9-4ddb-887a-229198c6' + String(index).padStart(4, '0'),
  title, kind: 'metric', datasetKey: 'commerce', metricKey: 'orders', dimensionKey: 'month',
});
const initial: Dashboard = {
  id, organizationId: 'northstar', name: 'Shared dashboard', description: 'Original description',
  revision: 1, createdBy: 'owner', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [widget(1, 'Revenue'), widget(2, 'Orders'), widget(3, 'Sessions')],
};

async function mockApi(page: Page, seed: Dashboard = initial, initialRole: 'owner' | 'viewer' = 'owner') {
  let saved = structuredClone(seed), role = initialRole, failure = false;
  const writes: { expectedRevision: number; status: number; name: string }[] = [];
  let templateWrites = 0;
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'owner', displayName: 'Owner' } });
    if (path === '/api/organizations') return route.fulfill({
      json: [{ id: 'northstar', name: 'Northstar Commerce', role }],
    });
    if (path === '/api/organizations/northstar/dashboards' && method === 'GET')
      return route.fulfill({ json: [saved] });
    if (path === '/api/organizations/northstar/dashboards/' + id) {
      if (method === 'GET') return route.fulfill({ json: saved });
      if (method === 'PUT') {
        const draft = request.postDataJSON() as DashboardDraft & { expectedRevision: number };
        const status = role === 'viewer' ? 403 : failure ? 503 : draft.expectedRevision !== saved.revision ? 409 : 200;
        writes.push({ expectedRevision: draft.expectedRevision, status, name: draft.name });
        if (status !== 200) return route.fulfill({ status });
        saved = { ...saved, ...draft, revision: saved.revision + 1, updatedAt: '2026-02-02T00:00:00Z' };
        return route.fulfill({ json: saved });
      }
    }
    if (path === '/api/organizations/northstar/visualizations') {
      if (method === 'GET') return route.fulfill({ json: [] });
      if (method === 'POST' && role === 'owner') {
        templateWrites++;
        const draft = request.postDataJSON() as { definition: DashboardWidget; description: string };
        return route.fulfill({ status: 201, json: {
          id: 'f8e855a4-8a72-4b25-a64b-7b3e2ed80482', organizationId: 'northstar',
          description: draft.description, definition: draft.definition, revision: 1,
          createdBy: 'owner', createdAt: '', updatedAt: '',
        } });
      }
    }
    return route.fulfill({ status: 403 });
  });
  return {
    saved: () => structuredClone(saved), writes, templates: () => templateWrites,
    failSave: (value: boolean) => { failure = value; },
    role: (value: 'owner' | 'viewer') => { role = value; },
    otherEditor: (patch: (current: Dashboard) => Dashboard) => {
      saved = { ...patch(structuredClone(saved)), revision: saved.revision + 1 };
    },
  };
}

async function openEditor(page: Page) {
  await page.goto('/#/organization/northstar/dashboard/' + id);
  await expect(page.getByRole('heading', { name: 'Shared dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
}
async function enter(page: Page) {
  await page.getByRole('button', { name: 'Preview as viewer' }).click();
  await expect(page.getByRole('region', { name: 'Unsaved dashboard preview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to editing' })).toBeFocused();
}
async function leave(page: Page) {
  await page.getByRole('button', { name: 'Return to editing' }).click();
  await expect(page.getByRole('button', { name: 'Preview as viewer' })).toBeFocused();
}
async function shot(page: Page, info: TestInfo, label: string) {
  const file = info.outputPath('ux40-' + label + '.png');
  await page.screenshot({ path: file, animations: 'disabled' });
  await info.attach(label, { path: file, contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}
const pending = (page: Page) => page.getByRole('region', { name: 'Pending dashboard changes' });

test('no-change preview is explicitly not published and leaves all saved data unchanged', async ({ page }) => {
  const api = await mockApi(page);
  await openEditor(page);
  await enter(page);
  await expect(page.getByRole('heading', { name: 'Shared dashboard' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Unsaved dashboard preview' })).toContainText('No dashboard changes pending');
  await expect(page.getByText(/Last saved revision/)).toContainText('Draft not saved');
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Revenue' })).toHaveCount(0);
  await leave(page);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  expect(api.writes).toHaveLength(0);
});

test('metadata and multiple edits retain UX-39 disclosure, undo and explicit Save', async ({ page }) => {
  const api = await mockApi(page);
  await openEditor(page);
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('New customer summary');
  await page.getByRole('textbox', { name: 'Dashboard description' }).fill('Revised purpose');
  await page.getByRole('button', { name: 'Duplicate Revenue' }).click();
  await page.getByRole('button', { name: 'Remove Sessions' }).click();
  await pending(page).getByText(/Review changes before saving/).click();
  await expect(pending(page).locator('details')).toHaveJSProperty('open', true);
  await enter(page);
  await expect(page.getByRole('heading', { name: 'New customer summary' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Unsaved dashboard preview' })).toContainText('visualization');
  await expect(page.getByRole('button', { name: 'Duplicate Revenue' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove Revenue (copy)' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Revenue (copy)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sessions' })).toHaveCount(0);
  expect(api.writes).toHaveLength(0);
  await leave(page);
  await expect(pending(page).locator('details')).toHaveJSProperty('open', true);
  await expect(page.getByRole('button', { name: 'Undo widget change' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
  expect(api.writes.map(item => item.expectedRevision)).toEqual([1]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'New customer summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revenue (copy)' })).toBeVisible();
  await expect(page.getByText('Draft not saved')).toHaveCount(0);
});

test('widget editing, reorder, resize and undo remain draft-only around preview', async ({ page }) => {
  const api = await mockApi(page);
  await openEditor(page);
  await page.getByRole('button', { name: 'Edit Revenue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Orders overview');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  await page.getByRole('button', { name: 'Move Orders overview later' }).click();
  await page.getByRole('button', { name: /^Resize Orders overview:/ }).focus();
  await page.getByRole('button', { name: /^Resize Orders overview:/ }).press('ArrowDown');
  const before = await page.locator('.widgets-grid [data-widget-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-widget-id')));
  await enter(page);
  const during = await page.locator('.widgets-grid [data-widget-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-widget-id')));
  expect(during).toEqual(before);
  await expect(page.getByRole('heading', { name: 'Orders overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Resize Orders overview:/ })).toHaveCount(0);
  await leave(page);
  await page.getByRole('button', { name: 'Undo widget change' }).click();
  await page.getByRole('button', { name: 'Redo widget change' }).click();
  await expect(pending(page)).toContainText('visualization');
  expect(api.writes).toHaveLength(0);
});

test('preview filters affect fictional sample presentation but never save or share the draft', async ({ page }) => {
  const api = await mockApi(page);
  await openEditor(page);
  await page.getByRole('textbox', { name: 'Dashboard description' }).fill('Preview only');
  await enter(page);
  await page.getByRole('combobox', { name: /Date range/ }).selectOption('3m');
  await expect(page.getByRole('region', { name: 'Unsaved dashboard preview' })).toContainText('Pending: description');
  expect(api.writes).toHaveLength(0);
  await leave(page);
  await expect(page.getByRole('textbox', { name: 'Dashboard description' })).toHaveValue('Preview only');
  await expect(pending(page)).toContainText('Pending: description');
});

test('unsupported and repaired visualizations render through the same consumer path', async ({ page }) => {
  const broken = { ...initial, widgets: [{ ...initial.widgets[0]!, metricKey: 'unknown' }, ...initial.widgets.slice(1)] };
  await mockApi(page, broken);
  await openEditor(page);
  await enter(page);
  await expect(page.getByText(/unavailable|unsupported/i).first()).toBeVisible();
  await leave(page);
  await page.getByRole('button', { name: 'Review configuration for Revenue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await dialog.getByRole('combobox', { name: 'Metric' }).selectOption('orders');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  await enter(page);
  await expect(page.getByRole('region', { name: 'Unsaved dashboard preview' })).toContainText('visualization updated');
  await expect(page.getByRole('heading', { name: 'Revenue' })).toBeVisible();
});

test('empty in-memory dashboard is not mislabeled as a saved empty dashboard', async ({ page }) => {
  await mockApi(page, { ...initial, widgets: [widget(1, 'Revenue')] });
  await openEditor(page);
  await page.getByRole('button', { name: 'Remove Revenue' }).click();
  await enter(page);
  await expect(page.getByText('The current dashboard draft has no visualizations.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add first visualization' })).toHaveCount(0);
});

test('recovered independent edits preview against remote saved baseline; second conflict blocks retry', async ({ page }) => {
  const api = await mockApi(page);
  await openEditor(page);
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Local name');
  await page.getByRole('button', { name: 'Edit Revenue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Local revenue');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  api.otherEditor(current => ({ ...current, description: 'Remote description',
    widgets: current.widgets.map(w => w.title === 'Orders' ? { ...w, title: 'Remote orders' } : w) }));
  await page.getByRole('button', { name: 'Save changes' }).click();
  const conflict = page.getByRole('region', { name: 'Dashboard conflict recovery' });
  await expect(conflict).toBeVisible();
  await conflict.getByText('Review differences and choose edits to recover').click();
  await conflict.getByRole('checkbox', { name: /Dashboard name/ }).check();
  await conflict.getByRole('checkbox', { name: /Local revenue/ }).check();
  page.once('dialog', dialog => void dialog.accept());
  await conflict.getByRole('button', { name: 'Recover selected edits (2)' }).click();
  await enter(page);
  await expect(page.getByRole('heading', { name: 'Local name' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Remote orders' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Local revenue' })).toBeVisible();
  await leave(page);
  await expect(pending(page)).toContainText('Pending: name');
  api.otherEditor(current => ({ ...current, description: 'Remote revision three' }));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(conflict).toBeVisible();
  expect(api.writes.map(write => write.status)).toEqual([409, 409]);
  expect(api.saved().name).toBe('Shared dashboard');
});

test('template Save is independent from preview and transient Save error preserves the draft', async ({ page }) => {
  const api = await mockApi(page);
  await openEditor(page);
  await page.getByRole('textbox', { name: 'Dashboard description' }).fill('Draft');
  await page.getByRole('button', { name: 'Save Revenue to library' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save to visualization library' });
  await dialog.getByRole('textbox', { name: 'Visualization name' }).fill('Reusable revenue');
  await dialog.getByRole('button', { name: 'Save to library' }).click();
  expect(api.templates()).toBe(1);
  await enter(page);
  expect(api.writes).toHaveLength(0);
  await leave(page);
  api.failSave(true);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Your unsaved work is still available');
  await enter(page);
  await expect(page.getByRole('region', { name: 'Unsaved dashboard preview' })).toContainText('Pending: description');
  await leave(page);
  api.failSave(false);
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect(api.writes.map(item => item.status)).toEqual([503, 200]);
});

test('declined navigation preserves preview; accepted navigation discards only after confirmation', async ({ page }) => {
  const api = await mockApi(page);
  await openEditor(page);
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Unpublished');
  await enter(page);
  page.once('dialog', dialog => void dialog.dismiss());
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(page.getByRole('region', { name: 'Unsaved dashboard preview' })).toBeVisible();
  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboards' })).toBeVisible();
  expect(api.saved().name).toBe('Shared dashboard');
  expect(api.writes).toHaveLength(0);
});

test('ordinary viewer and embedded dashboard never expose the in-memory preview', async ({ page }) => {
  const api = await mockApi(page, initial, 'viewer');
  await page.goto('/#/organization/northstar/dashboard/' + id);
  await expect(page.getByRole('button', { name: 'Preview as viewer' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await page.goto('/embed.html#/organization/northstar/dashboard/' + id);
  await expect(page.getByRole('heading', { name: 'Shared dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preview as viewer' })).toHaveCount(0);
  await expect(page.getByText('Unsaved viewer preview')).toHaveCount(0);
  expect(api.writes).toHaveLength(0);
});

test('responsive consumer preview, keyboard focus and forced-colors accessibility', async ({ page }, info) => {
  test.setTimeout(155_000);
  await mockApi(page);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/organization/northstar/dashboard/' + id);
    await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit dashboard' }).click();
    await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Unsaved preview');
    await enter(page);
    await shot(page, info, 'preview-' + width);
    await leave(page);
    await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toHaveValue('Unsaved preview');
    // Finish this session explicitly; navigating with an unsaved draft is
    // intentionally guarded by the existing beforeunload prompt.
    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Forced-colors preview');
  await enter(page);
  await page.emulateMedia({ forcedColors: 'active' });
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map(item => item.id)).toEqual([]);
  await shot(page, info, 'preview-forced-colors-320');
  await page.emulateMedia({ forcedColors: 'none' });
});

test('native Chromium 200% and 400% zoom reflows preview without clipped actions', async ({}, info) => {
  test.setTimeout(120_000);
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true, viewport: null,
    args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension, '--window-size=1440,900'],
  });
  try {
    const page = await context.newPage();
    await mockApi(page);
    await page.goto('http://127.0.0.1:5173/#/organization/northstar/dashboard/' + id);
    await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit dashboard' }).click();
    await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Preview at native zoom');
    await enter(page);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const setZoom = (factor: number) => worker.evaluate(async zoom => {
      const tabs = (globalThis as unknown as { chrome: { tabs: {
        query(options: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
        setZoom(id: number, factor: number): Promise<void>;
        getZoom(id: number): Promise<number>;
      } } }).chrome.tabs;
      const tab = (await tabs.query({})).find(item => item.url?.includes('127.0.0.1:5173/#/organization/northstar/dashboard/'));
      if (tab?.id === undefined) throw new Error('Preview tab unavailable');
      await tabs.setZoom(tab.id, zoom);
      return tabs.getZoom(tab.id);
    }, factor);
    const metrics = () => page.evaluate(() => ({
      cssWidth: innerWidth, dpr: devicePixelRatio,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    const before = await metrics();
    for (const factor of [2, 4]) {
      expect(await setZoom(factor)).toBeCloseTo(factor, 1);
      await expect.poll(async () => (await metrics()).cssWidth).toBeLessThanOrEqual(before.cssWidth / factor + 2);
      const actual = await metrics();
      expect(actual.dpr / before.dpr).toBeCloseTo(factor, 1);
      expect(actual.overflow).toBeLessThanOrEqual(1);
      await expect(page.getByRole('button', { name: 'Return to editing' })).toBeVisible();
      const cdp = await context.newCDPSession(page);
      const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
      const file = info.outputPath('ux40-native-' + factor * 100 + '-chrome.png');
      await writeFile(file, Buffer.from(capture.data, 'base64'));
      await info.attach('native-' + factor * 100, { path: file, contentType: 'image/png' });
      await cdp.detach();
    }
  } finally { await context.close(); }
});
