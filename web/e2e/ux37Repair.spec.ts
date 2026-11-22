import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Dashboard, DashboardDraft, DashboardWidget } from '../src/model';

const id = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3777';
const definitions = [
  ['Revenue', 'metric', 'commerce', 'revenue', 'month'],
  ['Legacy metric', 'metric', 'commerce', 'unrecognized', 'month'],
  ['Channel orders', 'bar', 'channels', 'orders', 'channel'],
  ['Legacy dimension', 'line', 'commerce', 'orders', 'former-month'],
  ['Conversion slices', 'donut', 'channels', 'conversion', 'channel'],
  ['Missing source', 'area', 'future-source', 'revenue', 'month'],
  ['Revenue trend', 'area', 'commerce', 'revenue', 'month'],
  ['Channel sessions', 'table', 'channels', 'sessions', 'channel'],
  ['Channel comparison', 'scatter', 'channels', 'orders', 'sessions'],
] as const;
const initial: Dashboard = {
  id, organizationId: 'northstar', name: 'Sample repair', description: 'Mixed supported and unsupported fictional charts',
  revision: 1, createdBy: 'demo-owner', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: definitions.map(([title, kind, datasetKey, metricKey, dimensionKey], index) => ({
    id: `806e3063-18e9-4ddb-887a-229198c6${String(index + 1).padStart(4, '0')}`,
    title, kind: kind as DashboardWidget['kind'], datasetKey: datasetKey as DashboardWidget['datasetKey'], metricKey, dimensionKey,
    columns: 6, height: 360,
  })),
};

async function api(page: Page, role: 'owner' | 'viewer' = 'owner') {
  let saved = structuredClone(initial);
  let conflict = false;
  const writes: string[] = [];
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname, method = route.request().method();
    if (method !== 'GET') writes.push(`${method} ${path}`);
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'demo-owner', displayName: 'Demo Analyst' } });
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role }] });
    if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [saved] });
    if (path === `/api/organizations/northstar/dashboards/${id}`) {
      if (method === 'GET') return route.fulfill({ json: saved });
      if (method === 'PUT' && role === 'owner') {
        const draft = route.request().postDataJSON() as DashboardDraft & { expectedRevision: number };
        if (conflict || draft.expectedRevision !== saved.revision) {
          saved = { ...saved, name: 'Newer server revision', revision: saved.revision + 1 };
          conflict = false;
          return route.fulfill({ status: 409, json: { title: 'Revision conflict' } });
        }
        saved = { ...saved, name: draft.name, description: draft.description, widgets: draft.widgets,
          revision: saved.revision + 1 };
        return route.fulfill({ json: saved });
      }
    }
    return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
  });
  return { writes, saved: () => saved, conflictNextSave: () => { conflict = true; } };
}

async function open(page: Page) {
  await page.goto(`/#/organization/northstar/dashboard/${id}`);
  await expect(page.getByRole('heading', { name: 'Sample repair' })).toBeVisible();
  await expect(page.locator('.canvas-item')).toHaveCount(9);
}

