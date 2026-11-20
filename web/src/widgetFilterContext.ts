import type { ConsumerFilters } from './consumerFilters';
import type { DatasetKey } from './model';

type AppliedFilter = { kind: 'channel'; label: string };

/** Describes scope; never invents a relationship between independent samples. */
export function describeWidgetFilters(dataset: DatasetKey, filters: ConsumerFilters): {
  applied: AppliedFilter | null;
  unaffected: string | null;
} {
  if (dataset === 'channels') return {
    applied: filters.channel ? { kind: 'channel', label: filters.channel } : null,
    unaffected: null,
  };
  return {
    applied: null,
    unaffected: filters.channel
      ? `${filters.channel} does not apply; commerce records have no channel attribution.` : null,
  };
}
