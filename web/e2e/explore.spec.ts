import { expect, test } from '@playwright/test';

test('editor explores sample data and saves a dashboard', async ({ page }) => {
  await page.goto('/#/explore');
  await expect(page.getByRole('heading', { name: 'Turn data into a story.' })).toBeVisible();
  await expect(page.getByText('These built-in datasets are not connected to customer databases.')).toBeVisible();
  await page.getByRole('button', { name: /Marketing channels/ }).click();
  await expect(page.getByRole('button', { name: /Marketing channels/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: 'Measure' }).selectOption('sessions');
  await expect(page.getByRole('textbox', { name: 'Visualization title' })).toHaveValue('Sessions by channel');
  await page.getByRole('combobox', { name: 'Chart type' }).selectOption('bar');
  await page.getByRole('textbox', { name: 'Visualization title' }).fill('Traffic sources');
  await expect(page.getByRole('img', { name: /Traffic sources bar chart/ })).toBeVisible();
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Acquisition overview');
  await page.getByRole('button', { name: 'Create dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Acquisition overview' })).toBeVisible();
  await expect(page.getByText('Traffic sources')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Traffic sources')).toBeVisible();
});

test('viewer can explore but cannot create a dashboard', async ({ page }) => {
  await page.route('**/api/organizations', route => route.fulfill({ json: [
    { id: 'northstar', name: 'Northstar Commerce', role: 'viewer' },
  ] }));
  await page.goto('/#/explore');
  await expect(page.getByRole('button', { name: /Commerce performance/ })).toBeVisible();
  await expect(page.getByText('Ask an editor to create dashboards.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create dashboard' })).toHaveCount(0);
});

test('exploration is keyboard-operable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/explore');
  await expect(page.getByRole('heading', { name: 'Turn data into a story.' })).toBeVisible();
  await page.getByRole('button', { name: /Marketing channels/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Marketing channels/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: 'Chart type' }).focus();
  await expect(page.getByRole('combobox', { name: 'Chart type' })).toBeFocused();
  await expect(page.getByRole('img', { name: /Orders by channel area chart/ })).toBeVisible();
});

test('preview date range is visibly temporary and updates the underlying sample rows', async ({ page }) => {
  await page.goto('/#/explore');
  await page.getByRole('combobox', { name: 'Preview date range' }).selectOption('3m');
  await expect(page.getByText('This changes the preview only.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Underlying sample records (3)' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Oct' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Jan' })).toHaveCount(0);
});
