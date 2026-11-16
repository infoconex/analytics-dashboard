import { expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Dashboard, DashboardDraft } from '../src/model';

// The real React application renders these fixed demonstration API contracts.
// Captures never depend on an external tenant, a secret, or the mutable test database.
const sampleDashboard: Dashboard = {
  id: 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441', organizationId: 'northstar',
  name: 'Business performance', description: 'Revenue, conversion and customer activity in one view.',
  revision: 1, createdBy: 'demo-owner', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [
    ['Total revenue', 'metric', 'commerce', 'revenue', 'month'],
    ['Revenue over time', 'area', 'commerce', 'revenue', 'month'],
    ['Orders by channel', 'bar', 'channels', 'orders', 'channel'],
    ['Traffic sources', 'donut', 'channels', 'sessions', 'channel'],
    ['Monthly orders', 'line', 'commerce', 'orders', 'month'],
    ['Channel details', 'table', 'channels', 'orders', 'channel'],
  ].map(([title, kind, datasetKey, metricKey, dimensionKey], index) => ({
    id: `806e3063-18e9-4ddb-887a-229198c6dd0${index + 1}`, title,
    kind: kind as Dashboard['widgets'][number]['kind'],
    datasetKey: datasetKey as Dashboard['widgets'][number]['datasetKey'], metricKey, dimensionKey,
  })),
};

const denseDashboard: Dashboard = {
  ...sampleDashboard,
  widgets: [...sampleDashboard.widgets, ...sampleDashboard.widgets.map((widget, index) => ({
    ...widget, id: `806e3063-18e9-4ddb-887a-229198c6dd${String(index + 7).padStart(2, '0')}`,
    title: `${widget.title} — regional`,
  }))],
};

async function fixedDemoApi(page: Page, dashboard = sampleDashboard) {
  const dashboards = [dashboard];
  await page.route('**/api/identity', route => route.fulfill({ json: { userId: 'demo-owner', displayName: 'Demo Analyst' } }));
  await page.route('**/api/organizations', route => route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'owner' }] }));
  await page.route('**/api/organizations/northstar/dashboards', async route => {
    if (route.request().method() === 'POST') {
      const draft = route.request().postDataJSON() as DashboardDraft;
      const created = { ...sampleDashboard, id: '33333333-3333-4333-8333-333333333333', name: draft.name,
        description: draft.description, widgets: draft.widgets, revision: 1 };
      dashboards.unshift(created);
      await route.fulfill({ status: 201, json: created });
    } else await route.fulfill({ json: dashboards });
  });
  await page.route('**/api/organizations/northstar/dashboards/*', async route => {
    const id = route.request().url().split('/').pop();
    const found = dashboards.find(item => item.id === id);
    if (!found) return route.fulfill({ status: 404, body: '' });
    if (route.request().method() === 'PUT') {
      const draft = route.request().postDataJSON() as DashboardDraft;
      Object.assign(found, { ...draft, revision: found.revision + 1 });
    }
    return route.fulfill({ json: found });
  });
}

async function capture(page: Page, testInfo: TestInfo, label: string) {
  // Full-page screenshots otherwise paint fixed/sticky controls at the current
  // scroll offset after the preceding interaction instead of their natural top.
  if (!label.includes('dialog') && !label.includes('keyboard-focus')) await page.evaluate(() => window.scrollTo(0, 0));
  const path = testInfo.outputPath(`${label}.png`);
  await page.screenshot({ path, fullPage: !label.includes('dialog') && !label.includes('keyboard-focus'), animations: 'disabled' });
  await testInfo.attach(label, { path, contentType: 'image/png' });
}

async function assertNoDocumentOverflow(page: Page, width: number) {
  const layout = await page.evaluate(() => ({
    pageWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll<HTMLElement>('body *')]
      .filter(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.width && (bounds.right > window.innerWidth + 1 || bounds.left < -1)
          && getComputedStyle(element).position !== 'fixed';
      })
      .slice(0, 12).map(element => ({
        tag: element.tagName.toLowerCase(), className: typeof element.className === 'string' ? element.className : '',
        right: Math.round(element.getBoundingClientRect().right),
        width: Math.round(element.getBoundingClientRect().width),
      })),
  }));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
    message: `Persistent horizontal overflow at ${width}px (initial width ${layout.pageWidth}): ${JSON.stringify(layout.overflowing)}`,
    timeout: 5_000,
  }).toBeLessThanOrEqual(width);
}

test.use({ video: 'on', trace: 'on', reducedMotion: 'reduce' });

