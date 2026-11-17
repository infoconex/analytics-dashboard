import { describe, expect, it } from 'vitest';
import { organizationHash, parseOrganizationHash } from './organizationRoute';

describe('organization navigation', () => {
  it('keeps an explicit organization on overview, dashboards, sources and settings', () => {
    for (const page of ['overview', 'dashboards', 'sources', 'settings', 'explore'] as const) {
      expect(parseOrganizationHash(organizationHash('tenant-a', page))).toEqual({ organizationId: 'tenant-a', page });
    }
  });

  it('preserves existing dashboard deep links', () => {
    expect(parseOrganizationHash('#/organization/tenant-a/dashboard/abc-123')).toEqual({ organizationId: 'tenant-a', page: 'dashboards', id: 'abc-123' });
    expect(organizationHash('tenant-a', 'dashboards', 'abc-123')).toBe('#/organization/tenant-a/dashboard/abc-123');
  });

  it('rejects malformed or ambiguous scoped routes', () => {
    for (const hash of ['#/organization/', '#/organization/%', '#/organization/tenant-a/settings/extra', '#/organization/tenant-a/dashboard/', '#/organization/tenant-a/dashboards/%2f']) {
      expect(parseOrganizationHash(hash)).toBeNull();
    }
  });
});
