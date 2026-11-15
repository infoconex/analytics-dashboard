import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
});

test('dashboard consumers coordinate date and channel filters and reset independently', async ({ page }) => {
  const revenue = page.locator('.widget-tile').filter({ hasText: 'Total revenue' });
  const channels = page.locator('.widget-tile').filter({ hasText: 'Traffic sources' });
  const channelTable = page.locator('.widget-tile').filter({ hasText: 'Channel details' });
  const revenueTotal = await revenue.locator('.metric-number').allTextContents();
  const initialChannelRows = await channels.locator('.donut-legend').textContent();
  await expect(channelTable.locator('tbody tr')).toHaveCount(5);

  await page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
  await expect(page.getByRole('button', { name: 'Remove Last 3 months filter' })).toBeVisible();
  await expect(channels.locator('.donut-legend')).toHaveText(initialChannelRows?.trim() ?? '');
  await expect(revenue).toBeVisible();
  expect(await revenue.locator('.metric-number').allTextContents()).not.toEqual(revenueTotal);

  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await expect(page.getByRole('button', { name: 'Remove Direct filter' })).toBeVisible();
  await expect(channels.locator('.donut-legend')).toContainText('Direct');
  await expect(channels.locator('.donut-legend')).not.toContainText('Organic search');
  await expect(channelTable.locator('tbody tr')).toHaveCount(1);

  await page.getByRole('button', { name: 'Remove Last 3 months filter' }).click();
  await expect(page.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('12m');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('');
  await expect(channelTable.locator('tbody tr')).toHaveCount(5);
  await expect(page.getByText('All sample records')).toBeVisible();
});

test('keyboard-operable category controls filter and toggle without edit access', async ({ page }) => {
  await page.locator('.widget-tile').filter({ hasText: 'Traffic sources' }).getByRole('button', { name: 'Show only Organic search' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Organic search');
  await expect(page.getByRole('status', { name: 'Dashboard filter changes' })).toContainText('Organic search');
  await page.locator('.widget-tile').filter({ hasText: 'Traffic sources' }).getByRole('button', { name: 'Show all channels' }).press('Space');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('');
});

test('clicking a channel bar selects the category, and clicking it again restores the dashboard', async ({ page }) => {
  const chart = page.locator('.widget-tile').filter({ hasText: 'Orders by channel' });
  const firstBar = chart.locator('.recharts-bar-rectangle').first();
  await firstBar.click();
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Organic search');
  await expect(chart.locator('.recharts-bar-rectangle')).toHaveCount(1);
  await chart.locator('.recharts-bar-rectangle').first().click();
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('');
});

test('mobile filter controls do not overflow and remain operable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Social');
  await expect(page.getByRole('button', { name: 'Remove Social filter' })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
});

test('read-only organization members can use consumer filters', async ({ page }) => {
  await page.route('**/api/organizations', route => route.fulfill({ json: [
    { id: 'northstar', name: 'Northstar Commerce', role: 'viewer' },
  ] }));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Referral');
  await expect(page.locator('.widget-tile').filter({ hasText: 'Channel details' }).locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Remove Referral filter' })).toBeVisible();
});

test('consumer filters reset on dashboard navigation and never mutate saved dashboard', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Referral');
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('');
  await expect(page.getByText('All sample records')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('');
});
