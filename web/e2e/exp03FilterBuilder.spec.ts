import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Dashboard } from '../src/model';

const dashboardId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const dashboard: Dashboard = {
  id: dashboardId, organizationId: 'northstar', name: 'Field filter evaluation',
  description: 'Fictional sample dashboard', revision: 1, createdBy: 'demo-owner',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [{ id: '806e3063-18e9-4ddb-887a-229198c6dd01', title: 'Saved revenue',
    kind: 'metric', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' }],
};

test('embedded field builder applies typed filters with clear cross-provider scope and recovery', async ({ page }) => {
  test.setTimeout(90_000);
  const writes: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push(`${request.method()} ${path}`);
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] });
    if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [dashboard] });
    if (path === `/api/organizations/northstar/dashboards/${dashboardId}`) return route.fulfill({ json: dashboard });
    return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('.host-frame');
  const panel = frame.locator('.field-filter-builder');
  await panel.locator('summary').press('Enter');
  await expect(panel).toHaveAttribute('open', '');

  const savedMetric = frame.getByRole('article', { name: 'Saved revenue', exact: true }).locator('.metric-number');
  const savedBefore = await savedMetric.textContent();
  const dimension = panel.getByRole('combobox', { name: 'Business dimension' });
  const comparison = panel.getByRole('combobox', { name: 'Filter comparison' });
  await dimension.selectOption('customer_id');
  await comparison.selectOption('Equal');
  await panel.getByRole('textbox', { name: 'Filter value' }).fill('C-101');
  await panel.getByRole('button', { name: 'Apply filter' }).click();

  const sales = panel.locator('.field-filter-outcomes article').filter({ hasText: 'Sales by account' });
  const support = panel.locator('.field-filter-outcomes article').filter({ hasText: 'Support by account' });
  const renewals = panel.locator('.field-filter-outcomes article').filter({ hasText: 'Renewals by account' });
  const inventory = panel.locator('.field-filter-outcomes article').filter({ hasText: 'Inventory by category' });
  await expect(sales).toContainText('1 record');
  await expect(support).toContainText('1 record');
  await expect(renewals).toContainText('incompatible value type');
  await expect(inventory).toContainText('no matching business dimension is configured');
  await expect(panel.getByRole('region', { name: 'Active business filters' })).toContainText('Customer is C-101');

  await panel.getByRole('button', { name: 'Edit', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Filter value' }).fill('C-999');
  await panel.getByRole('button', { name: 'Save filter' }).click();
  await expect(sales).toContainText('0 records');
  await expect(sales).toContainText('No matching records');
  const remove = panel.getByRole('button', { name: 'Remove Customer is C-999', exact: true });
  await remove.focus();
  await remove.press('Enter');
  await expect(dimension).toBeFocused();
  await expect(sales).toContainText('4 records');

  await dimension.selectOption('order_status');
  await comparison.selectOption('Contains');
  await panel.getByRole('textbox', { name: 'Filter value' }).fill('ing');
  await panel.getByRole('button', { name: 'Apply filter' }).click();
  await expect(sales).toContainText('1 record');
  await expect(support).toContainText('1 record');
  await expect(renewals).toContainText('does not support the comparison');

  await page.setViewportSize({ width: 320, height: 900 });
  const size = await panel.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
  const clearAll = panel.getByRole('button', { name: 'Clear all' });
  await clearAll.focus();
  await clearAll.press('Enter');
  await expect(dimension).toBeFocused();
  await expect(sales).toContainText('4 records');
  await expect(support).toContainText('4 records');
  await expect(savedMetric).toHaveText(savedBefore!);
  expect(writes).toEqual([]);

  const reviewPage = await page.context().newPage();
  await reviewPage.setViewportSize({ width: 320, height: 900 });
  await reviewPage.goto(`/#/organization/northstar/dashboard/${dashboardId}`);
  const reviewPanel = reviewPage.locator('.field-filter-builder');
  await reviewPanel.locator('summary').press('Enter');
  await expect(reviewPanel).toHaveAttribute('open', '');
  const accessibility = await new AxeBuilder({ page: reviewPage })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map(item => ({ id: item.id,
    nodes: item.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) }))).toEqual([]);
});
