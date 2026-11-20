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

/** Identify both the selected slice and its measure, never just the measure. */
export function categoryTooltipLabel(category: string, measure: string): string {
  return `${category} · ${measure}`;
}

/** Limit outside labels without changing the chronological/category slice order. */
export function selectedPieLabels(rows: Record<string, string | number>[], dimension: string, measure: string, maxLabels = 5): ReadonlySet<string> {
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row[measure]) || 0), 0);
  if (total <= 0) return new Set();
  return new Set(rows.map((row, index) => ({
    name: String(row[dimension]), value: Math.max(0, Number(row[measure]) || 0), index,
  })).filter(row => row.value / total >= 0.07)
    .sort((left, right) => right.value - left.value || left.index - right.index)
    .slice(0, Math.max(0, maxLabels)).map(row => row.name));
}

export function formatChartAxis(value: number, metric: string): string {
  if (!Number.isFinite(value)) return '—';
  if (metric === 'conversion') return `${value.toFixed(1)}%`;
  const compact = Intl.NumberFormat('en-US', {
    notation: 'compact', maximumFractionDigits: metric === 'revenue' ? 2 : 1,
  }).format(value);
  return metric === 'revenue' ? `$${compact}` : compact;
}
