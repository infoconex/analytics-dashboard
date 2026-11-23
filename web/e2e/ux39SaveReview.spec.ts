import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Dashboard, DashboardDraft, DashboardWidget } from '../src/model';

const id = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3888';
const widget = (index: number, title: string): DashboardWidget => ({
  id: `806e3063-18e9-4ddb-887a-229198c6${String(index).padStart(4, '0')}`,
  title, kind: 'metric', datasetKey: 'commerce', metricKey: 'orders', dimensionKey: 'month',
});
const initial: Dashboard = {
  id, organizationId: 'northstar', name: 'Shared dashboard', description: 'Original description',
  revision: 1, createdBy: 'owner', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: [widget(1, 'Revenue'), widget(2, 'Orders'), widget(3, 'Sessions')],
};

async function mockApi(page: Page, seed: Dashboard = initial, startingRole: 'owner' | 'viewer' = 'owner') {
  let saved = structuredClone(seed);
  let role: 'owner' | 'viewer' = startingRole;
  let failWrite = false;
  let templates = 0;
  const writes: { expectedRevision: number; status: number; name: string; widgets: DashboardWidget[] }[] = [];
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'owner', displayName: 'Owner' } });
    if (path === '/api/organizations') return route.fulfill({
      json: [{ id: 'northstar', name: 'Northstar Commerce', role }],
    });
    if (path === '/api/organizations/northstar/dashboards' && method === 'GET')
      return route.fulfill({ json: [saved] });
    if (path === `/api/organizations/northstar/dashboards/${id}`) {
      if (method === 'GET') return route.fulfill({ json: saved });
      if (method === 'PUT') {
        const body = request.postDataJSON() as DashboardDraft & { expectedRevision: number };
        const status = role === 'viewer' ? 403 : failWrite ? 503 : body.expectedRevision !== saved.revision ? 409 : 200;
        writes.push({ expectedRevision: body.expectedRevision, name: body.name, widgets: body.widgets, status });
        if (status !== 200) return route.fulfill({ status });
        saved = { ...saved, name: body.name, description: body.description,
          widgets: body.widgets, revision: saved.revision + 1 };
        return route.fulfill({ json: saved });
      }
    }
    if (path === '/api/organizations/northstar/visualizations') {
      if (method === 'GET') return route.fulfill({ json: [] });
      if (method === 'POST' && role === 'owner') {
        const body = request.postDataJSON() as { definition: DashboardWidget; description: string };
        templates += 1;
        return route.fulfill({ status: 201, json: { id: 'f8e855a4-8a72-4b25-a64b-7b3e2ed80482',
          organizationId: 'northstar', description: body.description,
          definition: body.definition, revision: 1, createdBy: 'owner', createdAt: '', updatedAt: '' } });
      }
    }
    return route.fulfill({ status: 403 });
  });
  return {
    saved: () => structuredClone(saved), writes, templates: () => templates,
    otherEditor: (patch: (before: Dashboard) => Dashboard) => {
      saved = { ...patch(structuredClone(saved)), revision: saved.revision + 1 };
    },
    role: (value: 'owner' | 'viewer') => { role = value; },
    failWrite: (value: boolean) => { failWrite = value; },
  };
}

