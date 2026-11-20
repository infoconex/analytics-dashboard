import { formatDetailedMetric } from './demoData';
import type { DatasetKey } from './model';

// Identity-based mapping: filtering must never change the meaning of a color.
const palette = ['#435bc9', '#087b75', '#99620a', '#714eaf', '#b03057'];
const monthPalette = [...palette, '#0a8587', '#3d60bd', '#a36b0e', '#7b4bb6', '#bd335b', '#4565d3', '#0a7a82'];
const channels = ['Organic search', 'Direct', 'Paid search', 'Social', 'Referral'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function colorForCategory(dataset: DatasetKey, category: string): string {
  const categories = dataset === 'channels' ? channels : months;
  const colors = dataset === 'channels' ? palette : monthPalette;
  const index = categories.indexOf(category);
  return index < 0 ? '#566780' : colors[index]!;
}

export function formatChartTooltip(value: number, metric: string): string {
  return formatDetailedMetric(value, metric);
}

export function formatChartAxis(value: number, metric: string): string {
  if (!Number.isFinite(value)) return '—';
  if (metric === 'conversion') return `${value.toFixed(1)}%`;
  const compact = Intl.NumberFormat('en-US', {
    notation: 'compact', maximumFractionDigits: metric === 'revenue' ? 2 : 1,
  }).format(value);
  return metric === 'revenue' ? `$${compact}` : compact;
}
