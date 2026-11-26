import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Dashboard } from '../src/model';

const dashboardId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const dashboard: Dashboard = {
  id: dashboardId, organizationId: 'northstar', name: 'Query preview evaluation',
  description: 'Fictional sample dashboard', revision: 7, createdBy: 'demo-owner',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [{ id: '806e3063-18e9-4ddb-887a-229198c6dd01', title: 'Saved revenue',
    kind: 'metric', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' }],
};

test('EXP-04 combines typed and calendar context in authored query previews without customer access', async ({ page }, info) => {
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
  const savedMetric = frame.getByRole('article', { name: 'Saved revenue', exact: true }).locator('.metric-number');
  const revision = frame.getByText(/Saved revision 7/);
  const savedBefore = await savedMetric.textContent();

  const calendar = frame.locator('.reporting-calendar');
  await calendar.locator('summary').press('Enter');
  const period = calendar.getByRole('combobox', { name: 'Reporting period', exact: true });
  await period.selectOption('custom');
  await calendar.getByLabel('Start date and time', { exact: true }).fill('2026-11-18T00:00');
  await calendar.getByLabel('End date and time (exclusive)').fill('2026-11-21T00:00');
  await calendar.getByRole('button', { name: 'Apply reporting period' }).press('Enter');

  const panel = frame.locator('.field-filter-builder');
  await panel.locator('summary').press('Enter');
  await expect(panel).toHaveAttribute('open', '');
  const dimension = panel.getByRole('combobox', { name: 'Business dimension' });
  await dimension.selectOption('customer_id');
  await panel.getByRole('combobox', { name: 'Filter comparison' }).selectOption('Equal');
  await panel.getByRole('textbox', { name: 'Filter value' }).fill('C-103');
  await panel.getByRole('button', { name: 'Apply filter' }).press('Enter');

  const preview = panel.getByRole('region', { name: 'Authored query preview' });
  const sales = preview.getByRole('article', { name: 'Sales by account query preview' });
  const support = preview.getByRole('article', { name: 'Support by account query preview' });
  const renewals = preview.getByRole('article', { name: 'Renewals by account query preview' });
  const inventory = preview.getByRole('article', { name: 'Inventory by category query preview' });
  await expect(sales).toContainText('Open: 2,400');
  await expect(sales).toContainText('Reporting time 2026-11-18T00:00:00.000Z to 2026-11-21T00:00:00.000Z');
  await expect(support).toContainText('Open: 1');
  await expect(renewals).toContainText('incompatible value type');
  await expect(inventory).toContainText('no approved reporting-time mapping');
  await expect(panel.getByRole('region', { name: 'Active business filters' })).toContainText('Customer is C-103');
  await expect(savedMetric).toHaveText(savedBefore!);
  await expect(revision).toBeVisible();

  const remove = panel.getByRole('button', { name: 'Remove Customer is C-103' });
  await remove.focus();
  await remove.press('Enter');
  await expect(dimension).toBeFocused();
  await expect(sales).toContainText('1 fictional record');
  await expect(sales).toContainText('Open: 2,400');

  await calendar.getByRole('button', { name: 'Clear reporting period' }).press('Enter');
  await expect(period).toBeFocused();
  await expect(sales).toContainText('All time was selected');
  await expect(sales).toContainText('Open: 3,600');
  await expect(inventory).toContainText('Adapters: 3,200');

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await preview.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth,
      document: node.ownerDocument.documentElement.scrollWidth, viewport: node.ownerDocument.defaultView!.innerWidth }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
    await preview.scrollIntoViewIfNeeded();
    const path = info.outputPath(`exp04-query-preview-${width}.png`);
    await page.screenshot({ path, animations: 'disabled' });
    await info.attach(`exp04-query-preview-${width}`, { path, contentType: 'image/png' });
  }
  await page.emulateMedia({ forcedColors: 'active' });
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map(item => item.id)).toEqual([]);
  const forcedColorsPath = info.outputPath('exp04-query-preview-forced-colors.png');
  await page.screenshot({ path: forcedColorsPath, animations: 'disabled' });
  await info.attach('exp04-query-preview-forced-colors', { path: forcedColorsPath, contentType: 'image/png' });
  expect(writes).toEqual([]);
});

