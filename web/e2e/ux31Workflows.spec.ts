import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Dashboard, DashboardDraft, DashboardWidget, SavedVisualization } from '../src/model';

const stamped = '2026-11-20T15:00:00Z';
const revenue: DashboardWidget = {
  id: 'revenue-widget', title: 'Monthly revenue', kind: 'area',
  datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month',
};
const seed: Dashboard[] = [
  { id: 'customer-adoption', organizationId: 'northstar', name: 'Customer adoption',
    description: 'Fictional adoption trends', widgets: [revenue], revision: 1,
    createdBy: 'sample-owner', createdAt: stamped, updatedAt: stamped },
  { id: 'customer-reliability', organizationId: 'northstar', name: 'Customer reliability',
    description: 'Fictional reliability trends', widgets: [], revision: 1,
    createdBy: 'sample-owner', createdAt: stamped, updatedAt: stamped },
];
const foreign: Dashboard = {
  ...seed[0]!, id: 'foreign-dashboard', organizationId: 'isolated',
  name: 'Private isolated dashboard', widgets: [],
};
const saved: SavedVisualization = {
  id: 'channel-template', organizationId: 'northstar', description: 'Fictional channel orders',
  definition: { id: 'channel-source', title: 'Channel mix', kind: 'bar', datasetKey: 'channels',
    metricKey: 'orders', dimensionKey: 'channel' },
  revision: 1, createdBy: 'sample-owner', createdAt: stamped, updatedAt: stamped,
};
const foreignTemplate: SavedVisualization = {
  ...saved, id: 'foreign-template', organizationId: 'isolated',
  definition: { ...saved.definition, title: 'Private template' },
};
const sizes = [
  { width: 320, height: 900 }, { width: 390, height: 844 },
  { width: 720, height: 850 }, { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

async function fixture(page: Page, role: 'owner' | 'viewer' = 'owner') {
  let dashboards = structuredClone(seed);
  let nextId = 0;
  const writes: string[] = [];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/api/identity') return route.fulfill({ json: {
      userId: 'sample-owner', displayName: 'Fictional Owner',
    } });
    if (path === '/api/organizations') return route.fulfill({ json: [
      { id: 'northstar', name: 'Northstar Commerce', role },
      { id: 'isolated', name: 'Isolated Organization', role: 'viewer' },
    ] });
    if (path === '/api/organizations/northstar/dashboards' && method === 'GET')
      return route.fulfill({ json: [...dashboards, foreign] });
    if (path === '/api/organizations/isolated/dashboards' && method === 'GET')
      return route.fulfill({ json: [foreign] });
    if (path === '/api/organizations/northstar/dashboards' && method === 'POST' && role === 'owner') {
      const data = route.request().postDataJSON() as DashboardDraft;
      const created: Dashboard = {
        ...data, id: 'created-' + ++nextId, organizationId: 'northstar',
        revision: 1, createdBy: 'sample-owner', createdAt: stamped, updatedAt: stamped,
      };
      dashboards = [created, ...dashboards];
      writes.push('create');
      return route.fulfill({ status: 201, json: created });
    }
    if (path.startsWith('/api/organizations/northstar/dashboards/')) {
      const id = path.split('/').pop()!;
      const current = dashboards.find(item => item.id === id);
      if (!current) return route.fulfill({ status: 404 });
      if (method === 'GET') return route.fulfill({ json: current });
      if (method === 'PUT' && role === 'owner') {
        const data = route.request().postDataJSON() as DashboardDraft & { expectedRevision: number };
        if (data.expectedRevision !== current.revision) return route.fulfill({ status: 409 });
        const updated = { ...current, ...data, revision: current.revision + 1, updatedAt: stamped };
        dashboards = dashboards.map(item => item.id === id ? updated : item);
        writes.push('update');
        return route.fulfill({ json: updated });
      }
    }
    if (path === '/api/organizations/northstar/visualizations' && method === 'GET')
      return route.fulfill({ json: [saved, foreignTemplate] });
    if (path === '/api/organizations/isolated/visualizations' && method === 'GET')
      return route.fulfill({ json: [foreignTemplate] });
    return route.fulfill({ status: 403, json: { error: 'Not authorized by fixture' } });
  });
  return { dashboards: () => dashboards, writes };
}

async function capture(page: Page, info: TestInfo, stage: string) {
  const width = page.viewportSize()!.width;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow, stage + ': overflow at ' + width + 'px').toBeLessThanOrEqual(1);
  const path = info.outputPath('ux31-' + stage + '-' + width + '.png');
  await page.screenshot({ path, animations: 'disabled', fullPage: false });
  await info.attach('ux31-' + stage + '-' + width, { path, contentType: 'image/png' });
}

