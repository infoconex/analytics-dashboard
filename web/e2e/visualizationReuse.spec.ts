import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import type { Dashboard, DashboardDraft, DashboardWidget, SavedVisualization, SavedVisualizationDraft } from '../src/model';

const first = '72222222-2222-4222-8222-222222222221';
const second = '72222222-2222-4222-8222-222222222222';
const source: DashboardWidget = {
  id: '806e3063-18e9-4ddb-887a-229198c6dd04',
  title: 'Traffic sources',
  kind: 'donut', datasetKey: 'channels', metricKey: 'orders', dimensionKey: 'channel',
  columns: 9, height: 420,
  appearance: { showLegend: false, showSliceLabels: true, maxSliceLabels: 8, categorySort: 'valueAsc' },
};
const initial: Dashboard[] = [first, second].map((id, index) => ({
  id, organizationId: 'northstar', name: index ? 'Service performance' : 'Fictional analytics',
  description: 'Fictional sample data only.', widgets: index ? [] : [structuredClone(source)],
  revision: 1, createdBy: 'demo-owner', createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}));

async function fixture(page: Page, role: 'owner' | 'viewer' = 'owner') {
  let dashboards = structuredClone(initial);
  let library: SavedVisualization[] = [];
  const calls: string[] = [];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    calls.push(`${method} ${path}`);
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'demo-owner', displayName: 'Demo Analyst' } });
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role }] });
    if (path === '/api/organizations/northstar/dashboards' && method === 'GET')
      return route.fulfill({ json: dashboards });
    if (path.startsWith('/api/organizations/northstar/dashboards/')) {
      const id = path.split('/').pop()!;
      const index = dashboards.findIndex(item => item.id === id);
      if (index < 0) return route.fulfill({ status: 404 });
      if (method === 'PUT' && role === 'owner') {
        const request = route.request().postDataJSON() as DashboardDraft & { expectedRevision: number };
        if (request.expectedRevision !== dashboards[index]!.revision) return route.fulfill({ status: 409 });
        dashboards[index] = { ...dashboards[index]!, ...request, revision: request.expectedRevision + 1 };
      }
      return route.fulfill({ json: dashboards[index] });
    }
    const prefix = '/api/organizations/northstar/visualizations';
    if (path === prefix && method === 'GET') return route.fulfill({ json: library });
    if (path === prefix && method === 'POST' && role === 'owner') {
      const payload = route.request().postDataJSON() as SavedVisualizationDraft;
      const now = '2026-01-01T00:00:00Z';
      const saved: SavedVisualization = { id: randomUUID(), organizationId: 'northstar',
        description: payload.description, definition: { ...payload.definition, id: randomUUID(), columns: null, height: null },
        revision: 1, createdBy: 'demo-owner', createdAt: now, updatedAt: now };
      library = [saved, ...library];
      return route.fulfill({ status: 201, json: saved });
    }
    if (path.startsWith(prefix + '/')) {
      const id = path.split('/').pop()!;
      const index = library.findIndex(item => item.id === id);
      if (index < 0) return route.fulfill({ status: 404 });
      if (method === 'PUT' && role === 'owner') {
        const payload = route.request().postDataJSON() as SavedVisualizationDraft & { expectedRevision: number };
        if (payload.expectedRevision !== library[index]!.revision) return route.fulfill({ status: 409 });
        library[index] = { ...library[index]!, description: payload.description,
          definition: { ...payload.definition, id: library[index]!.definition.id, columns: null, height: null },
          revision: payload.expectedRevision + 1 };
        return route.fulfill({ json: library[index] });
      }
      if (method === 'DELETE' && role === 'owner') {
        library = library.filter(item => item.id !== id);
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ json: library[index] });
    }
    return route.fulfill({ status: 403 });
  });
  return { dashboards: () => dashboards, library: () => library, calls };
}

async function visit(page: Page, id = first) {
  await page.goto(`/#/organization/northstar/dashboard/${id}`);
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  await page.mouse.move(8, 8);
  const path = info.outputPath(`ux23-${name}.png`);
  // Viewport capture, not fullPage: Chromium composites native <dialog> overlays
  // incorrectly into long full-page captures when the background scrolls.
  await page.screenshot({ path, animations: 'disabled', fullPage: false });
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible()) {
    const bounds = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.y).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
  }
  await info.attach(name, { path, contentType: 'image/png' });
  const width = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(width).toBeLessThanOrEqual(1);
  await writeFile(info.outputPath(`ux23-${name}.json`), JSON.stringify({
    viewport: page.viewportSize(), horizontalOverflow: width, sampleOnly: true,
  }, null, 2));
}

