import { channels } from './demoData';
import { defaultConsumerFilters, type ConsumerFilters, type ConsumerPeriod } from './consumerFilters';

export interface EmbedTarget {
  organizationId: string;
  dashboardId: string;
  filters: ConsumerFilters;
}

const organizationPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const dashboardPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const periods: ReadonlySet<string> = new Set(['3m', '6m', '12m']);
const channelNames: ReadonlySet<string> = new Set(channels.map(row => row.channel));

// A URL only locates a resource and optional non-sensitive *sample view filters*.
// Identity, privileges and membership always come from authenticated API requests.
export function parseEmbedTarget(hash: string): EmbedTarget | null {
  const parts = hash.match(/^#\/organization\/([^/?#]+)\/dashboard\/([^/?#]+)(?:\?([^#]+))?$/);
  if (!parts) return null;
  try {
    const organizationId = decodeURIComponent(parts[1]!);
    const dashboardId = decodeURIComponent(parts[2]!);
    if (!organizationPattern.test(organizationId) || !dashboardPattern.test(dashboardId)) return null;
    const filters = { ...defaultConsumerFilters };
    if (parts[3]) {
      const params = new URLSearchParams(parts[3]);
      const keys = [...params.keys()];
      if (keys.length === 0 || keys.some(key => !['period', 'channel'].includes(key))
          || new Set(keys).size !== keys.length) return null;
      const period = params.get('period');
      const channel = params.get('channel');
      if (period !== null) {
        if (!periods.has(period)) return null;
        filters.period = period as ConsumerPeriod;
      }
      if (channel !== null) {
        if (!channelNames.has(channel)) return null;
        filters.channel = channel;
      }
    }
    return { organizationId, dashboardId, filters };
  } catch {
    return null;
  }
}

export function formatEmbedTarget(target: EmbedTarget): string {
  const hash = `#/organization/${encodeURIComponent(target.organizationId)}/dashboard/${encodeURIComponent(target.dashboardId)}`;
  const params = new URLSearchParams();
  if (target.filters.period !== defaultConsumerFilters.period) params.set('period', target.filters.period);
  if (target.filters.channel) params.set('channel', target.filters.channel);
  return params.size ? `${hash}?${params.toString()}` : hash;
}
