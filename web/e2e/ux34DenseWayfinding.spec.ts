import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { Dashboard } from '../src/model';

const dashboardId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const patterns = [
  ['Total revenue', 'metric', 'commerce', 'revenue', 'month'],
  ['Revenue over time', 'area', 'commerce', 'revenue', 'month'],
  ['Orders by channel', 'bar', 'channels', 'orders', 'channel'],
  ['Traffic sources', 'donut', 'channels', 'sessions', 'channel'],
  ['Monthly orders', 'line', 'commerce', 'orders', 'month'],
  ['Channel details', 'table', 'channels', 'orders', 'channel'],
];

const dense: Dashboard = {
  id: dashboardId, organizationId: 'northstar', name: 'Business performance',
  description: 'Eighteen fictional charts and tables for dense-dashboard evaluation',
  revision: 1, createdBy: 'demo-owner',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: Array.from({ length: 18 }, (_, index) => {
    const [title, kind, datasetKey, metricKey, dimensionKey] = patterns[index % patterns.length]!;
    return {
      id: `806e3063-18e9-4ddb-887a-229198c6${String(index + 1).padStart(4, '0')}`,
      title: `${title} ${index + 1}`,
      kind: kind as Dashboard['widgets'][number]['kind'],
      datasetKey: datasetKey as Dashboard['widgets'][number]['datasetKey'],
      metricKey, dimensionKey,
    };
  }),
};

async function mockApi(page: Page) {
  const writes: string[] = [];
  const paths: string[] = [];
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    paths.push(`${request.method()} ${path}`);
    if (request.method() !== 'GET') writes.push(`${request.method()} ${path}`);
    if (path === '/api/organizations/northstar/dashboards')
      return route.fulfill({ json: [dense] });
    if (path === `/api/organizations/northstar/dashboards/${dashboardId}`)
      return route.fulfill({ json: dense });
    if (path === '/api/organizations')
      return route.fulfill({ json: [{ id: 'northstar', name: 'Northstar Commerce', role: 'viewer' }] });
    return route.fulfill({ status: 403, json: { title: 'Forbidden' } });
  });
  return { writes, paths };
}

async function geometry(page: Page) {
  return page.locator('.host-frame').evaluate((iframe: HTMLIFrameElement) => {
    const child = iframe.contentDocument!;
    const shell = child.querySelector<HTMLElement>('.embedded-shell')!;
    return {
      hostWidth: document.documentElement.scrollWidth,
      hostViewportWidth: innerWidth,
      hostScrollY: scrollY,
      hostDocumentHeight: document.documentElement.scrollHeight,
      frameHeight: iframe.getBoundingClientRect().height,
      shellHeight: shell.getBoundingClientRect().height,
      childScrollHeight: child.documentElement.scrollHeight,
      childViewportHeight: child.defaultView!.innerHeight,
      childScrollWidth: child.documentElement.scrollWidth,
      childViewportWidth: child.defaultView!.innerWidth,
    };
  });
}

async function assertHostOwnedScrolling(page: Page) {
  await expect.poll(async () => {
    const size = await geometry(page);
    return Math.abs(size.frameHeight - size.shellHeight);
  }).toBeLessThanOrEqual(3);
  const size = await geometry(page);
  expect(size.hostWidth - size.hostViewportWidth, 'host stays within available width').toBeLessThanOrEqual(1);
  expect(size.childScrollWidth - size.childViewportWidth, 'embedded document stays within width').toBeLessThanOrEqual(1);
  expect(size.childScrollHeight - size.childViewportHeight, 'no inner iframe vertical scrollbar').toBeLessThanOrEqual(3);
  return size;
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}

