import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Dashboard } from '../src/model';

const date = '2026-11-20T15:00:00Z';
const own: Dashboard[] = Array.from({ length: 27 }, (_, index) => ({
  id: `quarterly-business-${index + 1}`, organizationId: 'northstar',
  name: index === 0 ? 'Western quarterly business' : `Quarterly business ${String(index + 1).padStart(2, '0')}`,
  description: index === 0 ? 'Fictional western quarterly revenue' : 'Fictional quarterly business results',
  widgets: index === 0 ? [{
    id: 'sample-revenue', title: 'Revenue by month', kind: 'area',
    datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month',
  }] : [],
  revision: 1, createdBy: 'fictional-owner', createdAt: date, updatedAt: date,
}));
const isolated: Dashboard = {
  ...own[0]!, id: 'isolated-dashboard', organizationId: 'isolated',
  name: 'Isolated quarterly business', widgets: [],
};

async function fixture(page: Page, role: 'owner' | 'viewer' = 'owner') {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/identity') {
      return route.fulfill({ json: { userId: 'fictional-owner', displayName: 'Fictional Owner' } });
    }
    if (path === '/api/organizations') {
      return route.fulfill({ json: [
        { id: 'northstar', name: 'Northstar Commerce', role },
        { id: 'isolated', name: 'Isolated Organization', role },
      ] });
    }
    if (path === '/api/organizations/northstar/dashboards' && route.request().method() === 'GET') {
      // A deliberately foreign record must never appear in this authorized catalog.
      return route.fulfill({ json: [...own, isolated] });
    }
    if (path === '/api/organizations/isolated/dashboards' && route.request().method() === 'GET') {
      return route.fulfill({ json: [isolated] });
    }
    return route.fulfill({ status: 403, json: { error: 'Fixture operation not available' } });
  });
}

async function capture(page: Page, info: TestInfo, stage: string, width: number) {
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(horizontalOverflow, `${stage} at ${width}px`).toBeLessThanOrEqual(1);
  const path = info.outputPath(`ux30-${stage}-${width}.png`);
  await page.screenshot({ path, animations: 'disabled', fullPage: false });
  await info.attach(`ux30-${stage}-${width}`, { path, contentType: 'image/png' });
}

test('UX-30 keeps catalog context, focus and scroll on explicit return at five widths', async ({ page }, info) => {
  test.setTimeout(240_000);
  await fixture(page);
  const viewports = [
    { width: 320, height: 900 }, { width: 390, height: 844 },
    { width: 720, height: 850 }, { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];
  for (const { width, height } of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto('/#/organization/northstar/dashboards');
    const query = page.getByRole('textbox', { name: 'Search dashboards' });
    await query.fill('quarterly business');
    await page.getByRole('combobox', { name: 'Sort dashboards' }).selectOption('name-desc');
    const item = page.locator('[data-dashboard-id="quarterly-business-23"]');
    const open = item.getByRole('button', { name: 'View dashboard' });
    await open.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => scrollY);
    expect(scrollBefore).toBeGreaterThan(0);
    await open.click();
    await expect(page.locator('.dashboard-heading .eyebrow')).toContainText('VIEWING SAVED');
    await expect(page.getByRole('button', { name: 'Back to dashboards' })).toBeVisible();
    await capture(page, info, 'saved-dashboard', width);
    await page.getByRole('button', { name: 'Edit dashboard' }).click();
    await expect(page.locator('.dashboard-heading .eyebrow')).toContainText('EDITING DRAFT');
    await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toBeFocused();
    await capture(page, info, 'editing-dashboard', width);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeFocused();
    await page.getByRole('button', { name: 'Back to dashboards' }).click();
    await expect(query).toHaveValue('quarterly business');
    await expect(page.getByRole('combobox', { name: 'Sort dashboards' })).toHaveValue('name-desc');
    await expect(open).toBeFocused();
    const scrollAfter = await page.evaluate(() => scrollY);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(120);
    await capture(page, info, 'catalog-return', width);
  }
});

test('UX-30 browser Back and Forward preserve return context and a declined dirty draft', async ({ page }) => {
  await fixture(page);
  await page.goto('/#/organization/northstar/dashboards');
  const query = page.getByRole('textbox', { name: 'Search dashboards' });
  await query.fill('quarterly business 23');
  const open = page.locator('[data-dashboard-id="quarterly-business-23"]').getByRole('button', { name: 'View dashboard' });
  await open.click();
  await expect(page.getByRole('heading', { name: 'Quarterly business 23' })).toBeVisible();

  // Editing without a hash change is still a draft; dismissing native Back
  // must return to this exact history entry without destroying Forward.
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toBeFocused();
  await expect(page.locator('.dashboard-heading .eyebrow')).toContainText('EDITING DRAFT');
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Unsaved quarterly draft');
  page.once('dialog', dialog => void dialog.dismiss());
  await page.evaluate(() => history.back());
  await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toHaveValue('Unsaved quarterly draft');
  await expect(page).toHaveURL(/\/dashboard\/quarterly-business-23$/);

  page.once('dialog', dialog => void dialog.accept());
  await page.evaluate(() => history.back());
  await expect(query).toHaveValue('quarterly business 23');
  await expect(open).toBeFocused();
  await page.evaluate(() => history.forward());
  await expect(page.getByRole('heading', { name: 'Quarterly business 23' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
  await expect(page.getByText('Unsaved quarterly draft')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quarterly business 23' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toBeFocused();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeFocused();
});

test('UX-30 question context survives return; viewer and organization boundaries remain intact', async ({ page }) => {
  await fixture(page, 'viewer');
  await page.goto('/#/organization/northstar/dashboards');
  await expect(page.getByText('Isolated quarterly business')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New dashboard' })).toHaveCount(0);
  await page.getByRole('button', { name: 'How is revenue changing?' }).click();
  const query = page.getByRole('textbox', { name: 'Search dashboards' });
  await query.fill('western');
  await expect(page.locator('.dashboard-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'View dashboard' }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(query).toHaveValue('western');
  await expect(page.getByRole('button', { name: 'How is revenue changing?' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('combobox', { name: 'Switch organization' }).selectOption('isolated');
  await expect(query).toHaveValue('');
  await expect(page.getByRole('button', { name: 'All dashboards' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.dashboard-card')).toHaveCount(1);
  await expect(page.getByText('Western quarterly business')).toHaveCount(0);
  await page.goto('/#/organization/northstar/dashboard/quarterly-business-23');
  await expect(page.getByRole('heading', { name: 'Quarterly business 23' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quarterly business 23' })).toBeVisible();
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(audit.violations.map(item => item.id)).toEqual([]);
});
