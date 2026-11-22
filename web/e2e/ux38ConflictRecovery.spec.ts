import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Dashboard, DashboardDraft, DashboardWidget } from '../src/model';

const id = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3888';
const widget = (index: number, title: string): DashboardWidget => ({
  id: `806e3063-18e9-4ddb-887a-229198c6${String(index).padStart(4, '0')}`,
  title, kind: 'metric', datasetKey: 'commerce', metricKey: 'orders', dimensionKey: 'month',
});
const original: Dashboard = {
  id, organizationId: 'northstar', name: 'Shared dashboard', description: 'Original description',
  revision: 1, createdBy: 'owner', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [widget(1, 'Revenue'), widget(2, 'Orders'), widget(3, 'Sessions')],
};

async function mockApi(page: Page) {
  let saved = structuredClone(original);
  let role: 'owner' | 'viewer' | 'none' = 'owner';
  let failRead = false;
  const writes: { expectedRevision: number; name: string; widgets: DashboardWidget[]; status: number }[] = [];
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'owner', displayName: 'Owner' } });
    if (path === '/api/organizations') return route.fulfill({
      json: role === 'none' ? [] : [{ id: 'northstar', name: 'Northstar Commerce', role }],
    });
    if (path === '/api/organizations/northstar/dashboards' && request.method() === 'GET')
      return route.fulfill({ json: [saved] });
    if (path === `/api/organizations/northstar/dashboards/${id}`) {
      if (request.method() === 'GET')
        return failRead || role === 'none' ? route.fulfill({ status: role === 'none' ? 403 : 503 })
          : route.fulfill({ json: saved });
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as DashboardDraft & { expectedRevision: number };
        const status = role !== 'owner' ? 403 : body.expectedRevision === saved.revision ? 200 : 409;
        writes.push({ expectedRevision: body.expectedRevision, name: body.name, widgets: body.widgets, status });
        if (status !== 200) return route.fulfill({ status });
        saved = { ...saved, name: body.name, description: body.description,
          widgets: body.widgets, revision: saved.revision + 1 };
        return route.fulfill({ json: saved });
      }
    }
    return route.fulfill({ status: 403 });
  });
  return {
    saved: () => structuredClone(saved), writes,
    otherEditor: (patch: (current: Dashboard) => Dashboard) => {
      saved = { ...patch(structuredClone(saved)), revision: saved.revision + 1 };
    },
    role: (next: 'owner' | 'viewer' | 'none') => { role = next; },
    readError: (next: boolean) => { failRead = next; },
  };
}

