import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Dashboard } from '../src/model';

const dashboardId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const dashboard: Dashboard = {
  id: dashboardId, organizationId: 'northstar', name: 'Mixed filter scope', description: 'Fictional sample dashboard',
  revision: 7, createdBy: 'demo-owner', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [
    { id: 'legacy', title: 'Legacy revenue', kind: 'metric', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' },
    { id: 'sales', title: 'Saved sales query', kind: 'bar', datasetKey: 'fictionalQuery', metricKey: 'query', dimensionKey: 'query',
      queryDefinition: { dataset: 'sales', visualization: 'bar', groupByDimension: 'order_status', aggregate: 'sum', measureDimension: 'amount' } },
    { id: 'inventory', title: 'Saved inventory query', kind: 'bar', datasetKey: 'fictionalQuery', metricKey: 'query', dimensionKey: 'query',
      queryDefinition: { dataset: 'inventory', visualization: 'bar', groupByDimension: 'category', aggregate: 'sum', measureDimension: 'stock_value' } },
  ],
};

async function installReadOnlyDashboard(page: import('@playwright/test').Page) {
  const writes: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push(`${request.method()} ${path}`);
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] });
    if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [dashboard] });
    if (path === `/api/organizations/northstar/dashboards/${dashboardId}`) return route.fulfill({ json: dashboard });
    return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
  });
  return writes;
}

test('EXP-07 unifies consumer filters and reports real per-card scope in standalone and embedded dashboards', async ({ page }, info) => {
  test.setTimeout(120_000);
  const writes = await installReadOnlyDashboard(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/#/organization/northstar/dashboard/${dashboardId}`);

  const filterPanel = page.locator('.dashboard-consumer-filter');
  await expect(filterPanel.locator('summary')).toContainText('Dashboard filters');
  await filterPanel.locator('summary').press('Enter');
  await expect(filterPanel).toHaveAttribute('open', '');
  await expect(page.getByText(/Authored query preview|Experimental business filters|Experimental reporting period/)).toHaveCount(0);
  await expect(page.locator('.query-preview')).toHaveCount(0);

  const calendar = filterPanel.locator('.reporting-calendar');
  await calendar.getByRole('combobox', { name: 'Reporting period' }).selectOption('custom');
  await calendar.getByLabel('Start date and time', { exact: true }).fill('2026-11-18T00:00');
  await calendar.getByLabel('End date and time (exclusive)').fill('2026-11-21T00:00');
  await calendar.getByRole('button', { name: 'Apply reporting period' }).press('Enter');

  const business = filterPanel.locator('.field-filter-builder');
  await business.getByRole('combobox', { name: 'Business dimension' }).selectOption('customer_id');
  await business.getByRole('combobox', { name: 'Filter comparison' }).selectOption('Equal');
  await business.getByRole('textbox', { name: 'Filter value' }).fill('C-103');
  await business.getByRole('button', { name: 'Apply filter' }).press('Enter');

  const sales = page.getByRole('article', { name: 'Saved sales query' });
  const inventory = page.getByRole('article', { name: 'Saved inventory query' });
  const legacy = page.getByRole('article', { name: 'Legacy revenue' });
  await expect(sales).toContainText('Open');
  await expect(sales).toContainText('2,400');
  await expect(sales).toContainText('Applied 1 typed filter before aggregation.');
  await expect(sales).toContainText('Reporting period applied before aggregation.');
  await expect(inventory).toContainText('Adapters');
  await expect(inventory).toContainText('Unchanged: no typed filters could be applied.');
  await expect(inventory).toContainText('no approved reporting-time mapping');
  await expect(legacy).toContainText('Business filters and reporting period are not applied');
  await expect(page.getByText(/Saved revision 7/)).toBeVisible();
  await expect(page.locator('.consumer-filters')).toContainText('Sample month and channel filters');
  await expect(writes).toEqual([]);

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const bounds = await filterPanel.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth,
      document: node.ownerDocument.documentElement.scrollWidth, viewport: node.ownerDocument.defaultView!.innerWidth }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
    expect(bounds.document).toBeLessThanOrEqual(bounds.viewport + 1);
    const path = info.outputPath(`exp07-standalone-${width}.png`);
    await page.screenshot({ path, animations: 'disabled', fullPage: true });
    await info.attach(`exp07-standalone-${width}`, { path, contentType: 'image/png' });
  }
  await page.emulateMedia({ forcedColors: 'active' });
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map(item => item.id)).toEqual([]);
  const forced = info.outputPath('exp07-standalone-forced-colors.png');
  await page.screenshot({ path: forced, animations: 'disabled', fullPage: true });
  await info.attach('exp07-standalone-forced-colors', { path: forced, contentType: 'image/png' });

  await page.emulateMedia({ forcedColors: 'none' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('.host-frame');
  const embeddedFilter = frame.locator('.dashboard-consumer-filter');
  await expect(embeddedFilter.locator('summary')).toContainText('Dashboard filters');
  await embeddedFilter.locator('summary').press('Enter');
  await frame.getByRole('article', { name: 'Saved sales query' }).getByText('Open').waitFor();
  const embeddedPath = info.outputPath('exp07-embedded-1440.png');
  await page.screenshot({ path: embeddedPath, animations: 'disabled', fullPage: true });
  await info.attach('exp07-embedded-1440', { path: embeddedPath, contentType: 'image/png' });
  await expect(writes).toEqual([]);
});
