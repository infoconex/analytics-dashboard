import { selectRows } from './demoData';
import type { DatasetKey } from './model';

export type ConsumerPeriod = '3m' | '6m' | '12m';

export interface ConsumerFilters {
  period: ConsumerPeriod;
  channel: string | null;
}

export const defaultConsumerFilters: Readonly<ConsumerFilters> = { period: '12m', channel: null };

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
