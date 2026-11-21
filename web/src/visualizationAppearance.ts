import type { DashboardWidget, DatasetKey, VisualizationAppearance, WidgetKind } from './model';

const circularKinds: WidgetKind[] = ['pie', 'donut'];
const orderedKinds: WidgetKind[] = ['bar', 'pie', 'donut'];

export function chartAppearance(widget: DashboardWidget) {
  return {
    showLegend: widget.appearance?.showLegend ?? true,
    showSliceLabels: widget.appearance?.showSliceLabels ?? false,
    maxSliceLabels: widget.appearance?.maxSliceLabels ?? 5,
    histogramBins: widget.appearance?.histogramBins ?? 4,
    categorySort: widget.appearance?.categorySort ?? 'source',
  } as const;
}

/** Strip options that would no longer apply when changing kind or dataset. */
export function compatibleAppearance(
  current: VisualizationAppearance | null | undefined, kind: WidgetKind, dataset: DatasetKey,
): VisualizationAppearance | undefined {
  if (!current) return undefined;
  const next: VisualizationAppearance = {};
  if (circularKinds.includes(kind)) {
    if (current.showLegend !== undefined) next.showLegend = current.showLegend;
    if (current.showSliceLabels !== undefined) next.showSliceLabels = current.showSliceLabels;
    if (current.maxSliceLabels !== undefined) next.maxSliceLabels = current.maxSliceLabels;
  }
  if (kind === 'histogram' && current.histogramBins !== undefined) next.histogramBins = current.histogramBins;
  if (dataset === 'channels' && orderedKinds.includes(kind) && current.categorySort !== undefined)
    next.categorySort = current.categorySort;
  return Object.keys(next).length ? next : undefined;
}

export function withAppearance(widget: DashboardWidget, update: VisualizationAppearance): DashboardWidget {
  return { ...widget, appearance: compatibleAppearance({ ...widget.appearance, ...update }, widget.kind, widget.datasetKey) };
}

type Row = Record<string, string | number>;

/** Stable ordering of existing category rows; neither source nor measure is transformed. */
export function chartCategoryRows(rows: readonly Row[], widget: DashboardWidget): Row[] {
  const result = [...rows];
  if (widget.datasetKey !== 'channels' || !orderedKinds.includes(widget.kind)) return result;
  const order = chartAppearance(widget).categorySort;
  if (order === 'source') return result;
  return result.sort((a, b) => {
    const diff = Number(a[widget.metricKey]) - Number(b[widget.metricKey]);
    return order === 'valueAsc' ? diff : -diff;
  });
}
