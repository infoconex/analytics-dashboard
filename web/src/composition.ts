import type { Dashboard, DashboardDraft, DashboardWidget } from './model';

export interface WidgetLayout { columns: 3 | 6 | 9 | 12; height: number }

export function layoutForWidget(widget: DashboardWidget): WidgetLayout {
  const defaultColumns = widget.kind === 'metric' ? 3 : widget.kind === 'table' ? 12 : 6;
  const defaultHeight = widget.kind === 'metric' ? 220 : 340;
  const allowedColumns = widget.kind === 'metric' ? [3, 6, 9, 12] : [6, 9, 12];
  const minimumHeight = widget.kind === 'metric' || widget.kind === 'table' ? 220 : 320;
  const columns = allowedColumns.includes(widget.columns ?? -1) ? widget.columns! : defaultColumns;
  const height = widget.height && widget.height >= minimumHeight && widget.height <= 640 ? widget.height : defaultHeight;
  return { columns: columns as WidgetLayout['columns'], height };
}

export function resizeWidget(widgets: DashboardWidget[], id: string, columns: number, height: number): DashboardWidget[] {
  const index = widgets.findIndex(widget => widget.id === id);
  if (index < 0) return widgets;
  const original = widgets[index]!;
  const current = layoutForWidget(original);
  const allowedColumns = original.kind === 'metric' ? [3, 6, 9, 12] : [6, 9, 12];
  const targetColumns = allowedColumns.reduce((best, choice) =>
    Math.abs(choice - columns) < Math.abs(best - columns) ? choice : best, allowedColumns[0]!) as WidgetLayout['columns'];
  const minimumHeight = original.kind === 'metric' || original.kind === 'table' ? 220 : 320;
  const targetHeight = Math.max(minimumHeight, Math.min(640, 220 + Math.round((height - 220) / 20) * 20));
  if (current.columns === targetColumns && current.height === targetHeight) return widgets;
  return widgets.map(widget => widget.id === id ? { ...widget, columns: targetColumns, height: targetHeight } : widget);
}


/** Position-based ordering is the persisted layout contract for UX-2. */
export function reorderWidgets(widgets: DashboardWidget[], sourceId: string, targetId: string): DashboardWidget[] {
  const source = widgets.findIndex(item => item.id === sourceId);
  const target = widgets.findIndex(item => item.id === targetId);
  if (source < 0 || target < 0 || source === target) return widgets;
  const sourceWidget = widgets[source];
  if (!sourceWidget) return widgets;
  const ordered = [...widgets];
  ordered.splice(source, 1);
  ordered.splice(target, 0, sourceWidget);
  return ordered;
}

export function moveWidget(widgets: DashboardWidget[], id: string, direction: -1 | 1): DashboardWidget[] {
  const current = widgets.findIndex(item => item.id === id);
  const target = current + direction;
  if (current < 0 || target < 0 || target >= widgets.length) return widgets;
  const destination = widgets[target];
  return destination ? reorderWidgets(widgets, id, destination.id) : widgets;
}

export function hasDashboardChanges(draft: DashboardDraft, saved: Dashboard): boolean {
  if (draft.name !== saved.name || draft.description !== saved.description || draft.widgets.length !== saved.widgets.length) return true;
  return draft.widgets.some((item, index) => {
    const original = saved.widgets[index];
    if (!original) return true;
    return item.id !== original.id || item.title !== original.title || item.kind !== original.kind ||
      item.datasetKey !== original.datasetKey || item.metricKey !== original.metricKey || item.dimensionKey !== original.dimensionKey ||
      (item.columns ?? null) !== (original.columns ?? null) || (item.height ?? null) !== (original.height ?? null);
  });
}
