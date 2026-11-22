import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function assertNoPageOverflow(page: import('@playwright/test').Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth),
    `Document must reflow within ${width} CSS pixels`).toBeLessThanOrEqual(width);
}

test('WCAG A/AA automated scan finds no detectable violations in primary workflows', async ({ page }) => {
  for (const path of ['/', '/#/explore', '/#/dashboards', '/#/sources']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(scan.violations, `${path}: ${JSON.stringify(scan.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })))}`)
      .toEqual([]);
  }
});

test('chart data table provides a keyboard-operable equivalent of visual values', async ({ page }) => {
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  const revenue = page.getByRole('article').filter({ hasText: 'Revenue over time' });
  const disclosure = revenue.getByText('View data table');
  await disclosure.focus();
  await expect(disclosure).toBeFocused();
  await page.keyboard.press('Enter');
  const table = revenue.getByRole('table', { name: /Revenue over time/ });
  await expect(table).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Month' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'revenue' })).toBeVisible();
  await expect(table.getByRole('rowheader', { name: 'Jan' })).toBeVisible();
  await expect(table.getByRole('row', { name: /Jan.*\$18,400/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(table).toBeHidden();
});

test('essential secondary text uses readable semantic size and contrast surfaces', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  for (const selector of ['.brand-subtitle', '.summary-bottom', '.recent-text small', '.nav-caption']) {
    const size = await page.locator(selector).first().evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    expect(size, selector).toBeGreaterThanOrEqual(12);
  }
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  for (const selector of ['.widget-subtitle', '.consumer-filter-field small', '.chart-data summary']) {
    const size = await page.locator(selector).first().evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    expect(size, selector).toBeGreaterThanOrEqual(12);
  }
});

test('desktop, tablet and narrow equivalent reflow widths retain reachable controls', async ({ page }) => {
  for (const width of [1440, 768, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/dashboards');
    await expect(page.getByRole('heading', { name: 'Dashboards', exact: true })).toBeVisible();
    await assertNoPageOverflow(page, width);
    await page.getByRole('button', { name: /Open Business performance/ }).click();
    await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toBeVisible();
    await assertNoPageOverflow(page, width);
  }
});

test('mobile navigation closes via Escape and returns keyboard focus to its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.click();
  const overview = page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Overview' });
  await expect(overview).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'nexa. ANALYTICS STUDIO home' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Organization' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'nexa. ANALYTICS STUDIO home' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('skip navigation focuses main content without changing hash route', async ({ page }) => {
  await page.goto('/#/explore');
  const shortcut = page.getByRole('button', { name: 'Skip to main content' });
  await shortcut.focus();
  await shortcut.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Turn data into a story.' })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#/explore');
});

test('forced-colors mode retains visible focus and chart data alternatives', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  const disclosure = page.locator('details.chart-data > summary').first();
  await disclosure.focus();
  const outline = await disclosure.evaluate(element => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
  await disclosure.press('Enter');
  await expect(page.locator('details.chart-data').first()).toHaveAttribute('open', '');
  await expect(page.locator('details.chart-data').first().locator('table')).toBeVisible();
});
