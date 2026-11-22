import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { Dashboard } from '../src/model';

// UX-35: a deterministic, mixed-source 18-card read-only embedded dashboard.
// Every aggregate, table and status reflects the same independent source rows.
const dashboardId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const patterns = [
  ['Total revenue', 'metric', 'commerce', 'revenue', 'month'],
  ['Revenue over time', 'area', 'commerce', 'revenue', 'month'],
  ['Orders by channel', 'bar', 'channels', 'orders', 'channel'],
  ['Traffic sources', 'donut', 'channels', 'sessions', 'channel'],
  ['Monthly orders', 'line', 'commerce', 'orders', 'month'],
  ['Channel details', 'table', 'channels', 'orders', 'channel'],
] as const;

const dashboard: Dashboard = {
  id: dashboardId, organizationId: 'northstar', name: 'Business performance',
  description: 'Mixed fictional commerce and marketing records',
  revision: 1, createdBy: 'demo-owner',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: Array.from({ length: 18 }, (_, index) => {
    const [title, kind, datasetKey, metricKey, dimensionKey] = patterns[index % patterns.length]!;
    return {
      id: `806e3063-18e9-4ddb-887a-229198c6${String(index + 1).padStart(4, '0')}`,
      title: `${title} ${index + 1}`, kind, datasetKey, metricKey, dimensionKey,
    };
  }),
};

async function mockApi(page: Page) {
  const requests: string[] = [];
  const writes: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push(`${request.method()} ${path}`);
    if (request.method() !== 'GET') writes.push(`${request.method()} ${path}`);
    if (path === '/api/organizations/northstar/dashboards')
      return route.fulfill({ json: [dashboard] });
    if (path === `/api/organizations/northstar/dashboards/${dashboardId}`)
      return route.fulfill({ json: dashboard });
    if (path === '/api/organizations')
      return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] });
    return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
  });
  return { requests, writes };
}
async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}
async function measurements(page: Page) {
  return page.locator('.host-frame').evaluate((iframe: HTMLIFrameElement) => {
    const child = iframe.contentDocument!;
    const scope = child.querySelector<HTMLElement>('.consumer-filters')!;
    return {
      hostWidth: document.documentElement.scrollWidth,
      hostViewport: innerWidth,
      childWidth: child.documentElement.scrollWidth,
      childViewport: child.defaultView!.innerWidth,
      filterWidth: scope.getBoundingClientRect().width,
      filterScrollWidth: scope.scrollWidth,
      scope: [...child.querySelectorAll('.filter-impact p')].map(element => element.textContent),
      applied: child.querySelectorAll('.widget-filter-applied').length,
      unaffected: child.querySelectorAll('.widget-filter-unaffected').length,
    };
  });
}

