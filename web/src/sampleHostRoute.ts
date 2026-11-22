export type HostView = { page: 'account' } | { page: 'insights'; dashboardId: string | null };
export const sampleOrganization = 'northstar';
export const sampleDashboard = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';
const dashboardPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

// Host state is intentionally separate from the NEXA iframe's resource locator.
export function parseHostView(hash: string): HostView | null {
  if (!hash || hash === '#analytics-section') return { page: 'insights', dashboardId: null };
  if (hash === '#account-summary') return { page: 'account' };
  const parts = /^#insights\/([^/?#]+)$/.exec(hash);
  if (!parts) return null;
  try {
    const dashboardId = decodeURIComponent(parts[1]!);
    return dashboardPattern.test(dashboardId) ? { page: 'insights', dashboardId } : null;
  } catch {
    return null;
  }
}

export function isHostDashboard(value: unknown): value is { id: string; name: string; organizationId: string } {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && dashboardPattern.test(item.id) &&
    item.organizationId === sampleOrganization && typeof item.name === 'string' && item.name.trim().length > 0;
}
