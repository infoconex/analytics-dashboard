import { expect, test } from '@playwright/test';

test('dashboard creation dialog contains keyboard focus and returns it to the opener', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'New dashboard' });
  await trigger.focus();
  await trigger.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Create dashboard' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Keyboard review');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Create dashboard' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  page.once('dialog', dialog => dialog.accept());
  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('visualization dialog and source registration share keyboard-safe dialog behavior', async ({ page }) => {
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  const add = page.getByRole('button', { name: /Add visualization/ });
  await add.click();
  const visualization = page.getByRole('dialog', { name: 'Configure visualization' });
  await expect(visualization).toBeVisible();
  await expect(visualization.locator('.gallery-card').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(add).toBeFocused();

  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await page.goto('/#/sources');
  const register = page.getByRole('button', { name: 'Register data source' });
  await register.click();
  const dialog = page.getByRole('dialog', { name: 'Register data source' });
  await expect(dialog.getByRole('textbox', { name: 'Display name' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(register).toBeFocused();
});

test('mobile navigation, forms and active filters remain operable without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Dashboards' }).click();
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await page.getByRole('combobox', { name: /Marketing channel/ }).selectOption('Organic search');
  await expect(page.getByRole('button', { name: 'Remove Organic search filter', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('mobile visualization dialog exposes its primary action by natural scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await page.getByRole('button', { name: /Add visualization/ }).click();
  const action = page.getByRole('dialog', { name: 'Configure visualization' }).getByRole('button', { name: 'Add to dashboard' });
  // UX-25 deliberately uses in-flow actions rather than a sticky footer that obscures fields.
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeInViewport();
  const bounds = await action.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
});

test('an empty dashboard gives an editor a direct visual first step', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New dashboard' }).click();
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('First chart journey');
  await page.getByRole('button', { name: 'Create dashboard' }).click();

  await expect(page.getByText('No visualizations yet')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Dashboard filters' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add first visualization' }).click();
  await expect(page.getByRole('dialog', { name: 'Configure visualization' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to dashboard' }).click();
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
});

test('dashboard creation errors stay visible inside the open dialog', async ({ page }) => {
  await page.route('**/api/organizations/*/dashboards', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 503, body: '' }) : route.continue());
  await page.goto('/');
  await page.getByRole('button', { name: 'New dashboard' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create dashboard' });
  await dialog.getByRole('textbox', { name: 'Dashboard name' }).fill('Retryable dashboard');
  await dialog.getByRole('button', { name: 'Create dashboard' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Request failed (503)');
  await expect(dialog).toBeVisible();
  page.once('dialog', confirmation => confirmation.accept());
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toHaveCount(0);
});

test('workspace loading failure reports the real problem and offers a working retry', async ({ page }) => {
  let unavailable = true;
  await page.route('**/api/organizations', route => unavailable
    ? route.fulfill({ status: 503, body: '' }) : route.continue());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Request failed (503)');
  await expect(page.getByRole('heading', { name: 'Workspace unavailable' })).toBeVisible();

  unavailable = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workspace unavailable' })).toHaveCount(0);
});