test('mixed 18-widget dashboard shows precise filter eligibility, unchanged sources and synchronized data across widths', async ({ page }, info) => {
  test.setTimeout(180_000);
  const { writes } = await mockApi(page);
  const frame = page.frameLocator('.host-frame');
  const evidence = [];
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sample-host.html');
    await expect(frame.locator('.canvas-item')).toHaveCount(18);
    // The sample host intentionally remembers filters across navigation.
    // Reset explicitly before comparing each viewport's unfiltered baseline.
    const dateControl = frame.getByRole('combobox', { name: 'Date range (commerce only)' });
    const channelControl = frame.getByRole('combobox', { name: 'Marketing channel' });
    if (await dateControl.inputValue() !== '12m') await dateControl.selectOption('12m');
    if (await channelControl.inputValue() !== '') await channelControl.selectOption('');
    await expect(dateControl).toHaveValue('12m');
    await expect(channelControl).toHaveValue('');
    const revenue = frame.getByRole('article', { name: 'Total revenue 1', exact: true });
    const table = frame.getByRole('article', { name: 'Channel details 6' }).getByRole('table');
    const before = await revenue.locator('.metric-number').textContent();
    const channelBefore = await table.locator('tbody tr').count();
    expect(channelBefore).toBe(5);

    await frame.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
    await expect(revenue.locator('.metric-number')).toHaveText('$128.3K');
    await expect(table.locator('tbody tr')).toHaveCount(5);
    const afterPeriod = await revenue.locator('.metric-number').textContent();
    expect(afterPeriod).not.toBe(before);

    await frame.getByRole('combobox', { name: 'Marketing channel' }).selectOption('Direct');
    await expect(revenue.locator('.metric-number')).toHaveText('$128.3K');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.getByRole('row', { name: /Direct.*1,530/ })).toBeVisible();
    await expect(frame.locator('.filter-impact')).toContainText('applies to 9 commerce visualizations; 9 marketing visualizations unchanged (no dates)');
    await expect(frame.locator('.filter-impact')).toContainText('applies to 9 marketing visualizations; 9 commerce visualizations unchanged (no channel attribution)');
    await expect(frame.getByLabel('Active filters')).toContainText('2 active filters');
    await expect(frame.locator('.widget-filter-applied')).toHaveCount(18);
    await expect(frame.locator('.widget-filter-unaffected')).toHaveCount(18);
    await expect(revenue.getByRole('button', { name: 'Remove Final 3 sample months filter from Total revenue 1', exact: true })).toBeVisible();
    await expect(revenue.getByText('Direct does not apply; commerce records have no channel attribution.')).toBeVisible();
    await expect(frame.getByRole('article', { name: 'Traffic sources 4' }).getByText('marketing channel records have no dates.')).toBeVisible();
    const size = await measurements(page);
    expect(size.hostWidth - size.hostViewport, 'host document horizontal overflow').toBeLessThanOrEqual(1);
    expect(size.childWidth - size.childViewport, 'embedded document horizontal overflow').toBeLessThanOrEqual(1);
    expect(size.filterScrollWidth - size.filterWidth, 'filter controls horizontal overflow').toBeLessThanOrEqual(2);
    evidence.push({ width, ...size, before, afterPeriod, channelBefore });
    // Capture the actionable scope explanation, not only the host heading.
    await frame.locator('.filter-impact').scrollIntoViewIfNeeded();
    await capture(page, info, `ux35-mixed-active-${width}`);
  }

  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  const dateChip = frame.getByRole('button', { name: 'Remove Final 3 sample months filter', exact: true });
  await dateChip.focus();
  await page.keyboard.press('Enter');
  await expect(frame.getByRole('combobox', { name: 'Date range (commerce only)' })).toBeFocused();
  await expect(frame.getByRole('combobox', { name: 'Marketing channel' })).toHaveValue('Direct');
  await expect(frame.locator('.filter-impact')).not.toContainText('Reporting period:');
  await expect(frame.locator('.filter-impact')).toContainText('Marketing channel:');
  const outline = await frame.getByRole('combobox', { name: 'Date range (commerce only)' }).evaluate(
    node => getComputedStyle(node).outlineStyle);
  expect(outline).not.toBe('none');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(item => item.id)).toEqual([]);
  await capture(page, info, 'ux35-forced-colors-date-removal-320');

  const path = info.outputPath('ux35-scope-interaction-evidence.json');
  await writeFile(path, JSON.stringify(evidence, null, 2));
  await info.attach('ux35-scope-interaction-evidence.json', { path, contentType: 'application/json' });
  expect(writes).toEqual([]);
});

test('keyboard recovery, per-card resets, full defaults and host reload preserve only dashboard view filters', async ({ page }, info) => {
  test.setTimeout(90_000);
  const { writes, requests } = await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('.host-frame');
  const date = frame.getByRole('combobox', { name: 'Date range (commerce only)' });
  const channel = frame.getByRole('combobox', { name: 'Marketing channel' });
  const revenue = frame.getByRole('article', { name: 'Total revenue 1', exact: true });
  await date.selectOption('3m');
  await channel.selectOption('Direct');
  const localClear = revenue.getByRole('button', { name: 'Remove Final 3 sample months filter from Total revenue 1', exact: true });
  await localClear.focus();
  await page.keyboard.press('Enter');
  await expect(revenue.getByRole('heading', { name: 'Total revenue 1' })).toBeFocused();
  await expect(date).toHaveValue('12m');
  await expect(channel).toHaveValue('Direct');

  await date.selectOption('6m');
  const restore = frame.getByRole('button', { name: 'Restore default filters' });
  await restore.focus();
  await page.keyboard.press('Enter');
  await expect(date).toBeFocused();
  await expect(date).toHaveValue('12m');
  await expect(channel).toHaveValue('');
  await expect(frame.getByLabel('Active filters')).toContainText('All sample records');
  await expect(frame.locator('.filter-impact')).toHaveCount(0);
  await expect(frame.locator('.widget-filter-context')).toHaveCount(0);

  await date.selectOption('3m');
  await channel.selectOption('Direct');
  await page.reload();
  await expect(date).toHaveValue('3m');
  await expect(channel).toHaveValue('Direct');
  await expect(frame.locator('.filter-impact')).toContainText('9 commerce visualizations');
  await expect(page.getByRole('navigation', { name: 'Customer dashboards' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'After the embedded dashboard' })).toBeVisible();
  await frame.locator('.filter-impact').scrollIntoViewIfNeeded();
  await capture(page, info, 'ux35-host-reload-scope-390');
  expect(writes).toEqual([]);
  expect(requests.some(path => path.includes('/isolated/'))).toBe(false);
});
