import type { Dashboard, DashboardDraft, DashboardWidget } from './model';

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
      item.datasetKey !== original.datasetKey || item.metricKey !== original.metricKey || item.dimensionKey !== original.dimensionKey;
  });
}
