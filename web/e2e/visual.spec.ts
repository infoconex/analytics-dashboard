Warning: truncated output (original token count: 15865)
Total output lines: 1027

import { chromium, expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dashboard, DashboardDraft } from '../src/model';
import { auditControls, focusedControl } from './controlAudit';

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

const evidencePhases: Array<{ phase: string; label: string; elapsedMs: number }> = [];

async function measureEvidencePhase<T>(phase: string, label: string, action: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await action();
  } finally {
    evidencePhases.push({ phase, label, elapsedMs: Math.round(performance.now() - start) });
  }
}

test.afterEach(async ({}, testInfo) => {
  if (evidencePhases.length === 0) return;
  const path = testInfo.outputPath('browser-evidence-phases.json');
  const entries = evidencePhases.splice(0);
  await writeFile(path, JSON.stringify({ schemaVersion: 1, test: testInfo.title, phases: entries }, null, 2));
  await testInfo.attach('browser-evidence-phases.json', { path, contentType: 'application/json' });
});

async function fixedDemoApi(page: Page, dashboard = sampleDashboard) {
  const dashboards = [structuredClone(dashboard)];
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
  if (!label.includes('dialog') && !label.includes('keyboard-focus') && !label.includes('tooltip')) await page.evaluate(() => window.scrollTo(0, 0));
  const path = testInfo.outputPath(`${label}.png`);
  await measureEvidencePhase('screenshot-capture', label, () => page.screenshot({ path, fullPage: !label.includes('dialog') && !label.includes('keyboard-focus') && !label.includes('tooltip'), animations: 'disabled' }));
  await measureEvidencePhase('attachment-copy', label, () => testInfo.attach(label, { path, contentType: 'image/png' }));
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

test.use({ video: process.env.CI ? 'retain-on-failure' : 'on', trace: process.env.CI ? 'retain-on-failure' : 'on', reducedMotion: 'reduce' });

test('UX-20 chart has one sequential Tab stop and Space applies selected category', async ({ page }, info) => {
  await fixedDemoApi(page);
  await page.goto(`/#/organization/northstar/dashboard/${sampleDashboard.id}`);
  const channel = page.getByRole('combobox', { name: 'Marketing channel' });
  for (const [title, type] of [['Traffic sources', 'donut'], ['Orders by channel', 'bar']] as const) {
    const card = page.getByRole('article', { name: title, exact: true });
    const chart = card.getByRole('group', { name: new RegExp(`${title} ${type} chart`) });
    await chart.focus();
    await expect(chart).toBeFocused();
    await expect(card.getByText('Keyboard chart selection:')).toContainText('Organic search');
    // Real browser Tab must leave the chart; there must not be a second SVG focus target.
    await page.keyboard.press('Tab');
    await expect(chart).not.toBeFocused();
    await expect(card.getByText('Keyboard chart selection:')).toHaveCount(0);
    const innerTabStops = await chart.locator('[tabindex="0"]').count();
    expect(innerTabStops, `${type} should have no second tabbable SVG or path`).toBe(0);
    await page.keyboard.press('Shift+Tab');
    await expect(chart).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(card.getByText('Keyboard chart selection:')).toContainText('Direct');
    await page.keyboard.press('Space');
    await expect(channel).toHaveValue('Direct');
    await expect(card.getByText('Keyboard chart selection:')).toContainText('Direct');
    await page.keyboard.press('Enter');
    await expect(channel).toHaveValue('');
    await capture(page, info, `ux20-${type}-space-tab-regression`);
  }
});

test('UX-20 twelve-category pie validates bounded 5, 8 and 12 labels', async ({ page }, info) => {
  const dashboard: Dashboard = { ...sampleDashboard, widgets: [...sampleDashboard.widgets, {
    id: '806e3063-18e9-4ddb-887a-229198c6dd09', title: 'Monthly revenue pie',
    kind: 'pie', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month',
    columns: 12, height: 520,
  }] };
  await fixedDemoApi(page, dashboard);
  await page.goto(`/#/organization/northstar/dashboard/${dashboard.id}`);
  const pie = page.getByRole('article', { name: 'Monthly revenue pie', exact: true });
  await expect(pie.locator('.recharts-pie-sector')).toHaveCount(12);
  await pie.getByRole('button', { name: 'Show slice labels' }).click();
  const counts: number[] = [];
  for (const limit of ['5', '8', '12']) {
    await pie.getByLabel('Maximum labels').selectOption(limit);
    const labels = pie.locator('.chart-outside-label text');
    const count = await labels.count();
    expect(count).toBeLessThanOrEqual(Number(limit));
    expect(count).toBeGreaterThan(0);
    counts.push(count);
  }
  expect(counts[1]).toBeGreaterThanOrEqual(counts[0]);
  expect(counts[2]).toBeGreaterThanOrEqual(counts[1]);
  expect(counts[2]).toBeGreaterThan(counts[0]);
  await capture(page, info, 'ux20-12-category-pie-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoDocumentOverflow(page, 390);
  await capture(page, info, 'ux20-12-category-pie-mobile');
});

test('UX-18 chart regions filter with arrow keys and Enter, retaining focus and data isolation', async ({ page }, info) => {
  await fixedDemoApi(page);
  await page.goto(`/#/organization/northstar/dashboard/${sampleDashboard.id}`);
  const donut = page.getByRole('article', { name: 'Traffic sources', exact: true });
  const donutPlot = donut.getByRole('group', { name: /Traffic sources donut chart/ });
  await donutPlot.focus();
  await expect(donutPlot).toBeFocused();
  for (let index = 0; index < 4; index++) await page.keyboard.press('ArrowRight');
  await expect(donut.getByText('Keyboard chart selection:')).toContainText('Referral');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Referral');
  await expect(donutPlot).toBeFocused();
  await expect(donut.locator('.recharts-pie-sector')).toHaveCount(1);
  await expect(page.getByRole('article', { name: 'Revenue over time' }).locator('.recharts-area')).toBeVisible();
  await capture(page, info, 'ux18-keyboard-donut-filter');

  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('');
  const bar = page.getByRole('article', { name: 'Orders by channel', exact: true });
  const barPlot = bar.getByRole('group', { name: /Orders by channel bar chart/ });
  await barPlot.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press(' ');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');
});

test('UX-19 keyboard category is visible only during focus, highlights and stops at boundaries', async ({ page }, info) => {
  await fixedDemoApi(page);
  await page.goto(`/#/organization/northstar/dashboard/${sampleDashboard.id}`);
  const donut = page.getByRole('article', { name: 'Traffic sources', exact: true });
  const plot = donut.getByRole('group', { name: /Traffic sources donut chart/ });
  await expect(donut.getByText('Keyboard chart selection:')).toHaveCount(0);
  await plot.focus();
  await expect(donut.getByText('Keyboard chart selection:')).toContainText('Organic search');
  await expect(donut.getByRole('button', { name: 'Show only Organic search' })).toHaveClass(/keyboard-current/);
  for (let index = 0; index < 8; index++) await page.keyboard.press('ArrowRight');
  await expect(donut.getByText('Keyboard chart selection:')).toContainText('Referral');
  await expect(donut.getByRole('button', { name: 'Show only Referral' })).toHaveClass(/keyboard-current/);
  await expect(donut.locator('.recharts-pie-sector').nth(4).locator('path')).toHaveAttribute('stroke', '#172c55');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Referral');
  await donut.getByRole('button', { name: 'Remove Referral filter from Traffic sources' }).click();
  await expect(donut.getByText('Keyboard chart selection:')).toHaveCount(0);
  await plot.focus();
  await expect(donut.getByText('Keyboard chart selection:')).toContainText('Organic search');
  const bar = page.getByRole('article', { name: 'Orders by channel', exact: true });
  const barPlot = bar.getByRole('group', { name: /Orders by channel bar chart/ });
  await barPlot.focus();
  await expect(barPlot).toHaveClass(/keyboard-bar-0/);
  await page.keyboard.press('ArrowRight');
  await expect(barPlot).toHaveClass(/keyboard-bar-1/);
  await expect(bar.locator('.recharts-bar-rectangle').nth(1).locator('path')).toHaveCSS('stroke-width', '4px');
  await plot.focus();
  await capture(page, info, 'ux19-keyboard-focus-synchronized');
});

test('UX-19 labeled donut keeps a usable ring and permits bounded label counts', async ({ page }, info) => {
  // Give this explicit leader-label test a sufficiently wide widget. Narrow
  // widgets deliberately omit labels and preserve their exact data tables.
  const wide = { ...sampleDashboard, widgets: sampleDashboard.widgets.map(widget =>
    widget.kind === 'donut' ? { ...widget, columns: 12, height: 520 } : widget) };
  await fixedDemoApi(page, wide);
  await page.goto(`/#/organization/northstar/dashboard/${sampleDashboard.id}`);
  const donut = page.getByRole('article', { name: 'Traffic sources', exact: true });
  await donut.getByRole('button', { name: 'Show slice labels' }).click();
  await donut.getByLabel('Maximum labels').selectOption('8');
  const count = await donut.locator('.chart-outside-label').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(5);
  await expect(donut.locator('.chart-data summary')).toContainText('(5 records)');
  const pie = donut.locator('.recharts-pie-sector').first().locator('path');
  await expect(pie).toBeVisible();
  await capture(page, info, 'ux19-labeled-donut');
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoDocumentOverflow(page, 390);
  await capture(page, info, 'ux19-labeled-donut-mobile');
});

test('UX-18 optional leader-line labels are capped and scatter axes have explicit titles', async ({ page }, info) => {
  const dashboard: Dashboard = { ...sampleDashboard, widgets: [...sampleDashboard.widgets, {
    id: '806e3063-18e9-4ddb-887a-229198c6dd07', title: 'Monthly revenue pie',
    kind: 'pie', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month',
    columns: 12, height: 520,
  }, {
    id: '806e3063-18e9-4ddb-887a-229198c6dd08', title: 'Revenue and orders',
    kind: 'scatter', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'orders',
  }] };
  await fixedDemoApi(page, dashboard);
  await page.goto(`/#/organization/northstar/dashboard/${dashboard.id}`);
  const pie = page.getByRole('article', { name: 'Monthly revenue pie', exact: true });
  await expect(pie.locator('.recharts-pie-sector')).toHaveCount(12);
  await expect(pie.locator('.chart-outside-label')).toHaveCount(0);
  await pie.getByRole('button', { name: 'Show slice labels' }).click();
  await expect(pie.getByRole('button', { name: 'Hide slice labels' })).toHaveAttribute('aria-pressed', 'true');
  const count = await pie.locator('.chart-outside-label').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(5);
  await expect(pie.getByText(/leader-line labels/)).toBeVisible();
  const scatter = page.getByRole('article', { name: 'Revenue and orders', exact: true });
  await expect(scatter.locator('.scatter-axis-titles')).toContainText('X-axis: Orders');
  await expect(scatter.locator('.scatter-axis-titles')).toContainText('Y-axis: Revenue (USD)');
  await capture(page, info, 'ux18-slice-labels-scatter-axes');
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoDocumentOverflow(page, 390);
  await capture(page, info, 'ux18-slice-labels-mobile');
});

test('UX-17 names hovered donut categories and clears selected channels from interpretation', async ({ page }, testInfo) => {
  await fixedDemoApi(page);
  await page.goto(`/#/organization/northstar/dashboard/${sampleDashboard.id}`);
  const donut = page.getByRole('article', { name: 'Traffic sources', exact: true });
  await donut.locator('.recharts-pie-sector').nth(4).locator('path').hover({ force: true });
  await expect(donut.locator('.recharts-tooltip-wrapper')).toContainText('Referral');
  await expect(donut.locator('.recharts-tooltip-wrapper')).toContainText('Sessions');
  await expect(donut.locator('.recharts-tooltip-wrapper')).toContainText('2,820');
  await capture(page, testInfo, 'ux17-referral-tooltip');
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Referral');
  await donut.getByText('What this means').click();
  const clear = donut.getByRole('button', { name: 'Remove Referral from What this means in Traffic sources' });
  await clear.focus();
  await page.keyboard.press('Enter');
  await expect(donut.getByRole('heading', { name: 'Traffic sources' })).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('');
  await expect(donut.locator('.recharts-pie-sector')).toHaveCount(5);
  await capture(page, testInfo, 'ux17-channel-filter-cleared');
});

test('UX-16 filter cards disclose scope and permit in-place keyboard clearing', async ({ page }, testInfo) => {
  await fixedDemoApi(page);
  await page.goto(`/#/organization/northstar/dashboard/${sampleDashboard.id}`);
  const revenue = page.getByRole('article', { name: 'Revenue over time', exact: true });
  const traffic = page.getByRole('article', { name: 'Traffic sources', exact: true });
  await expect(revenue.getByLabel('Filter scope for Revenue over time')).toHaveCount(0);
  await page.getByRole('c…6865 tokens truncated…EditWithoutChanges: true },
    responsiveViewportWidths: [1440, 390, 320],
  };
  // Write the evidence into the test output directory. Body-only attachments
  // do not appear in the workflow's published **/*.json artifact glob.
  const evidencePath = testInfo.outputPath('ux5-scripted-task-evidence.json');
  await writeFile(evidencePath, JSON.stringify(metrics, null, 2));
  await testInfo.attach('ux5-scripted-task-evidence.json', { path: evidencePath, contentType: 'application/json' });
});

test('UX-4g inventories rendered controls, their targets, contrast, focus and modal states', async ({ page }, testInfo) => {
  await fixedDemoApi(page, denseDashboard);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/dashboards');
  await page.getByRole('button', { name: /Open Business performance/ }).click();
  const readings: Array<Record<string, unknown>> = [];
  const inspect = async (state: string) => {
    const width = await page.evaluate(() => innerWidth);
    await assertNoDocumentOverflow(page, width);
    const inventory = await auditControls(page);
    readings.push({ state, inventory });
    expect(inventory.horizontalDocumentOverflow, `${state}: document width ${inventory.documentWidth} vs viewport ${width}`).toBe(false);
    for (const small of inventory.smallTargets.filter(target => !target.spacingExceptionCandidate)) {
      expect.soft(small.overlapping, `${state}: overlapping undersized ${small.role} ${small.name}`).toEqual([]);
    }
    return inventory;
  };
  const desktop = await inspect('desktop-1440');
  expect(desktop.textCount, 'Audit actual rendered text nodes beyond design tokens').toBeGreaterThan(20);
  const marketing = desktop.controls.find(item => item.name === 'Marketing channel');
  expect(marketing?.borderContrast, 'Marketing selector edge against its rendered surface').toBeGreaterThanOrEqual(3);
  expect(marketing?.height).toBeGreaterThanOrEqual(24);

  const sidebar = page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Dashboards' });
  await page.keyboard.press('Tab');
  await sidebar.focus();
  const darkFocus = await focusedControl(page);
  readings.push({ state: 'dark-sidebar-keyboard-focus', focus: darkFocus });
  expect(darkFocus.visibleFocus).toBe(true);
  expect(darkFocus.fullyUnobscured).toBe(true);
  await capture(page, testInfo, '40-ux4g-dark-sidebar-focus-before-dialog');

  const index = page.locator('details.dashboard-index');
  await index.locator('summary').focus();
  await page.keyboard.press('Enter');
  const lastEntry = index.getByRole('button', { name: '12. Channel details — regional' });
  await lastEntry.focus();
  await page.keyboard.press('Enter');
  const lastCard = page.getByRole('article', { name: 'Channel details — regional' });
  await expect(lastCard.getByRole('heading', { name: 'Channel details — regional' })).toBeFocused();
  expect((await focusedControl(page)).fullyUnobscured).toBe(true);
  await lastCard.getByRole('button', { name: /Back to visualization list/ }).click();
  await expect(lastEntry).toBeFocused();
  expect((await focusedControl(page)).fullyUnobscured).toBe(true);

  const highest = page.getByRole('article', { name: 'Orders by channel', exact: true });
  await expect(highest.locator('.chart-insight')).toContainText('Highest: Organic search, 1,820 orders');
  await highest.getByText('View data table').click();
  await expect(highest.getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
  await page.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
  await expect(page.getByRole('article', { name: 'Traffic sources', exact: true })
    .getByRole('button', { name: 'Show all channels instead of Direct' })).toHaveAttribute('aria-pressed', 'true');
  const selected = await inspect('desktop-selected-Direct');
  expect(selected.controls.find(item => item.name === 'Show all channels instead of Direct' && item.className.includes('donut-legend'))?.borderContrast)
    .toBeGreaterThanOrEqual(3);
  await capture(page, testInfo, '41-ux4g-selected-Direct-desktop');
  await page.getByRole('button', { name: 'Remove Direct filter', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Marketing channel' })).toBeFocused();
  expect((await focusedControl(page)).fullyUnobscured).toBe(true);

  for (const [width, height, state] of [[768, 1024, 'tablet-768'], [390, 844, 'mobile-390'], [320, 900, 'reflow-320']] as const) {
    await page.setViewportSize({ width, height });
    await inspect(state);
    await capture(page, testInfo, `42-ux4g-${state}`);
  }
  await page.getByRole('button', { name: 'Open navigation' }).focus();
  await page.keyboard.press('Enter');
  const mobileNav = page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('button', { name: 'Dashboards' });
  await mobileNav.focus();
  const mobileFocus = await focusedControl(page);
  readings.push({ state: 'mobile-navigation-focus', focus: mobileFocus });
  expect(mobileFocus.visibleFocus && mobileFocus.fullyUnobscured, JSON.stringify(mobileFocus)).toBe(true);
  await capture(page, testInfo, '43-ux4g-mobile-navigation-focus');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toBeHidden();

  await page.getByRole('button', { name: 'Edit dashboard' }).click();
  expect(await page.getByRole('button', { name: 'Save changes' }).isDisabled()).toBe(true);
  await page.getByRole('button', { name: /Add visualization/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Configure visualization' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  const modalFocus = await focusedControl(page);
  readings.push({ state: 'modal-keyboard-focus', focus: modalFocus });
  expect(modalFocus.visibleFocus && modalFocus.fullyUnobscured).toBe(true);
  await inspect('mobile-edit-dialog-320');
  await capture(page, testInfo, '44-ux4g-dialog-320');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await inspect('forced-colors-modal-320');
  await capture(page, testInfo, '45-ux4g-forced-colors-dialog-320');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  const path = testInfo.outputPath('ux4g-rendered-control-inventory.json');
  await writeFile(path, JSON.stringify({ note: 'Automated Chromium computed geometry/color inspection; no manual user or screen-reader speech results.', readings }, null, 2));
  await testInfo.attach('ux4g-rendered-control-inventory', { path, contentType: 'application/json' });
});

// Uses Chromium's own chrome.tabs.setZoom/getZoom API, not a simulated narrow
// viewport, device metrics override, CSS zoom, or CDP page scale. The bundled
// Playwright Chromium loads a local, inert Manifest V3 extension only for this
// test. This is browser-native zoom automation, NOT hands-on user testing.
interface ChromeZoomTabs {
  query(details: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
  setZoom(id: number, factor: number): Promise<void>;
  getZoom(id: number): Promise<number>;
  getZoomSettings(id: number): Promise<{ mode?: string; scope?: string }>;
}

async function readBrowserZoom(worker: import('@playwright/test').Worker, target: number | null) {
  return worker.evaluate(async ({ factor, origin }) => {
    const tabs = (globalThis as unknown as { chrome: { tabs: ChromeZoomTabs } }).chrome.tabs;
    const tab = (await tabs.query({})).find(candidate => candidate.url?.startsWith(origin));
    if (tab?.id === undefined) throw new Error('The sample dashboard browser tab is not available to the zoom driver.');
    if (factor !== null) await tabs.setZoom(tab.id, factor);
    return { factor: await tabs.getZoom(tab.id), settings: await tabs.getZoomSettings(tab.id) };
  }, { factor: target, origin: 'http://127.0.0.1:5173/' });
}

async function zoomPageMetrics(page: Page) {
  return page.evaluate(() => {
    const focused = document.activeElement as HTMLElement | null;
    const rect = focused?.getBoundingClientRect();
    const stickyHeaderBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
    return {
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      horizontalDocumentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      focus: {
        tag: focused?.tagName.toLowerCase() ?? null,
        name: focused?.getAttribute('aria-label') ?? focused?.textContent?.trim().slice(0, 110) ?? null,
        top: rect?.top ?? null,
        bottom: rect?.bottom ?? null,
        stickyHeaderBottom,
        visibleWithinViewport: Boolean(rect && rect.width > 0 && rect.height > 0
          && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth),
        unobscuredBelowStickyHeader: Boolean(rect && rect.width > 0 && rect.height > 0
          && rect.top >= stickyHeaderBottom + 2 && rect.bottom <= window.innerHeight - 2
          && rect.left >= 0 && rect.right <= window.innerWidth),
      },
    };
  });
}

// Chromium's Playwright screenshot clip can be displaced when an extension
// changes the browser's real tab zoom. Retain a separate raw view capture from
// Chrome itself so the actual painted viewport can be inspected independently.
async function captureChromeZoomView(page: Page, testInfo: TestInfo, label: string) {
  const client = await page.context().newCDPSession(page);
  try {
    const { data } = await client.send('Page.captureScreenshot', {
      format: 'png', fromSurface: false, captureBeyondViewport: false,
    });
    const path = testInfo.outputPath(`${label}-chrome-view.png`);
    await writeFile(path, Buffer.from(data, 'base64'));
    await testInfo.attach(`${label}-chrome-view`, { path, contentType: 'image/png' });
  } finally {
    await client.detach();
  }
}

test('browser-native zoom at 200% and 400% preserves the 12-widget keyboard and filter journey', async ({}, testInfo) => {
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, viewport: null,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1280,900'],
  });
  const observations: Array<Record<string, unknown>> = [];
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await fixedDemoApi(page, denseDashboard);
    await page.goto('http://127.0.0.1:5173/#/dashboards');
    await page.getByRole('button', { name: /Open Business performance/ }).click();
    await expect(page.locator('.canvas-item')).toHaveCount(12);

    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const baselineBrowserZoom = await readBrowserZoom(worker, null);
    const baseline = await zoomPageMetrics(page);
    expect(baselineBrowserZoom.factor).toBeCloseTo(1, 1);
    observations.push({ target: 100, browserZoom: baselineBrowserZoom, metrics: baseline });
    const baselineScreenshot = testInfo.outputPath('37-native-zoom-baseline-100.png');
    await page.screenshot({ path: baselineScreenshot, animations: 'disabled', scale: 'device' });
    await testInfo.attach('37-native-zoom-baseline-100', { path: baselineScreenshot, contentType: 'image/png' });

    for (const target of [2, 4]) {
      const browserZoom = await readBrowserZoom(worker, target);
      await expect.poll(async () => (await zoomPageMetrics(page)).innerWidth).toBeLessThanOrEqual(baseline.innerWidth / target + 2);
      const metrics = await zoomPageMetrics(page);
      const genuineZoom = Math.abs(browserZoom.factor - target) < 0.02
        && Math.abs(metrics.devicePixelRatio / baseline.devicePixelRatio - target) < 0.1
        && metrics.innerWidth <= baseline.innerWidth / target + 2
        && browserZoom.settings.mode === 'automatic';
      observations.push({ target: target * 100, genuineZoom, browserZoom, metrics,
        environment: { os: process.platform, chromium: context.browser()?.version(), runner: 'CI Chromium, headless with browser tab extension API' } });
      expect(genuineZoom, 'Only confirmed browser-native tab zoom plus viewport and DPR changes count').toBe(true);
      await assertNoDocumentOverflow(page, metrics.innerWidth);
      const zoomInventory = await auditControls(page);
      expect(zoomInventory.horizontalDocumentOverflow).toBe(false);
      observations.push({ target: target * 100, controlInventory: {
        count: zoomInventory.count, smallTargets: zoomInventory.smallTargets,
        channelSelector: zoomInventory.controls.find(item => item.name === 'Marketing channel'),
      } });

      const finder = page.getByRole('combobox', { name: 'Find a visualization' });
      await expect(finder).toBeVisible();
      // Capture the real browser-painted finder, not merely the page header
      // above a finder that is present in the DOM but below the fold.
      await finder.scrollIntoViewIfNeeded();
      await expect(finder).toBeInViewport();
      await captureChromeZoomView(page, testInfo, `49-ux5-native-zoom-${target * 100}-finder`);
      await finder.selectOption(denseDashboard.widgets[11]!.id);
      await page.getByRole('button', { name: 'Go to visualization' }).click();
      const lastCard = page.getByRole('article', { name: 'Channel details — regional' });
      await expect(lastCard.getByRole('heading', { name: 'Channel details — regional' })).toBeFocused();
      const directHeading = await zoomPageMetrics(page);
      expect(directHeading.focus.unobscuredBelowStickyHeader, 'UX-5 direct navigation focus must be unobscured at native zoom').toBe(true);
      observations.push({ target: target * 100, ux5DirectHeading: directHeading });

      const index = page.locator('details.dashboard-index');
      await expect(lastCard.getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
      await page.keyboard.press('Tab');
      await expect(lastCard.getByRole('button', { name: 'Jump to visualization index from Channel details — regional' })).toBeFocused();
      for (let step = 0; step < 7; step++) await page.keyboard.press('Tab');
      await expect(lastCard.locator('.insight-context > summary')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(lastCard.getByRole('button', { name: 'Back to visualization list from Channel details — regional' })).toBeFocused();
      await page.keyboard.press('Enter');
      const entry = index.getByRole('button', { name: '12. Channel details — regional' });
      await expect(index).toHaveAttribute('open', '');
      await expect(entry).toBeFocused();
      const indexFocus = await zoomPageMetrics(page);
      expect(indexFocus.focus.unobscuredBelowStickyHeader, 'Exact index entry focus is visibly unobscured').toBe(true);
      observations.push({ target: target * 100, indexFocus });
      const indexScreenshot = testInfo.outputPath(`38-native-zoom-${target * 100}-index-focus.png`);
      await page.screenshot({ path: indexScreenshot, animations: 'disabled', scale: 'device' });
      await testInfo.attach(`38-native-zoom-${target * 100}-index-focus`, { path: indexScreenshot, contentType: 'image/png' });
      await captureChromeZoomView(page, testInfo, `38-native-zoom-${target * 100}-index-focus`);

      const bar = page.getByRole('article', { name: 'Orders by channel', exact: true });
      if (!(await bar.getByRole('table').isVisible())) {
        await bar.getByText('View data table').focus();
        await page.keyboard.press('Enter');
      }
      await expect(bar.getByRole('row', { name: /Organic search.*1,820/ })).toBeVisible();
      const channel = page.getByRole('combobox', { name: 'Marketing channel' });
      await channel.selectOption('Direct');
      await expect(page.getByRole('status', { name: 'Dashboard filter changes' })).toContainText('Direct');
      await expect(bar.getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
      await expect(page.getByRole('article', { name: 'Traffic sources', exact: true })
        .getByRole('button', { name: 'Show all channels instead of Direct' })).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Remove Direct filter', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(channel).toBeFocused();
      await expect(page.getByRole('status', { name: 'Dashboard filter changes' })).toContainText('Channel: all channels');
      const recovered = await zoomPageMetrics(page);
      expect(recovered.focus.visibleWithinViewport).toBe(true);
      expect(recovered.focus.unobscuredBelowStickyHeader, 'Recovered filter focus is visibly unobscured').toBe(true);
      observations.push({ target: target * 100, postFilterRecovery: recovered });
      const filterScreenshot = testInfo.outputPath(`39-native-zoom-${target * 100}-filter-focus.png`);
      await page.screenshot({ path: filterScreenshot, animations: 'disabled', scale: 'device' });
      await testInfo.attach(`39-native-zoom-${target * 100}-filter-focus`, { path: filterScreenshot, contentType: 'image/png' });
      await captureChromeZoomView(page, testInfo, `39-native-zoom-${target * 100}-filter-focus`);
    }
    await readBrowserZoom(worker, 1);
  } finally {
    const evidencePath = testInfo.outputPath('native-browser-zoom-evidence.json');
    await writeFile(evidencePath, JSON.stringify({
      note: 'Programmatic real Chromium tab zoom; not manual keyboard zoom or actual screen-reader speech.',
      observations,
    }, null, 2));
    await testInfo.attach('native-browser-zoom-evidence.json', { path: evidencePath, contentType: 'application/json' });
    await context.close();
  }
});
