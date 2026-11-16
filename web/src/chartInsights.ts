import { formatDetailedMetric } from './demoData';

type SampleRow = Record<string, string | number>;

const metricLabels: Record<string, string> = {
  orders: 'orders', customers: 'customers', sessions: 'sessions', conversion: 'conversion rate',
};

// An interpretive summary, never a replacement for the exact row/column data.
// Use the same filtered observations supplied to the corresponding chart and table.
export function chartInsight(dimension: string, metric: string, rows: SampleRow[]): string | null {
  const first = rows[0];
  if (!first || rows.some(row => typeof row[metric] !== 'number'
    || !Number.isFinite(row[metric]) || typeof row[dimension] !== 'string')) return null;

  const value = (row: SampleRow) => formatDetailedMetric(Number(row[metric]), metric);
  const namedValue = (row: SampleRow) => metricLabels[metric]
    ? `${value(row)} ${metricLabels[metric]}`
    : value(row);

  if (dimension === 'channel') {
    if (rows.length === 1) return `Showing ${first.channel}: ${namedValue(first)} (1 channel).`;
    const highest = rows.reduce((best, row) => Number(row[metric]) > Number(best[metric]) ? row : best);
    return `Highest: ${highest.channel}, ${namedValue(highest)} across ${rows.length} channels.`;
  }

  const last = rows.at(-1) ?? first;
  if (rows.length === 1) return `${first[dimension]}: ${namedValue(first)} (1 ${dimension}).`;
  const direction = Number(last[metric]) > Number(first[metric]) ? 'increased'
    : Number(last[metric]) < Number(first[metric]) ? 'decreased' : 'unchanged';
  return `From ${first[dimension]} (${value(first)}) to ${last[dimension]} (${value(last)}): ${direction} across ${rows.length} ${dimension}s.`;
}