test('EXP-05 authors independent temporary query shapes under shared selections', async ({ page }, info) => {
  test.setTimeout(90_000);
  const unexpected: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] });
      if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [dashboard] });
      if (path === `/api/organizations/northstar/dashboards/${dashboardId}`) return route.fulfill({ json: dashboard });
    }
    unexpected.push(`${request.method()} ${path}`);
    return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('.host-frame');
  const savedMetric = frame.getByRole('article', { name: 'Saved revenue', exact: true }).locator('.metric-number');
  const savedBefore = await savedMetric.textContent();
  const revision = frame.getByText(/Saved revision 7/);
  const panel = frame.locator('.field-filter-builder');
  await panel.locator('summary').press('Enter');
  const preview = panel.getByRole('region', { name: 'Authored query preview' });
  const sales = preview.getByRole('article', { name: 'Sales by account query preview' });
  const support = preview.getByRole('article', { name: 'Support by account query preview' });
  const renewals = preview.getByRole('article', { name: 'Renewals by account query preview' });

  const edit = sales.getByRole('button', { name: 'Edit preview', exact: true });
  await edit.focus();
  await edit.press('Enter');
  const close = sales.getByRole('button', { name: 'Close preview editor' });
  await expect(close).toBeFocused();
  await close.press('Tab');
  const group = sales.getByRole('combobox', { name: 'Group by' });
  await expect(group).toBeFocused();
  await group.selectOption('customer_id');
  const aggregate = sales.getByRole('combobox', { name: 'Aggregate' });
  await aggregate.selectOption('count');
  await expect(sales).toContainText('C-101: 1');
  await expect(sales).toContainText('C-104: 1');
  await expect(support).toContainText('Open: 2');

  const calendar = frame.locator('.reporting-calendar');
  await calendar.locator('summary').press('Enter');
  await calendar.getByRole('combobox', { name: 'Reporting period', exact: true }).selectOption('custom');
  await calendar.getByLabel('Start date and time', { exact: true }).fill('2026-11-18T00:00');
  await calendar.getByLabel('End date and time (exclusive)').fill('2026-11-21T00:00');
  await calendar.getByRole('button', { name: 'Apply reporting period' }).press('Enter');
  await panel.getByRole('combobox', { name: 'Business dimension' }).selectOption('customer_id');
  await panel.getByRole('textbox', { name: 'Filter value' }).fill('C-103');
  await panel.getByRole('button', { name: 'Apply filter' }).press('Enter');

  await expect(sales).toContainText('C-103: 1');
  await expect(sales).toContainText('1 fictional record');
  await expect(sales).not.toContainText('C-101: 1');
  await expect(support).toContainText('Open: 1');
  await expect(renewals).toContainText('incompatible value type');
  await aggregate.selectOption('sum');
  await expect(sales).toContainText('C-103: 2,400');

  const reset = sales.getByRole('button', { name: 'Reset preview definition' });
  await reset.focus();
  await reset.press('Enter');
  await expect(reset).toBeFocused();
  await expect(group).toHaveValue('order_status');
  await expect(sales).toContainText('Open: 2,400');
  await expect(sales).toContainText('Reporting time 2026-11-18');
  await expect(panel.getByRole('region', { name: 'Active business filters' })).toContainText('Customer is C-103');
  await group.selectOption('customer_id');
  await aggregate.selectOption('count');
  await panel.getByRole('button', { name: 'Remove Customer is C-103' }).press('Enter');
  await calendar.getByRole('button', { name: 'Clear reporting period' }).press('Enter');
  await expect(group).toHaveValue('customer_id');
  await expect(aggregate).toHaveValue('count');
  await expect(sales).toContainText('C-104: 1');
  await expect(sales).toContainText('All time was selected');

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await sales.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth,
      document: node.ownerDocument.documentElement.scrollWidth, viewport: node.ownerDocument.defaultView!.innerWidth }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);
    await group.scrollIntoViewIfNeeded();
    const path = info.outputPath(`exp05-preview-editor-${width}.png`);
    await page.screenshot({ path, animations: 'disabled' });
    await info.attach(`exp05-preview-editor-${width}`, { path, contentType: 'image/png' });
  }

  await page.emulateMedia({ forcedColors: 'active' });
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map(item => item.id)).toEqual([]);
  const path = info.outputPath('exp05-preview-editor-forced-colors.png');
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach('exp05-preview-editor-forced-colors', { path, contentType: 'image/png' });
  await expect(savedMetric).toHaveText(savedBefore!);
  await expect(revision).toBeVisible();
  await page.reload();
  await panel.locator('summary').press('Enter');
  await expect(sales).toContainText('Open: 3,600');
  await expect(sales.getByRole('button', { name: 'Edit preview' })).toBeVisible();
  await expect(savedMetric).toHaveText(savedBefore!);
  await expect(revision).toBeVisible();
  expect(unexpected).toEqual([]);
});