async function open(page: Page) {
  await page.goto(`/#/organization/northstar/dashboard/${id}`);
  await expect(page.getByRole('heading', { name: 'Shared dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
}

async function conflict(page: Page) {
  await page.getByRole('button', { name: 'Save changes' }).click();
  const region = page.getByRole('region', { name: 'Dashboard conflict recovery' });
  await expect(region).toBeVisible();
  await expect(region).toBeFocused();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  return region;
}

async function inspect(page: Page, info: TestInfo, label: string) {
  const path = info.outputPath(`ux38-${label}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(label, { path, contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test('metadata conflict: select one independent edit, preserve remote description, then save explicitly', async ({ page }, info) => {
  const server = await mockApi(page);
  await open(page);
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('My revised name');
  server.otherEditor(current => ({ ...current, description: 'New shared description' }));
  const region = await conflict(page);
  await expect(region).toContainText('Opened at revision 1; latest saved revision 2');
  await expect(region).toContainText('Your independent edits: 1');
  await region.getByText('Review differences and choose edits to recover').click();
  await expect(region).toContainText('Dashboard description (saved remotely)');
  await region.getByRole('checkbox', { name: /Dashboard name/ }).check();
  await inspect(page, info, 'metadata-review-desktop');
  page.once('dialog', dialog => void dialog.accept());
  await region.getByRole('button', { name: 'Recover selected edits (1)' }).click();
  await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toHaveValue('My revised name');
  await expect(page.getByRole('textbox', { name: 'Dashboard description' })).toHaveValue('New shared description');
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  expect(server.writes.map(write => write.status)).toEqual([409]);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
  expect(server.writes.map(write => write.expectedRevision)).toEqual([1, 2]);
  expect(server.saved()).toMatchObject({ name: 'My revised name', description: 'New shared description', revision: 3 });
});

test('two editors edit different widgets; local repair is reapplied without overwriting remote title', async ({ page }) => {
  const server = await mockApi(page);
  await open(page);
  await page.getByRole('button', { name: 'Edit Revenue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Revenue repaired');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  server.otherEditor(current => ({
    ...current, widgets: current.widgets.map(item => item.title === 'Orders' ? { ...item, title: 'Orders remote' } : item),
  }));
  const region = await conflict(page);
  await region.getByText('Review differences and choose edits to recover').click();
  await expect(region).toContainText('Visualization: Orders (saved remotely)');
  await region.getByRole('checkbox', { name: /Revenue repaired/ }).check();
  page.once('dialog', dialog => void dialog.accept());
  await region.getByRole('button', { name: 'Recover selected edits (1)' }).click();
  expect(server.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect(server.saved().widgets.map(item => item.title)).toEqual(['Revenue repaired', 'Orders remote', 'Sessions']);
});

test('same-widget overlap and remote deletion are not silently merged; draft stays available', async ({ page }) => {
  const server = await mockApi(page);
  await open(page);
  await page.getByRole('button', { name: 'Edit Revenue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Locally edited');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  server.otherEditor(current => ({ ...current, widgets: current.widgets.filter(item => item.title !== 'Revenue') }));
  const region = await conflict(page);
  await expect(page.getByRole('article', { name: 'Locally edited' })).toBeVisible();
  await region.getByText('Review differences and choose edits to recover').click();
  await expect(region).toContainText('overlapping');
  await expect(region.getByRole('checkbox')).toHaveCount(0);
  await expect(region.getByRole('button', { name: 'Recover selected edits (0)' })).toBeDisabled();
  await region.getByRole('button', { name: 'Keep editing original draft' }).click();
  await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  expect(server.writes).toHaveLength(1);
});

test('remote reorder plus local deletion requires manual reordering; explicit discard remains available', async ({ page }) => {
  const server = await mockApi(page);
  await open(page);
  await page.getByRole('button', { name: 'Move Revenue later' }).click();
  await page.getByRole('button', { name: 'Remove Sessions' }).click();
  server.otherEditor(current => ({ ...current, widgets: [...current.widgets, widget(4, 'New remotely')] }));
  const region = await conflict(page);
  await region.getByText('Review differences and choose edits to recover').click();
  await expect(region).toContainText('Visualization order (manual reordering)');
  await region.getByRole('checkbox', { name: /Sessions/ }).check();
  page.once('dialog', dialog => void dialog.accept());
  await region.getByRole('button', { name: 'Recover selected edits (1)' }).click();
  await expect(page.getByRole('article', { name: 'Sessions' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'New remotely' })).toBeVisible();
  expect(await page.locator('.canvas-item .widget-title').allTextContents()).toEqual(['Revenue', 'Orders', 'New remotely']);
});

test('newer revision during recovery forces renewed review; another stale save is still rejected', async ({ page }) => {
  const server = await mockApi(page);
  await open(page);
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Local name');
  server.otherEditor(current => ({ ...current, description: 'Remote first' }));
  const region = await conflict(page);
  await region.getByText('Review differences and choose edits to recover').click();
  await region.getByRole('checkbox', { name: /Dashboard name/ }).check();
  server.otherEditor(current => ({ ...current, description: 'Remote second' }));
  await region.getByRole('button', { name: 'Recover selected edits (1)' }).click();
  await expect(region).toContainText('latest saved revision 3');
  await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toHaveValue('Local name');
  await expect(region.getByRole('button', { name: 'Recover selected edits (0)' })).toBeDisabled();
  await region.getByRole('checkbox', { name: /Dashboard name/ }).check();
  page.once('dialog', dialog => void dialog.accept());
  await region.getByRole('button', { name: 'Recover selected edits (1)' }).click();
  await expect(region).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  server.otherEditor(current => ({ ...current, description: 'Remote third' }));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('region', { name: 'Dashboard conflict recovery' })).toContainText('latest saved revision 4');
  expect(server.writes.map(write => write.status)).toEqual([409, 409]);
});

test('unavailable latest fetch and revoked editing permission do not authorize recovery', async ({ page }) => {
  const server = await mockApi(page);
  await open(page);
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Local name');
  server.otherEditor(current => ({ ...current, description: 'Remote' }));
  server.readError(true);
  let region = await conflict(page);
  await expect(region).toContainText('could not be confirmed');
  expect(server.writes).toHaveLength(1);
  server.readError(false);
  await region.getByRole('button', { name: 'Check latest version' }).click();
  await expect(region).toContainText('latest saved revision 2');
  await region.getByText('Review differences and choose edits to recover').click();
  await region.getByRole('checkbox', { name: /Dashboard name/ }).check();
  server.role('viewer');
  await region.getByRole('button', { name: 'Recover selected edits (1)' }).click();
  await expect(region).toContainText('editing permission could not be confirmed');
  await expect(page.getByRole('textbox', { name: 'Dashboard name' })).toHaveValue('Local name');
  expect(server.writes).toHaveLength(1);
});

test('narrow recovery and forced colors remain keyboard-accessible without horizontal overflow', async ({ page }, info) => {
  test.setTimeout(150_000);
  const server = await mockApi(page);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    if (width !== 1440) await page.reload();
    await open(page);
    await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Locally updated');
    server.otherEditor(current => ({ ...current, description: `Remote revision ${current.revision + 1}` }));
    const region = await conflict(page);
    await region.getByText('Review differences and choose edits to recover').click();
    await region.getByRole('checkbox', { name: /Dashboard name/ }).check();
    await inspect(page, info, `review-${width}`);
  }
  await page.emulateMedia({ forcedColors: 'active' });
  const region = page.getByRole('region', { name: 'Dashboard conflict recovery' });
  const findings = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(findings.violations.map(item => item.id)).toEqual([]);
  await inspect(page, info, 'forced-colors-320');
  page.once('dialog', dialog => void dialog.dismiss());
  await page.getByRole('button', { name: 'Back to dashboards' }).click();
  await expect(region).toBeVisible();
  expect(server.writes.filter(write => write.status === 200)).toHaveLength(0);
});