test('UX-23 organization library copies, edits, duplicates and survives reload without cross-dashboard mutation', async ({ page }, info) => {
  test.setTimeout(120_000);
  const api = await fixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await visit(page);
  await page.getByRole('button', { name: 'Edit dashboard' }).click();

  await page.getByRole('button', { name: 'Save Traffic sources to library' }).click();
  const saveDialog = page.getByRole('dialog', { name: 'Save to visualization library' });
  await expect(saveDialog).toContainText('independently');
  await saveDialog.getByRole('textbox', { name: 'Visualization name' }).fill('Shared channel orders');
  await saveDialog.getByRole('textbox', { name: 'Description' }).fill('Reusable fictional marketing data');
  await saveDialog.getByRole('button', { name: 'Save to library' }).click();
  await expect(saveDialog).toHaveCount(0);
  expect(api.library()).toHaveLength(1);
  expect(api.library()[0]?.definition.columns).toBeNull();
  expect(api.library()[0]?.definition.appearance?.maxSliceLabels).toBe(8);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();

  await page.getByRole('button', { name: 'Add saved visualization' }).click();
  const picker = page.getByRole('dialog', { name: 'Add saved visualization' });
  await expect(picker).toContainText('independent copy');
  await picker.getByRole('textbox', { name: 'Search saved visualizations' }).fill('channel orders');
  await picker.getByRole('combobox', { name: 'Visualization type' }).selectOption('donut');
  await expect(picker.getByText('Shared channel orders')).toBeVisible();
  await picker.getByRole('button', { name: 'Preview' }).click();
  await expect(picker.getByRole('region', { name: 'Saved visualization preview' })).toContainText('Shared channel orders');
  await screenshot(page, info, 'desktop-library-and-preview');
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(accessibility.violations.map(item => item.id)).toEqual([]);
  await picker.getByRole('button', { name: 'Add copy' }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save changes' }).click();

  expect(api.dashboards()[0]?.widgets).toHaveLength(2);
  const inserted = api.dashboards()[0]!.widgets[1]!;
  expect(inserted.id).not.toBe(source.id);
  expect(inserted.title).toBe('Shared channel orders');
  expect(inserted.columns).toBeUndefined();
  expect(inserted.appearance).toEqual(source.appearance);
  await page.reload();
  await expect(page.getByRole('article', { name: 'Shared channel orders' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('button', { name: 'Duplicate Shared channel orders' }).click();
  await expect(page.getByRole('article', { name: 'Shared channel orders (copy)' })).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  const duplicate = api.dashboards()[0]!.widgets[2]!;
  expect(duplicate.id).not.toBe(inserted.id);
  expect(duplicate.appearance).toEqual(inserted.appearance);

  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('button', { name: 'Add saved visualization' }).click();
  await picker.getByRole('button', { name: 'Edit template' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit saved visualization' });
  await expect(editor).toContainText('Existing dashboard copies remain unchanged');
  await editor.getByRole('textbox', { name: 'Title' }).fill('Updated reusable channel orders');
  await editor.getByRole('textbox', { name: 'Template description' }).fill('Updated for future dashboards');
  await editor.getByRole('button', { name: 'Save template' }).click();
  await expect(picker).toBeVisible();
  expect(api.library()[0]?.revision).toBe(2);
  expect(api.dashboards()[0]!.widgets[1]!.title).toBe('Shared channel orders');
  await picker.getByRole('button', { name: 'Add copy' }).click();
  await expect(page.getByRole('article', { name: 'Updated reusable channel orders' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Updated reusable channel orders' }).click();
  await expect(page.getByRole('article', { name: 'Updated reusable channel orders' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(api.library()).toHaveLength(1);

  await visit(page, second);
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('button', { name: 'Add saved visualization' }).click();
  await picker.getByRole('button', { name: 'Add copy' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect(api.dashboards()[1]?.widgets.map(item => item.title)).toEqual(['Updated reusable channel orders']);
  expect(api.dashboards()[0]?.widgets[1]?.title).toBe('Shared channel orders');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('button', { name: 'Add saved visualization' }).click();
  await screenshot(page, info, 'mobile-library');
  await expect(picker.getByRole('button', { name: 'Close library' })).toBeHidden();
  const closeButton = picker.getByRole('button', { name: 'Close', exact: true });
  const closeBounds = await closeButton.boundingBox();
  expect(closeBounds).not.toBeNull();
  expect(closeBounds!.y + closeBounds!.height).toBeLessThanOrEqual(844);
  const mobileAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(mobileAccessibility.violations.map(item => item.id)).toEqual([]);
  await closeButton.click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
});

test('UX-23 empty saved library is helpful and viewer cannot perform mutations', async ({ page }, info) => {
  const api = await fixture(page);
  await visit(page);
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('button', { name: 'Add saved visualization' }).click();
  const picker = page.getByRole('dialog', { name: 'Add saved visualization' });
  await expect(picker).toContainText('No saved visualizations yet');
  await screenshot(page, info, 'empty-library');
  await picker.getByRole('button', { name: 'Create visualization' }).click();
  await expect(page.getByRole('dialog', { name: 'Configure visualization' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Configure visualization' }).getByRole('button', { name: 'Cancel' }).click();
  expect(api.library()).toHaveLength(0);

  const viewer = await page.context().newPage();
  await fixture(viewer, 'viewer');
  await viewer.goto(`/#/organization/northstar/dashboard/${first}`);
  await expect(viewer.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Add saved visualization' })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Save Traffic sources to library' })).toHaveCount(0);
  await viewer.close();
});
