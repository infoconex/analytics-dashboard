export type OrganizationPage = 'overview' | 'explore' | 'dashboards' | 'sources' | 'settings';

export type OrganizationRoute = { organizationId: string; page: OrganizationPage; id?: string };

const pages: readonly string[] = ['overview', 'explore', 'dashboards', 'sources', 'settings'];

function validSegment(segment: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(segment);
}

export function parseOrganizationHash(hash: string): OrganizationRoute | null {
  const segments = hash.replace(/^#\//, '').split('/');
  if (segments[0] !== 'organization' || !validSegment(segments[1] ?? '')) return null;
  const organizationId = segments[1]!;
  if (segments.length === 2) return { organizationId, page: 'overview' };
  if (segments.length === 3 && pages.includes(segments[2]!)) return { organizationId, page: segments[2] as OrganizationPage };
  if (segments.length === 4 && segments[2] === 'dashboard' && validSegment(segments[3] ?? '')) {
    return { organizationId, page: 'dashboards', id: segments[3] };
  }
  return null;
}

export function organizationHash(organizationId: string, page: OrganizationPage, dashboardId?: string): string {
  if (!validSegment(organizationId) || (dashboardId !== undefined && !validSegment(dashboardId))) throw new Error('Invalid organization navigation target');
  return dashboardId ? `#/organization/${organizationId}/dashboard/${dashboardId}` : `#/organization/${organizationId}/${page}`;
}
