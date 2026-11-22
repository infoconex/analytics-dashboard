import { consumerPeriodLabels } from './consumerFilters';
import type { ConsumerFilters } from './consumerFilters';
import type { DatasetKey } from './model';

type AppliedFilter = { kind: 'channel' | 'period'; label: string };

/** Describes only filters supported by the independent fictional dataset. */
export function describeWidgetFilters(dataset: DatasetKey, filters: ConsumerFilters): {
  applied: AppliedFilter | null;
  unaffected: string | null;
} {
  const dateActive = filters.period !== '12m';
  if (dataset === 'channels') return {
    applied: filters.channel ? { kind: 'channel', label: filters.channel } : null,
    unaffected: dateActive
      ? 'Reporting period does not apply; marketing channel records have no dates.' : null,
  };
  if (dataset === 'commerce') return {
    applied: dateActive ? { kind: 'period', label: consumerPeriodLabels[filters.period] } : null,
    unaffected: filters.channel
      ? `${filters.channel} does not apply; commerce records have no channel attribution.` : null,
  };
  // Future datasets must opt into filter semantics explicitly.
  return { applied: null, unaffected: null };
}
