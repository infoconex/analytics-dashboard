export interface EmbedTarget {
  organizationId: string;
  dashboardId: string;
}

const organizationPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const dashboardPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

// A URL is only a resource locator. Never derive identity, role, authentication
// or permissions from the hash; the API makes those decisions on every GET.
export function parseEmbedTarget(hash: string): EmbedTarget | null {
  const parts = hash.match(/^#\/organization\/([^/?#]+)\/dashboard\/([^/?#]+)$/);
  if (!parts) return null;
  try {
    const organizationId = decodeURIComponent(parts[1]!);
    const dashboardId = decodeURIComponent(parts[2]!);
    return organizationPattern.test(organizationId) && dashboardPattern.test(dashboardId)
      ? { organizationId, dashboardId }
      : null;
  } catch {
    return null;
  }
}
