import { selectRows } from './demoData';
import type { DashboardWidget, DatasetKey } from './model';

export type ConsumerPeriod = '3m' | '6m' | '12m';

export interface ConsumerFilters {
  period: ConsumerPeriod;
  channel: string | null;
}

export const defaultConsumerFilters: Readonly<ConsumerFilters> = { period: '12m', channel: null };

export const consumerPeriodLabels: Readonly<Record<ConsumerPeriod, string>> = {
  '3m': 'Final 3 sample months',
  '6m': 'Final 6 sample months',
  '12m': 'All 12 sample months',
};

/** Counts only supported, independent sample sources; never infers relationships. */
export function summarizeFilterImpact(widgets: readonly Pick<DashboardWidget, 'datasetKey'>[]) {
  const commerce = widgets.filter(widget => widget.datasetKey === 'commerce').length;
  const channels = widgets.filter(widget => widget.datasetKey === 'channels').length;
  return { commerce, channels, other: widgets.length - commerce - channels };
}

// Client-only samples: no query plans, tenant IDs or API calls are involved.
// The two sample datasets have independent dimensions; they are never joined.
export function selectConsumerRows(datasetKey: DatasetKey, filters: ConsumerFilters): Record<string, string | number>[] {
  const rows = selectRows(datasetKey, filters.period);
  return datasetKey === 'channels' && filters.channel
    ? rows.filter(row => row.channel === filters.channel)
    : rows;
}

export function toggleChannel(current: string | null, selected: string): string | null {
  return current === selected ? null : selected;
}
