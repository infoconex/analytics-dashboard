import { titles } from '../ux13/kibana-dashboard.mjs';

// Same customer-task shape as web/e2e/customerTasks.spec.ts, but with an
// independent browser context for each UX-14 condition. No API writes.
export const dashboardId = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
export const fixtureDashboard = Object.freeze({
  id: dashboardId, organizationId: 'northstar', name: 'Business performance', description: 'Fictional business insights',
  revision: 1, createdBy: 'sample', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  widgets: titles.map((title, index) => ({
    id: `996e3063-18e9-4ddb-887a-229198c6dd${String(index + 1).padStart(2, '0')}`,
    title, kind: index === 1 ? 'bar' : 'area', datasetKey: index === 1 ? 'channels' : 'commerce',
    metricKey: index === 1 ? 'orders' : 'revenue', dimensionKey: index === 1 ? 'channel' : 'month',
  })),
});

export async function restrictAnalytics(context, origin) {
  const attempts = [];
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(`${origin}/`)) {
      attempts.push({ type: 'external-network-blocked' });
      return route.abort();
    }
    const path = new URL(url).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const method = route.request().method();
    if (method !== 'GET') {
      attempts.push({ type: 'write-refused', method, path });
      return route.fulfill({ status: 405, body: 'No fixture writes' });
    }
    if (path === '/api/identity') return route.fulfill({ json: { userId: 'sample', displayName: 'Sample Viewer' } });
    if (path === '/api/organizations') return route.fulfill({ json: [
      { id: 'northstar', name: 'Northstar Commerce', role: 'viewer' },
      { id: 'isolated', name: 'Isolated Tenant', role: 'viewer' },
    ] });
    if (path === '/api/organizations/northstar/dashboards') return route.fulfill({ json: [fixtureDashboard] });
    if (path === `/api/organizations/northstar/dashboards/${dashboardId}`)
      return route.fulfill({ json: fixtureDashboard });
    return route.fulfill({ status: 403, body: 'Not available in fictional fixture' });
  });
  return attempts;
}

// An isolated page may attempt to load an external image or other resource.
// Refusing that request protects the lab, but is not itself an API write.
export function assertNoApiWrites(attempts) {
  const writes = attempts.filter(attempt => attempt.type === 'write-refused');
  if (writes.length) throw new Error(`Unexpected synthetic API write attempts: ${writes.map(item => `${item.method} ${item.path}`).join(', ')}`);
}