test('desktop UX journey captures all primary states using fixed sample data', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await fixedDemoApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await capture(page, testInfo, '01-workspace-desktop');

  await page.goto('/#/dashboards');
  await expect(page.getByRole('heading', { name: 'Dashboards', exact: true })).toBeVisible();
  await capture(page, testInfo, '02-library-desktop');

  await page.goto('/#/explore');
  await expect(page.getByRole('heading', { name: 'Turn data into a story.' })).toBeVisible();
  await capture(page, testInfo, '03-explore-desktop');

  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await capture(page, testInfo, '04-consumption-desktop');
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await capture(page, testInfo, '05-active-filters-desktop');
  await page.getByRole('button', { name: 'Reset filters' }).click();

  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await capture(page, testInfo, '06-composition-desktop');
  await page.getByRole('button', { name: /Add visualization/ }).click();
  await expect(page.getByRole('dialog', { name: 'Configure visualization' })).toBeVisible();
  await capture(page, testInfo, '07-visualization-dialog-desktop');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await page.getByRole('button', { name: 'New dashboard', exact: true }).click();
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('New sample workspace');
  await page.getByRole('button', { name: 'Create dashboard' }).click();
  await expect(page.getByText('No visualizations yet')).toBeVisible();
  await capture(page, testInfo, '08-empty-dashboard-desktop');

  await page.route('**/api/organizations', route => route.fulfill({ status: 503, body: '' }));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Request failed (503)');
  await expect(page.getByRole('heading', { name: 'Workspace unavailable' })).toBeVisible();
  await capture(page, testInfo, '09-error-desktop');
});

test('mobile journey captures responsive navigation, filters and creator modal', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixedDemoApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await capture(page, testInfo, '10-workspace-mobile');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Explore' }).click();
  await capture(page, testInfo, '11-explore-mobile');

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Dashboards' }).click();
  await capture(page, testInfo, '12-library-mobile');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await capture(page, testInfo, '13-consumption-mobile');
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Social');
  await capture(page, testInfo, '14-active-filters-mobile');
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  await capture(page, testInfo, '15-composition-mobile');
  await page.getByRole('button', { name: /Add visualization/ }).click();
  await capture(page, testInfo, '16-visualization-dialog-mobile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('tablet, narrow reflow and forced-colors views preserve readable sample data', async ({ page }, testInfo) => {
  await fixedDemoApi(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await capture(page, testInfo, '17-consumption-tablet');

  await page.setViewportSize({ width: 320, height: 900 });
  await assertNoDocumentOverflow(page, 320);
  await capture(page, testInfo, '18-consumption-reflow-320');

  await page.getByText('View data table').first().click();
  await capture(page, testInfo, '19-chart-data-reflow-320');

  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await capture(page, testInfo, '20-forced-colors-320');
});

test('dense dashboard preserves reading order and supports keyboard jump navigation', async ({ page }, testInfo) => {
  await fixedDemoApi(page, denseDashboard);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();

  const cards = page.locator('.canvas-item');
  await expect(cards).toHaveCount(12);
  await expect(page.getByRole('navigation', { name: 'Jump to visualization' })).toHaveCount(0);
  const index = page.locator('details.dashboard-index');
  await index.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(index).toHaveAttribute('open', '');
  await expect(page.getByRole('navigation', { name: 'Jump to visualization' })).toBeVisible();
  await capture(page, testInfo, '21-dense-dashboard-desktop');

  const jump = page.getByRole('button', { name: /12\. Channel details — regional/ });
  await jump.focus();
  await page.keyboard.press('Enter');
  const lastHeading = cards.last().getByRole('heading', { name: 'Channel details — regional' });
  await expect(lastHeading).toBeFocused();
  await capture(page, testInfo, '22-dense-keyboard-focus');

  const headings = await cards.locator('h2.widget-title').allTextContents();
  expect(headings).toEqual(denseDashboard.widgets.map(widget => widget.title));
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations).toEqual([]);

  await page.setViewportSize({ width: 768, height: 1024 });
  await capture(page, testInfo, '23-dense-dashboard-tablet');
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoDocumentOverflow(page, 390);
  await capture(page, testInfo, '24-dense-dashboard-mobile');
  await page.setViewportSize({ width: 320, height: 900 });
  await assertNoDocumentOverflow(page, 320);
  await capture(page, testInfo, '25-dense-reflow-320');
  await cards.first().getByText('View data table').press('Enter');
  await expect(cards.first().getByRole('table', { name: /Total revenue/ })).toBeVisible();
  await capture(page, testInfo, '26-dense-data-table-320');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await capture(page, testInfo, '27-dense-forced-colors-320');
});

test('compact metrics do not stretch to match chart cards and short dashboards avoid an index', async ({ page }) => {
  await fixedDemoApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  await expect(page.locator('.dashboard-index')).toHaveCount(0);
  const sizes = await page.locator('.canvas-item').evaluateAll(items => items.slice(0, 2).map(item => item.getBoundingClientRect().height));
  expect(sizes[0]).toBeLessThan(sizes[1] - 45);
  const widths = await page.locator('.canvas-item').evaluateAll(items => items.slice(0, 2).map(item => item.getBoundingClientRect().width));
  expect(widths[0]).toBeGreaterThan(widths[1] * 1.8);
});

test('chart data alternative exposes an announced keyboard channel selection', async ({ page }) => {
  await fixedDemoApi(page);
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  const bar = page.getByRole('article', { name: 'Orders by channel' });
  await expect(bar.getByRole('img', { name: /keyboard-accessible channel filters/ })).toBeVisible();
  await bar.getByText('View data table').focus();
  await page.keyboard.press('Enter');
  const category = bar.getByRole('button', { name: 'Show only Direct' });
  await category.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'Dashboard filter changes' })).toContainText('Direct');
  await expect(bar.getByRole('button', { name: 'Show all channels instead of Direct' })).toHaveAttribute('aria-pressed', 'true');
  await expect(bar.getByRole('heading', { name: 'Orders by channel' })).toBeVisible();
});
