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
