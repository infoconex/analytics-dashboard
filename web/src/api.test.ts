import { afterEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi } from './api';

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