test('18-widget navigation returns to the exact index entry and back without hijacking host scrolling', async ({ page }, info) => {
  test.setTimeout(150_000);
  const { writes, paths } = await mockApi(page);
  const frame = page.frameLocator('.host-frame');
  const target = dense.widgets[15]!;
  const measurements = [];
  // 640 and 320px are layout reflow equivalents of 200% and 400% zoom
  // from a 1280px CSS layout; not a claimed native zoom session.
  for (const width of [1440, 768, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/sample-host.html');
    await expect(frame.locator('.canvas-item')).toHaveCount(18);
    await frame.getByRole('combobox', { name: 'Date range (commerce only)' }).selectOption('3m');
    const finder = frame.getByRole('combobox', { name: 'Find a visualization' });
    await finder.selectOption(target.id);
    await frame.getByRole('button', { name: 'Go to visualization' }).click();
    const heading = frame.getByRole('heading', { name: target.title });
    await expect(heading).toBeFocused();
    const reached = await assertHostOwnedScrolling(page);
    expect(reached.hostScrollY, 'host window scrolls to the deep visualization').toBeGreaterThan(0);
    await capture(page, info, `ux34-deep-${width}`);

    await frame.getByRole('button', { name: `Jump to visualization index from ${target.title}` }).click();
    const index = frame.locator('details.dashboard-index');
    await expect(index).toHaveAttribute('open', '');
    await expect(index.getByRole('button', { name: `16. ${target.title}` })).toBeFocused();
    await frame.getByRole('button', { name: `Return to ${target.title}` }).click();
    await expect(heading).toBeFocused();
    await expect(finder).toHaveValue(target.id);
    await expect(frame.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('3m');
    const returned = await assertHostOwnedScrolling(page);
    measurements.push({ width, reached, returned });
  }
  await page.reload();
  await expect(frame.getByRole('combobox', { name: 'Date range (commerce only)' })).toHaveValue('3m');
  await expect(page.getByRole('navigation', { name: 'Customer dashboards' })).toBeVisible();
  const output = info.outputPath('ux34-wayfinding-geometry.json');
  await writeFile(output, JSON.stringify(measurements, null, 2));
  await info.attach('ux34-wayfinding-geometry.json', { path: output, contentType: 'application/json' });
  expect(writes).toEqual([]);
  expect(paths.some(path => path.includes('/isolated/'))).toBe(false);
});

test('tables preserve headings and full numeric values at 390/320px with horizontal-only region scrolling', async ({ page }, info) => {
  test.setTimeout(90_000);
  const { writes } = await mockApi(page);
  const frame = page.frameLocator('.host-frame');
  const metrics = [];
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/sample-host.html');
    await expect(frame.locator('.canvas-item')).toHaveCount(18);
    const article = frame.getByRole('article', { name: 'Channel details 6' });
    const table = article.getByRole('table', { name: /Channel details 6/ });
    await expect(table.getByRole('columnheader', { name: 'Share (rounded)' })).toBeVisible();
    await expect(table.getByRole('row', { name: /Organic search.*1,820/ })).toBeVisible();
    const region = article.getByRole('region', { name: 'Scrollable Channel details 6 table' });
    await expect(region).toBeVisible();
    const before = await region.evaluate(element => ({
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
    }));
    expect(before.scrollWidth).toBeGreaterThan(before.clientWidth + 1);
    expect(before.scrollHeight - before.clientHeight, 'no nested vertical table scrolling').toBeLessThanOrEqual(1);
    await expect(article.locator('.table-scroll-hint')).toContainText('More columns to the right');
    // Show the unscrolled columns and cue, not the host header, in the initial screenshot.
    await region.scrollIntoViewIfNeeded();
    await capture(page, info, `ux34-data-initial-${width}`);
    await region.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await expect(region).toBeFocused();
    await expect(article.locator('.table-scroll-hint')).toContainText('left');
    await capture(page, info, `ux34-data-${width}`);

    const revenue = frame.getByRole('article', { name: 'Revenue over time 2' });
    await revenue.locator('details.chart-data > summary').click();
    const expanded = revenue.getByRole('region', { name: 'Scrollable Revenue over time 2 data' });
    await expect(revenue.getByRole('columnheader', { name: 'Revenue (USD)' })).toBeVisible();
    await expect(revenue.getByRole('row', { name: /Jan.*\$18,400/ })).toBeVisible();
    await expect(revenue.locator('.table-scroll-hint')).toContainText('More columns to the right');
    const details = await expanded.evaluate(element => ({
      clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
    }));
    expect(details.scrollHeight - details.clientHeight, 'expanded chart data flows into host page').toBeLessThanOrEqual(1);
    const embed = await assertHostOwnedScrolling(page);
    metrics.push({ width, table: before, chartDetails: details, embed });
    await capture(page, info, `ux34-expanded-${width}`);
  }

  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  const focus = frame.getByRole('button', { name: 'Jump to visualization index from Channel details 6' });
  // Exercise keyboard modality; programmatic .focus() alone need not match :focus-visible.
  await focus.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(focus).toBeFocused();
  const outline = await focus.evaluate(element => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(scan.violations.map(item => item.id)).toEqual([]);
  await capture(page, info, 'ux34-forced-colors-320');
  const output = info.outputPath('ux34-table-geometry.json');
  await writeFile(output, JSON.stringify(metrics, null, 2));
  await info.attach('ux34-table-geometry.json', { path: output, contentType: 'application/json' });
  expect(writes).toEqual([]);
});
