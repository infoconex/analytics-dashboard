import { chromium, expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const membership = [
  { id: 'northstar', name: 'Northstar Commerce', role: 'viewer' },
  { id: 'isolated', name: 'Isolated Tenant', role: 'viewer' },
];
const widget = (index: number) => ({ id: `example-${index}`, title: `Insight ${index}`, kind: 'area',
  datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' });
const sampleDashboard = (id: string, organizationId: string, widgets: ReturnType<typeof widget>[]) => ({
  id, organizationId, widgets, name: `Sample ${id}`, description: 'Fictional example', revision: 1,
  createdBy: 'sample', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
});

test('first arrival reaches and understands a sample insight, filters and recovers with keyboard focus', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/api/organizations', route => route.fulfill({ json: [membership[0]] }));
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  const steps: string[] = [];
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByText('Northstar Commerce').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What would you like to understand?' })).toBeVisible();
  await expect(page.getByText('fictional sample metrics')).toBeVisible();
  await page.screenshot({ path: info.outputPath('ux8-first-arrival-desktop.png'), fullPage: true });

  await page.getByRole('button', { name: /Explore: How is revenue changing\?/ }).click(); steps.push('Select relevant question');
  const title = page.getByRole('heading', { name: 'How is revenue changing?' });
  await expect(title).toBeFocused();
  await expect(page.getByText('YOUR STARTING POINT · SAMPLE DATA')).toBeVisible();
  await page.getByRole('button', { name: 'Go to Revenue over time' }).click(); steps.push('Go to answering chart');
  const chart = page.getByRole('article', { name: 'Revenue over time' });
  await expect(chart.getByRole('heading', { name: 'Revenue over time' })).toBeFocused();
  await expect(chart.getByText('At a glance:')).toBeVisible();
  await chart.getByText('View data table').click(); steps.push('Inspect exact data');
  await expect(chart.getByRole('table')).toBeVisible();
  await page.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m'); steps.push('Apply filter');
  await expect(page.getByRole('button', { name: 'Remove Last 3 months filter' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Last 3 months filter' }).focus();
  await page.keyboard.press('Enter'); steps.push('Remove filter');
  await expect(page.getByRole('combobox', { name: 'Date range (commerce only)' })).toBeFocused();
  await expect(page.getByText('All sample records', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to dashboards' }).click(); steps.push('Return to catalog');
  await expect(page.getByRole('heading', { name: 'Dashboards', exact: true })).toBeVisible();
  expect(failures).toEqual([]);
  await writeFile(info.outputPath('ux8-first-value-task.json'), JSON.stringify({
    environment: { runnerOS: process.platform, chrome: page.context().browser()?.version(), viewport: page.viewportSize() },
    outcome: 'completed', deliberateStepsToAnswer: 2, totalRecordedSteps: steps.length, steps,
    scriptErrors: failures, focusAtAnswer: 'Revenue over time heading', focusAfterFilterReset: 'Date range selector',
    limitations: 'Scripted measurements, not human usability or screen-reader spoken output',
  }, null, 2));
});

test('catalog discovers dashboards by business question and search, with no-match recovery', async ({ page }) => {
  await page.goto('/#/dashboards');
  const options = page.getByRole('group', { name: 'Find dashboards by business question' });
  await options.getByRole('button', { name: 'Where are orders coming from?' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Showing 1 matching dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toBeVisible();
  await page.getByRole('button', { name: 'View dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Where are orders coming from?' })).toBeFocused();
  await page.getByRole('button', { name: 'Go to Orders by channel' }).click();
  await expect(page.getByRole('heading', { name: 'Orders by channel' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to dashboards' }).click();

  await page.getByRole('textbox', { name: 'Search dashboards' }).fill('does-not-exist');
  await expect(page.getByRole('heading', { name: 'No matching dashboards' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all dashboards' }).click();
  await expect(page.getByRole('textbox', { name: 'Search dashboards' })).toHaveValue('');
  await expect(options.getByRole('button', { name: 'All dashboards' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Business performance' })).toBeVisible();
});

test('keyboard-only first-value entry preserves a meaningful focus destination and read-only role', async ({ page }) => {
  await page.route('**/api/organizations', route => route.fulfill({ json: [membership[0]] }));
  await page.goto('/');
  const choice = page.getByRole('button', { name: /Explore: Which channels bring visitors\?/ });
  let reached = false;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if (await choice.evaluate(node => node === document.activeElement)) { reached = true; break; }
  }
  expect(reached).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Which channels bring visitors?' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Go to Traffic sources' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Traffic sources' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await page.getByText('How to explore this dashboard').click();
  await expect(page.getByText('This is a read-only view; exploring and filtering never change the saved dashboard.')).toBeVisible();
});

test('empty organization and missing question have no fictional recommendations or implicit authoring', async ({ page }) => {
  await page.route('**/api/organizations', route => route.fulfill({ json: [membership[1]] }));
  await page.route('**/api/organizations/isolated/dashboards', route => route.fulfill({ json: [] }));
  await page.goto('/#/organization/isolated/overview');
  await expect(page.getByText('No matching dashboard here yet')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Explore: / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Browse all dashboards' }).click();
  await expect(page.getByRole('heading', { name: 'No dashboards in this organization' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New dashboard' })).toHaveCount(0);
});

test('retry after unavailable dashboard list restores actual suggestions', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/organizations/northstar/dashboards', route => {
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, body: 'Unavailable' });
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Request failed (503)');
  await expect(page.getByRole('button', { name: /Explore: / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Explore: How is revenue changing\?/ })).toBeVisible();
  expect(attempts).toBe(2);
});

test('switching organizations clears old question/search and prevents cross-tenant display', async ({ page }) => {
  const isolated = sampleDashboard('isolated-only', 'isolated', [widget(1)]);
  await page.route('**/api/organizations', route => route.fulfill({ json: membership }));
  await page.route('**/api/organizations/isolated/dashboards', route => route.fulfill({ json: [isolated] }));
  await page.goto('/#/organization/northstar/dashboards');
  await page.getByRole('textbox', { name: 'Search dashboards' }).fill('Business');
  await page.getByRole('group', { name: 'Find dashboards by business question' })
    .getByRole('button', { name: 'Where are orders coming from?' }).click();
  await page.getByRole('combobox', { name: 'Switch organization' }).selectOption('isolated');
  await expect(page.getByRole('textbox', { name: 'Search dashboards' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByText('Business performance')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dashboards' }).click();
  await expect(page.getByRole('textbox', { name: 'Search dashboards' })).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Sample isolated-only' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business performance' })).toHaveCount(0);
});

test('dense dashboard question jump and return to index preserve focus', async ({ page }) => {
  const dense = sampleDashboard('dense', 'northstar', Array.from({ length: 12 }, (_, i) => widget(i + 1)));
  await page.route('**/api/organizations/northstar/dashboards', route => route.fulfill({ json: [dense] }));
  await page.goto('/#/organization/northstar/dashboards');
  await page.getByRole('group', { name: 'Find dashboards by business question' })
    .getByRole('button', { name: 'How is revenue changing?' }).click();
  await page.getByRole('button', { name: 'View dashboard' }).click();
  await page.getByRole('button', { name: 'Go to Insight 1' }).click();
  await expect(page.getByRole('heading', { name: 'Insight 1', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Back to visualization list from Insight 1' }).click();
  await expect(page.getByRole('button', { name: '1. Insight 1' })).toBeFocused();
});

test('same-origin customer embed keeps contextual help and cannot discover authoring', async ({ page }) => {
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('iframe[title="Business performance analytics — Northstar Commerce sample"]');
  await expect(frame.getByText('How to explore this dashboard')).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await frame.getByText('How to explore this dashboard').click();
  await expect(frame.getByText('This is a read-only view; exploring and filtering never change the saved dashboard.')).toBeVisible();
});

for (const { width, height, label } of [
  { width: 1440, height: 900, label: 'desktop' },
  { width: 390, height: 844, label: 'mobile' },
  { width: 320, height: 900, label: 'narrow' },
]) {
  test(`first-value discovery reflows at ${label} ${width}×${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'What would you like to understand?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Explore: How is revenue changing\?/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`ux8-first-value-${label}.png`), fullPage: true });
  });
}

test('forced-colors discovery keeps question selection, focus and text readable', async ({ page }, info) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/#/dashboards');
  const choice = page.getByRole('group', { name: 'Find dashboards by business question' })
    .getByRole('button', { name: 'How is revenue changing?' });
  await choice.focus();
  await page.keyboard.press('Enter');
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  await expect(choice).toBeFocused();
  await page.screenshot({ path: info.outputPath('ux8-forced-colors.png'), fullPage: true });
});

test('genuine Chromium 200% and 400% tab zoom reflows question-first navigation', async ({}, info) => {
  const extension = join(dirname(fileURLToPath(import.meta.url)), 'zoom-extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true, viewport: null,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--window-size=1440,900'],
  });
  const evidence: unknown[] = [];
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5173/');
    await expect(page.getByRole('heading', { name: 'What would you like to understand?' })).toBeVisible();
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const setZoom = (factor: number) => worker.evaluate(async f => {
      const tabs = (globalThis as unknown as { chrome: { tabs: {
        query(details: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>;
        setZoom(id: number, zoom: number): Promise<void>;
        getZoom(id: number): Promise<number>;
      } } }).chrome.tabs;
      const tab = (await tabs.query({})).find(item => item.url?.includes('127.0.0.1:5173/'));
      if (tab?.id === undefined) throw new Error('Discovery browser tab unavailable');
      await tabs.setZoom(tab.id, f);
      return tabs.getZoom(tab.id);
    }, factor);
    const metrics = () => page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, overflow: document.documentElement.scrollWidth > innerWidth }));
    const baseline = await metrics();
    for (const factor of [2, 4]) {
      const actual = await setZoom(factor);
      await expect.poll(async () => (await metrics()).width).toBeLessThanOrEqual(baseline.width / factor + 2);
      const observed = await metrics();
      expect(actual).toBeCloseTo(factor, 1);
      expect(observed.dpr / baseline.dpr).toBeCloseTo(factor, 1);
      expect(observed.overflow).toBe(false);
      const start = page.getByRole('button', { name: /Explore: How is revenue changing\?/ });
      await expect(start).toBeVisible();
      await start.focus();
      await expect(start).toBeFocused();
      const cdp = await context.newCDPSession(page);
      const raw = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
      const path = info.outputPath(`ux8-native-${factor * 100}-chrome.png`);
      await writeFile(path, Buffer.from(raw.data, 'base64'));
      await info.attach(`ux8-native-${factor * 100}-chrome`, { path, contentType: 'image/png' });
      evidence.push({ factor, actual, observed, chrome: context.browser()?.version(), runnerOS: process.platform, focusVisible: true });
    }
  } finally {
    const path = info.outputPath('ux8-native-zoom.json');
    await writeFile(path, JSON.stringify(evidence, null, 2));
    await info.attach('ux8-native-zoom.json', { path, contentType: 'application/json' });
    await context.close();
  }
});
