import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Dashboard } from '../src/model';

const id = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const dashboard: Dashboard = {
  id, organizationId: 'northstar', name: 'Calendar evaluation',
  description: 'Fictional sample', revision: 1, createdBy: 'demo-owner',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [{ id: '806e3063-18e9-4ddb-887a-229198c6dd01', title: 'Total revenue',
    kind: 'metric', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' }],
};
test('embedded calendar applies one range, preserves existing sample and clears without API writes', async ({ page }, info) => {
  const writes: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push(path);
    if (path === '/api/organizations') return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] });
    if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [dashboard] });
    if (path === '/api/organizations/northstar/dashboards/' + id) return route.fulfill({ json: dashboard });
    return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/sample-host.html');
  const frame = page.frameLocator('.host-frame');
  const panel = frame.locator('.reporting-calendar');
  await panel.locator('summary').press('Enter');
  const period = panel.getByLabel('Reporting period', { exact: true });
  const scope = panel.getByRole('status', { name: 'Calendar filter scope' });
  const revenue = frame.getByRole('article', { name: 'Total revenue', exact: true }).locator('.metric-number');
  const before = await revenue.textContent();
  await expect(period.locator('option')).toHaveCount(13);
  await period.selectOption('custom');
  await panel.getByLabel('Start date and time', { exact: true }).fill('2026-11-16T00:00');
  await panel.getByLabel('End date and time (exclusive)').fill('2026-11-17T00:00');
  await panel.getByRole('button', { name: 'Apply reporting period' }).press('Enter');
  await expect(scope).toContainText('2026-11-16T00:00:00.000Z');
  await expect(scope).toContainText('2026-11-17T00:00:00.000Z');
  await expect(panel.getByRole('region', { name: 'Sales revenue' })).toContainText('$20');
  await expect(panel.getByRole('region', { name: 'Support requests' })).toContainText('1 fictional records');
  await expect(panel.getByRole('region', { name: 'Undated inventory' })).toContainText('42');
  await expect(revenue).toHaveText(before!);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const sizes = await panel.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth,
      doc: node.ownerDocument.documentElement.scrollWidth, viewport: node.ownerDocument.defaultView!.innerWidth }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
    expect(sizes.doc).toBeLessThanOrEqual(sizes.viewport + 1);
    await panel.locator('summary').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('exp02-calendar-' + width + '.png'), animations: 'disabled' });
  }
  await panel.getByLabel('Timezone').selectOption('America/Los_Angeles');
  await panel.getByLabel('Start date and time', { exact: true }).fill('2026-03-08T02:30');
  await panel.getByLabel('End date and time (exclusive)').fill('2026-03-08T04:00');
  await panel.getByRole('button', { name: 'Apply reporting period' }).click();
  await expect(panel.getByRole('alert')).toContainText('does not exist');
  await expect(scope).toContainText('2026-11-16T00:00:00.000Z');
  await panel.getByRole('button', { name: 'Cancel period changes' }).click();
  await expect(period).toBeFocused();
  await expect(panel.getByLabel('Timezone')).toHaveValue('UTC');
  await page.emulateMedia({ forcedColors: 'active' });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(x => x.id)).toEqual([]);
  await page.screenshot({ path: info.outputPath('exp02-forced-colors.png'), animations: 'disabled' });
  await panel.getByRole('button', { name: 'Clear reporting period' }).click();
  await expect(period).toBeFocused();
  await expect(scope).toContainText('No calendar restriction');
  await expect(panel.getByRole('region', { name: 'Sales revenue' })).toContainText('$345');
  await page.reload();
  await expect(panel.locator('summary')).toContainText('All time');
  expect(writes).toEqual([]);
});
