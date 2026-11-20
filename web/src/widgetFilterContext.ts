import type { ConsumerFilters, ConsumerPeriod } from './consumerFilters';
import type { DatasetKey } from './model';

type AppliedFilter = { kind: 'channel' | 'period'; label: string };

const periodLabels: Record<ConsumerPeriod, string> = {
  '12m': 'All 12 sample months',
  '6m': 'Final 6 sample months',
  '3m': 'Final 3 sample months',
};

/** Describes scope; never invents a relationship between independent samples. */
export function describeWidgetFilters(dataset: DatasetKey, filters: ConsumerFilters): {
  applied: AppliedFilter | null;
  unaffected: string | null;
} {
  if (dataset === 'channels') return {
    applied: filters.channel ? { kind: 'channel', label: filters.channel } : null,
    unaffected: filters.period !== '12m'
      ? 'Date range does not apply; marketing channel records have no dates.' : null,
  };
  return {
    applied: filters.period !== '12m' ? { kind: 'period', label: periodLabels[filters.period] } : null,
    unaffected: filters.channel
      ? `${filters.channel} does not apply; commerce records have no channel attribution.` : null,
  };
}
