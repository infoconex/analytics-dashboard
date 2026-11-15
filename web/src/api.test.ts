import { afterEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi, dataSourceApi } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('dashboard API client', () => {
  it('encodes organization identifiers as one URL segment', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal('fetch', fetch);

    await dashboardApi.list('tenant/other');

    expect(fetch).toHaveBeenCalledWith('/api/organizations/tenant%2Fother/dashboards', expect.any(Object));
  });

  it('reports stale writes as a conflict', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }));

    await expect(dashboardApi.list('northstar')).rejects.toMatchObject({ status: 409 });
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