async function screenshot(page: Page, info: TestInfo, label: string) {
  const path = info.outputPath(`ux37-${label}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(label, { path, contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test('direct repair exposes original unsupported fields and restores only the selected widget', async ({ page }, info) => {
  const server = await api(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const legacy = page.getByRole('article', { name: 'Legacy metric' });
  await expect(legacy).toContainText('saved metric is not supported');
  await legacy.getByRole('button', { name: 'Review configuration for Legacy metric' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Configuration needs review' })).toBeFocused();
  await expect(dialog.getByRole('combobox', { name: 'Metric' })).toHaveValue('unrecognized');
  await expect(dialog.getByRole('combobox', { name: 'Metric' }).locator('option:checked')).toContainText('Unsupported saved metric');
  await expect(dialog.getByRole('button', { name: 'Update visualization' })).toBeDisabled();
  await expect(dialog.getByRole('region', { name: 'Live visualization preview' })).toContainText('Insight unavailable');
  await screenshot(page, info, 'editor-unsupported-metric-1440');

  await dialog.getByRole('combobox', { name: 'Metric' }).selectOption('orders');
  await expect(dialog.getByRole('group', { name: 'Configuration needs review' })).toHaveCount(0);
  await expect(dialog.getByRole('region', { name: 'Live visualization preview' })).toContainText('Orders');
  await screenshot(page, info, 'editor-repaired-preview-1440');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  await expect(page.getByRole('heading', { name: 'Legacy metric', exact: true })).toBeFocused();
  await expect(page.getByRole('article', { name: 'Legacy metric' }).locator('.metric-number')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Missing source' })).toContainText('source unavailable');
  await expect(page.getByRole('button', { name: 'Undo widget change' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo widget change' }).click();
  await expect(page.getByRole('article', { name: 'Legacy metric' })).toContainText('Insight unavailable');
  await page.getByRole('button', { name: 'Redo widget change' }).click();
  await expect(page.getByRole('article', { name: 'Legacy metric' }).locator('.metric-number')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
  expect(server.saved().widgets[1]?.metricKey).toBe('orders');
  expect(server.saved().widgets[0]).toEqual(initial.widgets[0]);
  expect(server.saved().widgets.map(item => item.id)).toEqual(initial.widgets.map(item => item.id));
  expect(server.saved().widgets.map(item => [item.columns, item.height])).toEqual(initial.widgets.map(item => [item.columns, item.height]));
  await page.reload();
  await expect(page.getByRole('article', { name: 'Legacy metric' }).locator('.metric-number')).toBeVisible();
  expect(server.writes).toHaveLength(1);
});

test('missing fictional source and invalid dimension require explicit choices; cancellation retains original', async ({ page }, info) => {
  await api(page);
  await open(page);
  await page.getByRole('article', { name: 'Missing source' }).getByRole('button', { name: /Review configuration/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await expect(dialog.getByRole('combobox', { name: 'Dataset' })).toHaveValue('future-source');
  await expect(dialog.getByRole('combobox', { name: 'Dataset' }).locator('option:checked')).toContainText('Unsupported saved source');
  await dialog.getByRole('combobox', { name: 'Dataset' }).selectOption('commerce');
  await expect(dialog.getByRole('button', { name: 'Update visualization' })).toBeEnabled();
  page.once('dialog', prompt => prompt.accept());
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('article', { name: 'Missing source' })).toContainText('source unavailable');
  await expect(page.getByRole('heading', { name: 'Missing source' })).toBeFocused();
  await page.getByRole('button', { name: 'Review configuration for Legacy dimension' }).click();
  await expect(dialog.getByRole('group', { name: 'Configuration needs review' })).toContainText('selected dimension does not match');
  await expect(dialog.locator('.visualization-dimension')).toContainText('former-month');
  await dialog.getByRole('button', { name: 'Use supported dimension: month' }).click();
  await expect(dialog.getByRole('button', { name: 'Update visualization' })).toBeEnabled();
  await screenshot(page, info, 'repaired-dimension');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  await expect(page.getByRole('article', { name: 'Legacy dimension' }).locator('.recharts-wrapper')).toBeVisible();
});

test('long-dashboard index marks only genuinely unavailable cards and filtered results use filter recovery', async ({ page }) => {
  await api(page);
  await open(page);
  const nav = page.getByRole('navigation', { name: 'Find a visualization' });
  await expect(nav.getByRole('combobox', { name: 'Find a visualization' })).toContainText('Legacy metric — Unavailable');
  await expect(nav.getByRole('combobox', { name: 'Find a visualization' })).toContainText('Conversion slices — Unavailable');
  await expect(nav.getByRole('combobox', { name: 'Find a visualization' })).not.toContainText('Revenue — Unavailable');
  await nav.getByRole('combobox', { name: 'Find a visualization' }).selectOption(initial.widgets[5]!.id);
  await nav.getByRole('button', { name: 'Go to visualization' }).click();
  await expect(page.getByRole('heading', { name: 'Missing source' })).toBeFocused();
  await expect(page.getByRole('article', { name: 'Conversion slices' })).toContainText('cannot be summed');
  const channel = page.getByRole('combobox', { name: 'Marketing channel' });
  await channel.evaluate((element: HTMLSelectElement) => {
    element.add(new Option('Unknown channel', 'Unknown channel'));
    element.value = 'Unknown channel';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByRole('article', { name: 'Channel orders' })).toContainText('No matching sample data');
  await expect(page.getByRole('article', { name: 'Channel orders' }).getByRole('button', { name: /Review configuration/ })).toHaveCount(0);
  await expect(nav.getByRole('combobox', { name: 'Find a visualization' })).toContainText('Channel orders — No matching records');
  await expect(page.getByRole('article', { name: 'Revenue', exact: true }).locator('.metric-number')).toBeVisible();
  await page.getByRole('article', { name: 'Channel orders' }).getByRole('button', { name: /Clear channel filter/ }).click();
  await expect(channel).toHaveValue('');
});

test('viewer and embedded read-only consumers cannot open repair or modify dashboard', async ({ page }) => {
  const server = await api(page, 'viewer');
  await open(page);
  await expect(page.getByRole('article', { name: 'Legacy metric' })).toContainText('saved metric is not supported');
  await expect(page.getByRole('button', { name: /Review configuration|Edit dashboard/ })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(server.writes).toEqual([]);
});

test('stale revision keeps repaired draft and requires existing explicit conflict recovery', async ({ page }) => {
  const server = await api(page);
  await open(page);
  await page.getByRole('article', { name: 'Legacy metric' }).getByRole('button', { name: /Review configuration/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await dialog.getByRole('combobox', { name: 'Metric' }).selectOption('orders');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  server.conflictNextSave();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('region', { name: 'Dashboard conflict recovery' })).toContainText('latest saved revision 2');
  await expect(page.getByRole('article', { name: 'Legacy metric' }).locator('.metric-number')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  expect(server.saved().widgets[1]?.metricKey).toBe('unrecognized');
});

test('responsive authoring and forced-colors repair controls remain navigable with axe checks', async ({ page }, info) => {
  test.setTimeout(150_000);
  await api(page);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1440) await open(page);
    else {
      // The dashboard remains in unsaved composition mode after closing its
      // widget dialog. A same-URL goto does not promise a document reload.
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Sample repair' })).toBeVisible();
    }
    await page.getByRole('article', { name: 'Legacy metric' }).getByRole('button', { name: /Review configuration/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
    await expect(dialog.getByRole('combobox', { name: 'Metric' })).toHaveAttribute('aria-invalid', 'true');
    await dialog.getByRole('combobox', { name: 'Metric' }).scrollIntoViewIfNeeded();
    await screenshot(page, info, `repair-editor-${width}`);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  }
  await page.emulateMedia({ forcedColors: 'active' });
  await page.getByRole('article', { name: 'Legacy metric' }).getByRole('button', { name: /Review configuration/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await expect(dialog.locator('.visualization-repair-summary')).toHaveCSS('borderTopStyle', 'solid');
  const findings = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(findings.violations.map(item => item.id)).toEqual([]);
  await screenshot(page, info, 'repair-forced-colors-320');
});
