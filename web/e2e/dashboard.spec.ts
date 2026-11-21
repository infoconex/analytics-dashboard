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
  await page.getByRole('button', { name: /Area chart/ }).click();
  await page.getByRole('button', { name: 'Add to dashboard' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('Monthly revenue', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Monthly revenue', { exact: true })).toBeVisible();
});

test('keyboard move persists dashboard order and cancel discards later changes', async ({ page }) => {
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  const titles = page.locator('.canvas-item .widget-title');
  const original = await titles.allTextContents();
  expect(original.length).toBeGreaterThan(2);

  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await expect(page.getByText('No changes yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await page.getByRole('button', { name: `Move ${original[0]} later` }).click();
  await expect(page.getByRole('status').filter({ hasText: 'moved to position 2' })).toBeAttached();
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();
  await expect(titles.first()).toHaveText(original[1]!);
  await expect(titles.nth(1)).toHaveText(original[0]!);

  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('button', { name: `Move ${original[1]} later` }).click();
  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
  await expect(titles.first()).toHaveText(original[1]!);
});

test('dragging rearranges a preview and navigation protects unsaved work', async ({ page }) => {
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  const titles = page.locator('.canvas-item .widget-title');
  const original = await titles.allTextContents();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  const handle = page.locator('.canvas-item .drag-handle').first();
  // A real pointer gesture exercises the same path used by touch and mouse.
  await handle.hover();
  await page.mouse.down();
  await page.locator('.canvas-item').nth(2).hover();
  await page.mouse.up();
  await expect(titles.nth(2)).toHaveText(original[0]!);
  await expect(page.getByText('Unsaved changes')).toBeVisible();

  page.once('dialog', dialog => void dialog.dismiss());
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(page.getByText('Composition mode')).toBeVisible();
  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboards', exact: true })).toBeVisible();
});

test('empty dashboard offers chart gallery and responsive keyboard movement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New dashboard' }).click();
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Mobile composition');
  await page.getByRole('button', { name: 'Create dashboard' }).click();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await expect(page.getByText('Your canvas is ready')).toBeVisible();
  await page.getByRole('button', { name: /Add visualization/ }).click();
  await expect(page.getByRole('button', { name: /Data table/ })).toBeVisible();
  await page.getByRole('button', { name: /Bar chart/ }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Mobile orders');
  await page.getByRole('button', { name: 'Add to dashboard' }).click();
  await expect(page.locator('.canvas-item')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Move Mobile orders earlier' })).toBeDisabled();
  await page.getByRole('button', { name: /Add visualization/ }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Mobile revenue');
  await page.getByRole('button', { name: 'Add to dashboard' }).click();
  await page.getByRole('button', { name: 'Move Mobile revenue earlier' }).click();
  await expect(page.locator('.canvas-item .widget-title').first()).toHaveText('Mobile revenue');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();
  await expect(page.locator('.canvas-item .widget-title').first()).toHaveText('Mobile revenue');
});

test('viewer has no dashboard composition controls', async ({ page }) => {
  await page.route('**/api/organizations', route => route.fulfill({ json: [
    { id: 'northstar', name: 'Northstar Commerce', role: 'viewer' },
  ] }));
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Drag to move/ })).toHaveCount(0);
});

test('revision conflict keeps unsaved editor work available', async ({ page }) => {
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Unsaved draft');
  await page.route('**/api/organizations/*/dashboards/*', route => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 409, body: 'Conflict' });
    return route.continue();
  });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Another editor saved a newer dashboard revision.');
  await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toHaveValue('Unsaved draft');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Dashboard conflict recovery' })).toBeVisible();
});

test('tenant-isolated demo dashboard loads six visualizations', async ({ page }) => {
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await expect(page.getByText('Revenue over time', { exact: true })).toBeVisible();
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
  await expect(page.getByText('Insight unavailable.')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('editor registers, renames and removes source metadata without connecting', async ({ page }) => {
  await page.goto('/#/sources');
  await expect(page.getByRole('heading', { name: 'Data sources' })).toBeVisible();
  await expect(page.getByText('Registration only — no live connections')).toBeVisible();

  await page.getByRole('button', { name: 'Register data source' }).click();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Reporting warehouse');
  await page.getByRole('combobox', { name: 'Provider' }).selectOption('postgreSql');
  await page.getByRole('button', { name: 'Register definition' }).click();

  const registration = page.locator('.registered-source').filter({ hasText: 'Reporting warehouse' });
  await expect(registration).toContainText('PostgreSQL');
  await expect(registration).toContainText('Not connected');
  await page.reload();
  await expect(registration).toBeVisible();

  await page.getByRole('button', { name: 'Rename Reporting warehouse' }).click();
  await expect(page.getByRole('combobox', { name: 'Provider' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Display name' }).fill('Reporting warehouse v2');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.locator('.registered-source').filter({ hasText: 'Reporting warehouse v2' })).toContainText('Revision 2');

  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', { name: 'Remove Reporting warehouse v2' }).click();
  await expect(page.getByText('No data sources registered')).toBeVisible();
});

test('viewer receives read-only data-source management controls', async ({ page }) => {
  await page.route('**/api/organizations', route => route.fulfill({ json: [
    { id: 'northstar', name: 'Northstar Commerce', role: 'viewer' },
  ] }));
  await page.goto('/#/sources');
  await expect(page.getByText('Registration only — no live connections')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register data source' })).toHaveCount(0);
  await expect(page.getByText('An organization editor can register a data-source definition.')).toBeVisible();
});
