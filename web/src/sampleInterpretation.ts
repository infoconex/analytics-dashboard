import { selectRows } from './demoData';
import type { ConsumerFilters } from './consumerFilters';
import type { DatasetKey } from './model';

type SampleRow = Record<string, string | number>;
type Definition = Readonly<{
  label: string;
  unit: string;
  meaning: string;
  limitation: string;
  additive: boolean;
}>;

const definitions: Record<DatasetKey, Record<string, Definition>> = {
  fictionalQuery: {}, // Never interpret a raw-record query as an aggregated sample.
  commerce: {
    revenue: {
      label: 'Revenue', unit: 'USD', additive: true,
      meaning: 'Sum of illustrative monthly sales amounts, expressed in US dollars.',
      limitation: 'No accounting method, currency conversion, year or comparison period is specified.',
    },
    orders: {
      label: 'Orders', unit: 'orders', additive: true,
      meaning: 'Illustrative number of orders recorded for each sample month.',
      limitation: 'No comparison year, fulfillment status or underlying orders are available.',
    },
    customers: {
      label: 'Customer observations', unit: 'customer-month observations', additive: true,
      meaning: 'Illustrative monthly customer counts, counted once per month in this sample.',
      limitation: 'Summing months does not establish a count of distinct customers; no customer identities are available.',
    },
  },
  channels: {
    orders: {
      label: 'Orders', unit: 'orders', additive: true,
      meaning: 'Illustrative order counts attributed to individual marketing channels.',
      limitation: 'Attribution method and reporting date are unspecified; do not compare this with the monthly commerce totals.',
    },
    sessions: {
      label: 'Sessions', unit: 'sessions', additive: true,
      meaning: 'Illustrative visit sessions attributed to individual marketing channels.',
      limitation: 'Session definition, attribution method and reporting date are unspecified.',
    },
    conversion: {
      label: 'Conversion rate', unit: '%', additive: false,
      meaning: 'An illustrative conversion percentage assigned to each marketing channel.',
      limitation: 'These fictional rates are not derived from the displayed orders and sessions. Adding or averaging rates cannot establish a combined rate.',
    },
  },
};

export interface SampleMetricContext extends Definition {
  coverage: string;
  filterScope: string;
  provenance: string;
  recordCount: number;
}

export function sampleMetricContext(datasetKey: DatasetKey, metricKey: string, dimensionKey: string,
  rows: SampleRow[], filters?: ConsumerFilters): SampleMetricContext | null {
  const definition = definitions[datasetKey]?.[metricKey];
  const dimension = datasetKey === 'commerce' ? 'month' : datasetKey === 'channels' ? 'channel' : null;
  if (!definition || dimension !== dimensionKey || rows.length === 0 || rows.some(row =>
    typeof row[dimensionKey] !== 'string' || typeof row[metricKey] !== 'number'
    || !Number.isFinite(row[metricKey]) || Number(row[metricKey]) < 0)) return null;

  const first = String(rows[0]![dimensionKey]);
  const last = String(rows[rows.length - 1]![dimensionKey]);
  const coverage = datasetKey === 'commerce'
    ? `${first}–${last} (${rows.length} fictional sample ${rows.length === 1 ? 'month' : 'months'}; year unspecified)`
    : rows.length === 1
      ? `${first} (1 of 5 fictional channels; no dates)`
      : `${rows.length} fictional channels; no dates`;

  return {
    ...definition, coverage, recordCount: rows.length,
    provenance: 'Built-in deterministic fictional sample records; no customer data, live connection or refresh timestamp.',
    filterScope: datasetKey === 'commerce'
      ? `Sample month selection: ${filters?.period ?? '12m'}; channel filter does not apply to commerce.`
      : `Channel selection: ${filters?.channel ?? 'all channels'}; date range does not apply to channels.`,
  };
}

export function aggregateSampleMetric(datasetKey: DatasetKey, metricKey: string, rows: SampleRow[]): number | null {
  const definition = definitions[datasetKey]?.[metricKey];
  if (!definition?.additive || rows.length === 0 || rows.some(row =>
    typeof row[metricKey] !== 'number' || !Number.isFinite(row[metricKey]) || Number(row[metricKey]) < 0)) return null;
  return rows.reduce((sum, row) => sum + Number(row[metricKey]), 0);
}

export interface OverviewMetric {
  id: string;
  label: string;
  value: number;
  context: SampleMetricContext;
}

export function sampleOverview(period: string): OverviewMetric[] {
  const selected: Array<{ dataset: DatasetKey; metric: string; dimension: string }> = [
    { dataset: 'commerce', metric: 'revenue', dimension: 'month' },
    { dataset: 'commerce', metric: 'orders', dimension: 'month' },
    { dataset: 'commerce', metric: 'customers', dimension: 'month' },
    { dataset: 'channels', metric: 'sessions', dimension: 'channel' },
  ];
  return selected.flatMap(({ dataset, metric, dimension }) => {
    const rows = selectRows(dataset, period);
    const context = sampleMetricContext(dataset, metric, dimension, rows);
    const value = aggregateSampleMetric(dataset, metric, rows);
    return context && value !== null ? [{ id: `${dataset}-${metric}`, label: context.label, value, context }] : [];
  });
}
