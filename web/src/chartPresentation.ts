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
  // Keep small slices unlabelled at the default, but permit more categories on request.
  // The count remains a ceiling, not a promise to fit labels in every viewport.
  const minimumShare = maxLabels <= 5 ? 0.07 : maxLabels <= 8 ? 0.04 : 0.025;
  return new Set(rows.map((row, index) => ({
    name: String(row[dimension]), value: Math.max(0, Number(row[measure]) || 0), index,
  })).filter(row => row.value / total >= minimumShare)
    .sort((left, right) => right.value - left.value || left.index - right.index)
    .slice(0, Math.max(0, maxLabels)).map(row => row.name));
}


/**
 * Outside pie/donut labels are supplementary: never clip or overlap them to
 * satisfy a label-count preference. Legends and exact data tables retain every
 * category at every viewport width, including when this returns fewer labels.
 *
 * Approximate the *maximum* label footprint conservatively (11px SVG font).
 * Use measured chart dimensions rather than the browser viewport so a small
 * widget on a wide dashboard gets the same protection as a phone.
 */
export function fitOutsidePieLabels(
  selected: ReadonlySet<string>,
  rows: ReadonlyArray<Record<string, string | number>>,
  dimension: string,
  measure: string,
  width: number,
  height: number,
): ReadonlySet<string> {
  if (!selected.size || width < 480 || height < 210) return new Set();
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row[measure]) || 0), 0);
  if (!total) return new Set();
  const radius = Math.min(width, height) * 0.42;
  const horizontalRoom = width / 2 - radius - 32;
  const used: { side: number; y: number }[] = [];
  const positions = new Map<string, { side: number; y: number }>();
  let angle = 90;
  for (const row of rows) {
    const share = Math.max(0, Number(row[measure]) || 0) / total;
    const middle = (angle - share * 180) * Math.PI / 180;
    positions.set(String(row[dimension]), {
      side: Math.cos(middle) >= 0 ? 1 : -1,
      y: height / 2 - Math.sin(middle) * (radius + 13),
    });
    angle -= share * 360;
  }
  const fitted = new Set<string>();
  // Selection already prioritizes large slices. Preserve that priority while
  // avoiding near-identical Y positions on the same side of the chart.
  for (const category of selected) {
    const position = positions.get(category);
    if (!position || [...category].length * 8 > horizontalRoom ||
      position.y < 15 || position.y > height - 15 ||
      used.some(prior => prior.side === position.side && Math.abs(prior.y - position.y) < 20)) continue;
    used.push(position);
    fitted.add(category);
  }
  return fitted;
}

export function formatChartAxis(value: number, metric: string): string {
  if (!Number.isFinite(value)) return '—';
  if (metric === 'conversion') return `${value.toFixed(1)}%`;
  const compact = Intl.NumberFormat('en-US', {
    notation: 'compact', maximumFractionDigits: metric === 'revenue' ? 2 : 1,
  }).format(value);
  return metric === 'revenue' ? `$${compact}` : compact;
}