for (const viewport of sizes) {
  test('UX-31 reuse, configure, save and return end-to-end at ' + viewport.width + 'px', async ({ page }, info) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    const api = await fixture(page);
    await page.goto('/#/organization/northstar/dashboards');
    const search = page.getByRole('textbox', { name: 'Search dashboards' });
    await search.fill('Customer');
    const adoption = page.locator('[data-dashboard-id="customer-adoption"]');
    await adoption.getByRole('button', { name: 'View dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Customer adoption' })).toBeVisible();
    await capture(page, info, 'discovered');
    await page.getByRole('button', { name: 'Edit dashboard' }).click();
    await page.getByRole('button', { name: 'Add saved visualization' }).click();
    const picker = page.getByRole('dialog', { name: 'Add saved visualization' });
    const librarySearch = picker.getByRole('textbox', { name: 'Search saved visualizations' });
    await expect(librarySearch).toBeFocused();
    await librarySearch.fill('channel');
    await expect(picker.getByText('Private template')).toHaveCount(0);
    const preview = picker.getByRole('button', { name: 'Preview' });
    await preview.click();
    await expect(preview).toBeFocused();
    await expect(preview).toBeInViewport({ ratio: 0.5 });
    await expect(picker.getByRole('region', { name: 'Saved visualization preview' })).toBeInViewport({ ratio: 0.05 });
    await capture(page, info, 'library-preview');
    await picker.getByRole('button', { name: 'Add copy' }).click();
    const added = page.locator('.widgets-grid [data-widget-id]').last();
    await expect(added.getByRole('heading', { name: 'Channel mix' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await capture(page, info, 'added-copy');
    await added.getByRole('button', { name: 'Edit Channel mix' }).click();
    const editor = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
    await editor.getByRole('textbox', { name: 'Title' }).fill('Channel mix adjusted');
    await editor.getByRole('button', { name: 'Update visualization' }).click();
    await expect(page.getByRole('heading', { name: 'Channel mix adjusted' })).toBeFocused();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
    expect(api.writes).toEqual(['update']);
    await page.getByRole('button', { name: 'Back to dashboards' }).click();
    await expect(search).toHaveValue('Customer');
    await page.locator('[data-dashboard-id="customer-reliability"]')
      .getByRole('button', { name: 'View dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Customer reliability' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to dashboards' }).click();
    await adoption.getByRole('button', { name: 'View dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Channel mix adjusted' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Channel mix adjusted' })).toBeVisible();
    expect(api.dashboards()[0]!.widgets).toHaveLength(2);
    expect(api.dashboards()[0]!.widgets[1]!.id).not.toBe(saved.definition.id);
    expect(saved.definition.title).toBe('Channel mix');
    await capture(page, info, 'saved-return');
  });

  test('UX-31 empty first-dashboard activation at ' + viewport.width + 'px', async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    const api = await fixture(page);
    await page.goto('/#/organization/northstar/dashboards');
    await page.getByRole('button', { name: 'New dashboard', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Create dashboard' });
    await create.getByRole('textbox', { name: 'Dashboard name' }).fill('New customer dashboard');
    await create.getByRole('button', { name: 'Create dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Start with your first visualization' })).toBeVisible();
    await page.getByRole('button', { name: 'Create visualization' }).click();
    const builder = page.getByRole('dialog', { name: 'Configure visualization' });
    await builder.getByRole('textbox', { name: 'Title' }).fill('Initial customer metric');
    await builder.getByRole('button', { name: 'Add to dashboard' }).click();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeFocused();
    await capture(page, info, 'first-visualization');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
    expect(api.writes).toEqual(['create', 'update']);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Initial customer metric' })).toBeVisible();
  });
}

test('UX-31 viewer, direct-link, and tenant boundaries survive navigation', async ({ page }) => {
  await fixture(page, 'viewer');
  await page.goto('/#/organization/northstar/dashboards');
  await expect(page.getByText('Private isolated dashboard')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New dashboard' })).toHaveCount(0);
  await page.locator('[data-dashboard-id="customer-adoption"]')
    .getByRole('button', { name: 'View dashboard' }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await page.goto('/#/organization/northstar/dashboard/foreign-dashboard');
  await expect(page.getByText('Dashboard not found')).toBeVisible();
  await page.goto('/#/organization/isolated/dashboard/foreign-dashboard');
  await expect(page.getByRole('heading', { name: 'Private isolated dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
});


