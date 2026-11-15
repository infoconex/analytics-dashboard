import type { DashboardWidget, DatasetKey, WidgetKind } from './model';

export const commerce = [
  { month: 'Jan', revenue: 18400, orders: 412, customers: 280 },
  { month: 'Feb', revenue: 21800, orders: 486, customers: 317 },
  { month: 'Mar', revenue: 19600, orders: 465, customers: 295 },
  { month: 'Apr', revenue: 27400, orders: 592, customers: 380 },
  { month: 'May', revenue: 25800, orders: 549, customers: 349 },
  { month: 'Jun', revenue: 32200, orders: 674, customers: 419 },
  { month: 'Jul', revenue: 30100, orders: 635, customers: 398 },
  { month: 'Aug', revenue: 36800, orders: 740, customers: 464 },
  { month: 'Sep', revenue: 34900, orders: 715, customers: 453 },
  { month: 'Oct', revenue: 41400, orders: 862, customers: 531 },
  { month: 'Nov', revenue: 38600, orders: 801, customers: 512 },
  { month: 'Dec', revenue: 48300, orders: 960, customers: 596 },
];

export const channels = [
  { channel: 'Organic search', orders: 1820, sessions: 8140, conversion: 4.8 },
  { channel: 'Direct', orders: 1530, sessions: 6250, conversion: 5.4 },
  { channel: 'Paid search', orders: 1120, sessions: 5340, conversion: 3.6 },
  { channel: 'Social', orders: 890, sessions: 4190, conversion: 3.2 },
  { channel: 'Referral', orders: 615, sessions: 2820, conversion: 4.3 },
];

export const datasets: Record<DatasetKey, Record<string, string | number>[]> = {
  commerce,
  channels,
};

export const datasetOptions: { key: DatasetKey; label: string }[] = [
  { key: 'commerce', label: 'Commerce performance' },
  { key: 'channels', label: 'Marketing channels' },
];

export const metrics: Record<DatasetKey, { key: string; label: string }[]> = {
  commerce: [
    { key: 'revenue', label: 'Revenue' },
    { key: 'orders', label: 'Orders' },
    { key: 'customers', label: 'Customers' },
  ],
  channels: [
    { key: 'orders', label: 'Orders' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'conversion', label: 'Conversion rate' },
  ],
};

export const dimensions: Record<DatasetKey, string> = {
  commerce: 'month',
  channels: 'channel',
};

export const visualizations: { key: WidgetKind; label: string }[] = [
  { key: 'metric', label: 'Metric' },
  { key: 'area', label: 'Area chart' },
  { key: 'line', label: 'Line chart' },
  { key: 'bar', label: 'Bar chart' },
  { key: 'donut', label: 'Donut chart' },
  { key: 'table', label: 'Data table' },
];

export function createWidget(kind: WidgetKind = 'area'): DashboardWidget {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled visualization',
    kind,
    datasetKey: 'commerce',
    metricKey: 'revenue',
    dimensionKey: 'month',
  };
}

export function formatMetric(value: number, metric: string): string {
  if (metric === 'revenue') return `$${Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
  if (metric === 'conversion') return `${value.toFixed(1)}%`;
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function selectRows(datasetKey: DatasetKey, period: string): Record<string, string | number>[] {
  const values = datasets[datasetKey];
  if (datasetKey === 'channels') return values;
  return period === '3m' ? values.slice(-3) : period === '6m' ? values.slice(-6) : values;
}