async function edit(page: Page) {
  await page.goto(`/#/organization/northstar/dashboard/${id}`);
  await expect(page.getByRole('heading', { name: 'Shared dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit dashboard' }).click();
}
const pending = (page: Page) => page.getByRole('region', { name: 'Pending dashboard changes' });

async function snapshot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`ux39-${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test('single metadata change: optional review, normal Save and accurate post-save state', async ({ page }) => {
  const api = await mockApi(page);
  await edit(page);
  await expect(pending(page)).toHaveCount(0);
  const name = page.getByRole('textbox', { name: 'Dashboard name' });
  await name.fill('Revised dashboard');
  await expect(pending(page)).toContainText('Pending: name');
  await pending(page).getByText('Review changes before saving (1)').click();
  await expect(pending(page)).toContainText('“Shared dashboard” → “Revised dashboard”');
  await expect(pending(page)).toContainText('Only Save changes commits them');
  await name.fill('Shared dashboard');
  await expect(pending(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await name.fill('Revised dashboard');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('All changes saved');
  expect(api.writes.map(item => item.expectedRevision)).toEqual([1]);
  expect(api.saved().name).toBe('Revised dashboard');
  expect(await pending(page).count()).toBe(0);
});

test('duplicate, edit, resize, reorder and remove: each local widget counted once', async ({ page }) => {
  const api = await mockApi(page);
  await edit(page);
  await page.getByRole('button', { name: 'Duplicate Revenue' }).click();
  await page.getByRole('button', { name: 'Edit Orders' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Orders updated');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  await page.getByText('Adjust size', { exact: false }).first().click();
  await page.getByRole('button', { name: 'Taller Revenue' }).click();
  await page.getByRole('button', { name: 'Move Revenue later' }).click();
  await page.getByRole('button', { name: 'Remove Sessions' }).click();
  const section = pending(page);
  await expect(section).toContainText('1 visualization added');
  await expect(section).toContainText('2 visualizations updated');
  await expect(section).toContainText('1 visualization removed');
  await expect(section).toContainText('order');
  await section.getByText(/Review changes before saving/).click();
  await expect(section.getByText('Added: Revenue (copy)')).toBeVisible();
  await expect(section.getByText('Updated: Revenue')).toBeVisible();
  await expect(section.getByText('Updated: Orders updated')).toBeVisible();
  await expect(section.getByText('Removed: Sessions')).toBeVisible();
  await expect(section).toContainText('Reusable library templates and other dashboards are unaffected');
  expect(api.writes).toHaveLength(0);
});

test('temporary duplicate and widget undo produce no pending change', async ({ page }) => {
  await mockApi(page);
  await edit(page);
  await page.getByRole('button', { name: 'Duplicate Revenue' }).click();
  await expect(pending(page)).toContainText('1 visualization added');
  await page.getByRole('button', { name: 'Remove Revenue (copy)' }).click();
  await expect(pending(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove Sessions' }).click();
  await expect(pending(page)).toContainText('1 visualization removed');
  await page.getByRole('button', { name: 'Undo widget change' }).click();
  await expect(pending(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo widget change' }).click();
  await expect(pending(page)).toContainText('Removed: Sessions');
});

test('unsupported visualization repair appears once in the pending review', async ({ page }) => {
  const broken = { ...initial, widgets: [{ ...initial.widgets[0]!, metricKey: 'unsupported' }, ...initial.widgets.slice(1)] };
  await mockApi(page, broken);
  await edit(page);
  await page.getByRole('button', { name: 'Review configuration for Revenue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await dialog.getByRole('combobox', { name: 'Metric' }).selectOption('orders');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  await expect(pending(page)).toContainText('1 visualization updated');
  await pending(page).getByText(/Review changes before saving/).click();
  await expect(pending(page)).toContainText('Repaired unavailable configuration');
  await expect(pending(page).locator('li')).toHaveCount(1);
});

test('selected conflict recovery reviews only local changes relative to the new authorized baseline', async ({ page }) => {
  const api = await mockApi(page);
  await edit(page);
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Local name');
  await page.getByRole('button', { name: 'Edit Revenue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit dashboard visualization' });
  await dialog.getByRole('textbox', { name: 'Title' }).fill('Local revenue');
  await dialog.getByRole('button', { name: 'Update visualization' }).click();
  api.otherEditor(current => ({ ...current, description: 'Saved remotely',
    widgets: current.widgets.map(item => item.title === 'Orders' ? { ...item, title: 'Remote orders' } : item) }));
  await page.getByRole('button', { name: 'Save changes' }).click();
  const conflict = page.getByRole('region', { name: 'Dashboard conflict recovery' });
  await expect(conflict).toBeVisible();
  await conflict.getByText('Review differences and choose edits to recover').click();
  await conflict.getByRole('checkbox', { name: /Dashboard name/ }).check();
  await conflict.getByRole('checkbox', { name: /Local revenue/ }).check();
  page.once('dialog', dialog => void dialog.accept());
  await conflict.getByRole('button', { name: 'Recover selected edits (2)' }).click();
  await expect(conflict).toHaveCount(0);
  await expect(pending(page)).toContainText('Pending: name · 1 visualization updated');
  await pending(page).getByText(/Review changes before saving/).click();
  await expect(pending(page)).not.toContainText('Remote orders');
  await expect(pending(page)).not.toContainText('Saved remotely');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
  expect(api.writes.map(item => item.expectedRevision)).toEqual([1, 2]);
  expect(api.saved().widgets.map(item => item.title)).toEqual(['Local revenue', 'Remote orders', 'Sessions']);
});

test('failure, successful retry and a second revision conflict never claim a draft was saved', async ({ page }) => {
  const api = await mockApi(page);
  await edit(page);
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Local name');
  api.failWrite(true);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Your unsaved work is still available');
  await expect(pending(page)).toContainText('Pending: name');
  expect(api.writes[0]?.status).toBe(503);
  api.failWrite(false);
  api.otherEditor(current => ({ ...current, description: 'Remote revision 2' }));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('region', { name: 'Dashboard conflict recovery' })).toBeVisible();
  const conflict = page.getByRole('region', { name: 'Dashboard conflict recovery' });
  await conflict.getByText('Review differences and choose edits to recover').click();
  await conflict.getByRole('checkbox', { name: /Dashboard name/ }).check();
  page.once('dialog', dialog => void dialog.accept());
  await conflict.getByRole('button', { name: 'Recover selected edits (1)' }).click();
  api.otherEditor(current => ({ ...current, description: 'Remote revision 3' }));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(conflict).toBeVisible();
  await expect(pending(page)).toContainText('Pending: name');
  expect(api.writes.map(item => item.status)).toEqual([503, 409, 409]);
  expect(api.saved().name).toBe('Shared dashboard');
});

test('Save template while dashboard has unsaved edits does not commit or alter dashboard review', async ({ page }) => {
  const api = await mockApi(page);
  await edit(page);
  await page.getByRole('textbox', { name: 'Dashboard description' }).fill('Draft only');
  await expect(pending(page)).toContainText('Pending: description');
  await page.getByRole('button', { name: 'Save Revenue to library' }).click();
  const dialog = page.getByRole('dialog', { name: 'Save to visualization library' });
  await dialog.getByRole('textbox', { name: 'Visualization name' }).fill('Reusable revenue');
  await dialog.getByRole('button', { name: 'Save to library' }).click();
  await expect(dialog).toHaveCount(0);
  expect(api.templates()).toBe(1);
  expect(api.writes).toHaveLength(0);
  await expect(pending(page)).toContainText('Pending: description');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  // The app explicitly confirms discarding the dashboard draft.
  // The click above is resolved by Playwright's dialog handler below only when prompted.
});

test('viewer is read-only; revocation during authoring fails server-side and keeps pending work', async ({ page }) => {
  const api = await mockApi(page, initial, 'viewer');
  await page.goto(`/#/organization/northstar/dashboard/${id}`);
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);
  await expect(pending(page)).toHaveCount(0);
  api.role('owner');
  await page.reload();
  await edit(page);
  await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Draft');
  api.role('viewer');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(pending(page)).toContainText('Pending: name');
  expect(api.writes.at(-1)?.status).toBe(403);
});

test('responsive, forced-colors and CSS zoom review remain navigable with no horizontal overflow', async ({ page }, info) => {
  test.setTimeout(160_000);
  await mockApi(page);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await edit(page);
    await page.getByRole('textbox', { name: 'Dashboard name' }).fill('Reviewed version');
    await page.getByRole('button', { name: 'Remove Orders' }).click();
    const section = pending(page);
    await section.getByText(/Review changes before saving/).click();
    await expect(section.getByText('Removed: Orders')).toBeVisible();
    await snapshot(page, info, `review-${width}`);
    await expect(section.locator('summary')).toBeFocusable();
  }
  await page.emulateMedia({ forcedColors: 'active' });
  const findings = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(findings.violations.map(item => item.id)).toEqual([]);
  await snapshot(page, info, 'forced-colors-320');
  await page.emulateMedia({ forcedColors: 'none' });
  await page.evaluate(() => { document.body.style.zoom = '200%'; });
  await snapshot(page, info, 'css-zoom-200-percent');
});
