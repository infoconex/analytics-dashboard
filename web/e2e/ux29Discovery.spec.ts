import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Dashboard, SavedVisualization } from '../src/model';

const dates = (day: number) => `2026-11-${String(day).padStart(2, '0')}T15:00:00Z`;

const dashboards: Dashboard[] = Array.from({ length: 36 }, (_, index) => ({
  id: `discovery-${index + 1}`, organizationId: 'northstar',
  name: index === 0 ? 'Sales briefing — Western territory' : `Sales briefing ${String(index + 1).padStart(2, '0')}`,
  description: index === 0 ? 'Fictional western territory performance' : 'Fictional quarterly sales summary',
  widgets: [], revision: 1, createdBy: index % 2 ? 'fictional-alex' : 'fictional-jordan',
  createdAt: dates(1), updatedAt: dates(index % 18 + 1),
}));

const saved: SavedVisualization[] = Array.from({ length: 18 }, (_, index) => ({
  id: `template-${index + 1}`, organizationId: 'northstar',
  description: index === 0 ? 'Western channel performance over time' : 'Fictional channel revenue trend',
  definition: {
    id: `chart-${index + 1}`,
    title: index === 0 ? 'Channel revenue — Western territory' : `Channel revenue ${index + 1}`,
    kind: index % 2 ? 'donut' : 'bar',
    datasetKey: 'channels', metricKey: 'orders', dimensionKey: 'channel',
  },
  revision: 1, createdBy: index % 2 ? 'fictional-alex' : 'fictional-jordan',
  createdAt: dates(1), updatedAt: dates(index % 18 + 1),
}));

async function catalogFixture(page: Page, role: 'owner' | 'viewer' = 'owner') {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'fictional-jordan', displayName: 'Fictional Analyst' } });
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role }] });
    if (path === '/api/organizations/northstar/dashboards' && method === 'GET') {
      // Intentionally malformed response includes a foreign item: UI must never surface it.
      return route.fulfill({ json: [...dashboards, { ...dashboards[0], id: 'foreign-dashboard', organizationId: 'isolated', name: 'Secret isolated report' }] });
    }
    if (path === '/api/organizations/northstar/visualizations' && method === 'GET') {
      return route.fulfill({ json: [...saved, { ...saved[0], id: 'foreign-template', organizationId: 'isolated', definition: { ...saved[0]!.definition, title: 'Secret isolated chart' } }] });
    }
    return route.fulfill({ status: 403, json: { error: 'Not available in fictional discovery fixture' } });
  });
}

async function evidence(page: Page, info: TestInfo, stage: string, width: number) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${stage} at ${width}px`).toBeLessThanOrEqual(1);
  const path = info.outputPath(`ux29-${stage}-${width}.png`);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  await info.attach(`ux29-${stage}-${width}`, { path, contentType: 'image/png' });
}

test('UX-29 dense dashboard catalog supports recognizable search, sorting, return, and viewer boundaries', async ({ page }) => {
  await catalogFixture(page, 'viewer');
  await page.goto('/#/organization/northstar/dashboards');
  await expect(page.locator('.dashboard-card')).toHaveCount(36);
  await expect(page.getByText('Secret isolated report')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New dashboard' })).toHaveCount(0);
  await expect(page.locator('.catalog-delete')).toHaveCount(0);
  await expect(page.locator('.dashboard-card').first()).toContainText('Created by fictional-');
  await expect(page.getByText('36 of 36 dashboards')).toBeVisible();

  const query = page.getByRole('textbox', { name: 'Search dashboards' });
  await query.fill('  WESTERN   performance  ');
  await expect(page.locator('.dashboard-card')).toHaveCount(1);
  await expect(page.getByText('1 of 36 dashboards')).toBeVisible();
  await page.getByRole('button', { name: 'View dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Sales briefing — Western territory' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(query).toHaveValue('  WESTERN   performance  ');
  await expect(page.locator('.dashboard-card')).toHaveCount(1);

  await query.fill('does-not-exist');
  await expect(page.getByRole('heading', { name: 'No matching dashboards' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all dashboards' }).click();
  await expect(page.locator('.dashboard-card')).toHaveCount(36);
  await page.getByRole('combobox', { name: 'Sort dashboards' }).selectOption('name-desc');
  await expect(page.locator('.dashboard-card').first()).toContainText('Western territory');
});

test('UX-29 five-width dashboard and library evidence, filtering, preview, permissions and independent copy', async ({ page }, info) => {
  test.setTimeout(180_000);
  await catalogFixture(page);
  await page.goto('/#/organization/northstar/dashboards');
  const viewports = [
    { width: 320, height: 900 }, { width: 390, height: 844 },
    { width: 720, height: 850 }, { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];
  for (const { width, height } of viewports) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('.dashboard-card')).toHaveCount(36);
    await evidence(page, info, 'dashboard-catalog', width);
    await expect(page.getByRole('combobox', { name: 'Sort dashboards' })).toBeVisible();
  }

  await page.getByRole('button', { name: 'View dashboard' }).first().click();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  for (const { width, height } of viewports) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: 'Add saved visualization' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add saved visualization' });
    await expect(dialog.getByText('18 of 18 saved visualizations')).toBeVisible();
    await expect(dialog.getByText('Secret isolated chart')).toHaveCount(0);
    await expect(dialog.getByRole('combobox', { name: 'Sort saved visualizations' })).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Search saved visualizations' }).fill('western');
    await expect(dialog.getByRole('status')).toContainText('1 of 18');
    await dialog.getByRole('button', { name: 'Preview' }).click();
    await expect(dialog.getByRole('region', { name: 'Saved visualization preview' })).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await evidence(page, info, 'library-preview', width);
    if (width === 320 || width === 390) {
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(accessibility.violations.map(item => item.id)).toEqual([]);
    }
    await dialog.getByRole('button', { name: 'Clear filters' }).click();
    await expect(dialog.getByRole('textbox', { name: 'Search saved visualizations' })).toBeFocused();
    await dialog.getByRole('combobox', { name: 'Visualization type' }).selectOption('donut');
    await expect(dialog.getByRole('status')).toContainText('9 of 18');
    await dialog.getByRole('textbox', { name: 'Search saved visualizations' }).fill('not-real');
    await expect(dialog.getByText('No matching saved visualizations')).toBeVisible();
    await dialog.getByRole('button', { name: 'Show all visualizations' }).click();
    await expect(dialog.getByRole('status')).toContainText('18 of 18');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Add saved visualization' }).click();
  await page.getByRole('dialog', { name: 'Add saved visualization' }).getByRole('button', { name: 'Add copy' }).first().click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: 'Added an independent copy' })).toBeVisible();
});
