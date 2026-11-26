import { afterEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi, dataSourceApi } from './api';
import type { Dashboard, DashboardDraft } from './model';

afterEach(() => vi.unstubAllGlobals());

describe('dashboard API client', () => {
  it('encodes organization identifiers as one URL segment', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal('fetch', fetch);

    await dashboardApi.list('tenant/other');

    expect(fetch).toHaveBeenCalledWith('/api/organizations/tenant%2Fother/dashboards', expect.any(Object));
  });

  it('sends the observed dashboard revision with an update and reports stale writes as a conflict', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    vi.stubGlobal('fetch', fetch);
    const dashboard: Dashboard = {
      id: 'dashboard-1', organizationId: 'northstar', revision: 7,
      name: 'Original', description: '', widgets: [], createdBy: 'owner', createdAt: '', updatedAt: '',
    };
    const draft: DashboardDraft = { name: 'Local draft', description: '', widgets: [] };

    await expect(dashboardApi.update('northstar', dashboard, draft)).rejects.toMatchObject({
      status: 409, message: 'This resource changed in another session. Reload before editing.',
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/organizations/northstar/dashboards/dashboard-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ ...draft, expectedRevision: 7 }),
        headers: { 'Content-Type': 'application/json' },
      }));
  });
});

describe('data-source API client', () => {
  it('encodes the organization and sends only provider/name on registration', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
    vi.stubGlobal('fetch', fetch);

    await dataSourceApi.create('tenant/other', { name: 'Reporting', provider: 'postgreSql' });

    expect(fetch).toHaveBeenCalledWith('/api/organizations/tenant%2Fother/data-sources',
      expect.objectContaining({ method: 'POST', body: '{"name":"Reporting","provider":"postgreSql"}' }));
  });

  it('supplies the previously observed revision for rename and removal', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetch);
    const definition = { id: 'source-1', organizationId: 'northstar', name: 'Old', provider: 'sqlite' as const,
      revision: 7, createdBy: 'owner', createdAt: '', updatedAt: '' };

    await dataSourceApi.update('northstar', definition, 'New');
    await dataSourceApi.remove('northstar', definition);

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/organizations/northstar/data-sources/source-1',
      expect.objectContaining({ method: 'PUT', body: '{"name":"New","expectedRevision":7}' }));
    expect(fetch).toHaveBeenNthCalledWith(2,
      '/api/organizations/northstar/data-sources/source-1?expectedRevision=7',
      expect.objectContaining({ method: 'DELETE' }));
  });
});
