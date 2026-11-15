import { expect, test } from '@playwright/test';

test('a tenant editor creates, edits and reloads a saved dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByText('DEMO DATA')).toBeVisible();

  await page.getByRole('button', { name: 'New dashboard' }).click();
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Customer health');
  await page.getByRole('textbox', { name: 'Description' }).fill('Customer engagement signals');
  await page.getByRole('button', { name: 'Create dashboard' }).click();

  await expect(page.getByRole('heading', { name: 'Customer health' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('button', { name: /Add visualization/ }).click();

  await page.getByRole('textbox', { name: 'Title' }).fill('Monthly revenue');
  await page.getByRole('combobox', { name: 'Chart type' }).selectOption('area');
  await page.getByRole('button', { name: 'Add to dashboard' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Monthly revenue')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Monthly revenue')).toBeVisible();
});

test('tenant-isolated demo dashboard loads six visualizations', async ({ page }) => {
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await expect(page.getByText('Revenue over time')).toBeVisible();
  await expect(page.locator('.widget-tile')).toHaveCount(6);
});

test('switching organizations ignores a late response from the previous tenant', async ({ page }) => {
  let releaseNorthstar: () => void = () => {};
  const northstarGate = new Promise<void>(resolve => { releaseNorthstar = resolve; });
  const staleDashboard = {
    id: '36c821c2-2748-4d5f-a916-01b269a60d24', organizationId: 'northstar',
    name: 'Northstar internal', description: '', widgets: [], revision: 1,
    createdBy: 'demo-owner', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const activeDashboard = {
    ...staleDashboard,
    id: '18ff3350-79f4-4bb8-8d73-9b5e6885df89', organizationId: 'isolated',
    name: 'Isolated workspace',
    widgets: [{ id: '86c132b7-7d7a-41e6-9607-5defed2e8e97', title: 'Future connector',
      kind: 'line', datasetKey: 'future_connector', metricKey: 'value', dimensionKey: 'date' }],
  };

  await page.route('**/api/organizations', route => route.fulfill({ json: [
    { id: 'northstar', name: 'Northstar Commerce', role: 'owner' },
    { id: 'isolated', name: 'Isolated Tenant', role: 'owner' },
  ] }));
  await page.route('**/api/organizations/northstar/dashboards', async route => {
    await northstarGate;
    await route.fulfill({ json: [staleDashboard] });
  });
  await page.route('**/api/organizations/isolated/dashboards', route =>
    route.fulfill({ json: [activeDashboard] }));

  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/#/dashboards');
  await page.getByRole('combobox', { name: 'Switch organization' }).selectOption('isolated');
  await expect(page.getByText('Isolated workspace')).toBeVisible();

  releaseNorthstar();
  await expect(page.getByText('Northstar internal')).toHaveCount(0);
  await page.goto(`/#/organization/isolated/dashboard/${activeDashboard.id}`);
  await expect(page.getByText('No sample data is available for dataset')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
