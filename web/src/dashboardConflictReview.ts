import type { Dashboard, DashboardDraft, DashboardWidget } from './model';

/**
 * UX-38 compares independent saved dashboard snapshots. A widget ID identifies
 * a dashboard-local copy, never a mutable link to a library visualization.
 * "Compatible" means the latest saved revision did not change the same unit.
 * Reordering is deliberately excluded from automated reapplication.
 */
export type ConflictChangeKind = 'name' | 'description' | 'widget-add' | 'widget-remove' | 'widget-edit' | 'order';
export type ConflictChangeStatus = 'compatible' | 'overlapping' | 'remote' | 'already-saved' | 'manual';

export interface ConflictChange {
  key: string;
  label: string;
  kind: ConflictChangeKind;
  status: ConflictChangeStatus;
  detail: string;
}

export interface DashboardConflictReview {
  changes: ConflictChange[];
  compatible: ConflictChange[];
  overlapping: ConflictChange[];
  remote: ConflictChange[];
  manual: ConflictChange[];
  alreadySaved: ConflictChange[];
}

const snapshotWidget = (widget: DashboardWidget) => ({
  id: widget.id, title: widget.title, kind: widget.kind,
  datasetKey: widget.datasetKey, metricKey: widget.metricKey, dimensionKey: widget.dimensionKey,
  columns: widget.columns ?? null, height: widget.height ?? null,
  appearance: {
    showLegend: widget.appearance?.showLegend ?? null,
    showSliceLabels: widget.appearance?.showSliceLabels ?? null,
    maxSliceLabels: widget.appearance?.maxSliceLabels ?? null,
    histogramBins: widget.appearance?.histogramBins ?? null,
    categorySort: widget.appearance?.categorySort ?? null,
  },
});
const sameWidget = (a: DashboardWidget | undefined, b: DashboardWidget | undefined) =>
  a === undefined ? b === undefined : b !== undefined
    && JSON.stringify(snapshotWidget(a)) === JSON.stringify(snapshotWidget(b));

function fieldChange(key: 'name' | 'description', label: string, before: string, local: string, latest: string): ConflictChange | null {
  const editedHere = before !== local;
  const editedElsewhere = before !== latest;
  if (!editedHere && !editedElsewhere) return null;
  const status: ConflictChangeStatus = !editedHere ? 'remote'
    : !editedElsewhere ? 'compatible'
      : local === latest ? 'already-saved' : 'overlapping';
  return { key, label, kind: key, status,
    detail: status === 'compatible' ? 'Only this draft changed the field.'
      : status === 'remote' ? 'Only the newer saved dashboard changed the field.'
        : status === 'already-saved' ? 'Both editors chose the same value.'
          : 'Both editors changed this field differently.' };
}

// Order is significant only for original widget IDs that remain in both snapshots.
// Additions are separately accounted for and appended during selective recovery.
function changedOrder(baseline: DashboardWidget[], target: DashboardWidget[]): boolean {
  const original = new Set(baseline.map(widget => widget.id));
  const present = new Set(target.map(widget => widget.id));
  const commonOriginal = baseline.filter(widget => present.has(widget.id)).map(widget => widget.id);
  const commonTarget = target.filter(widget => original.has(widget.id)).map(widget => widget.id);
  return commonOriginal.some((id, index) => id !== commonTarget[index]);
}

export function reviewDashboardConflict(
  baseline: Dashboard, local: DashboardDraft, latest: Dashboard,
): DashboardConflictReview {
  const changes: ConflictChange[] = [];
  const name = fieldChange('name', 'Dashboard name', baseline.name, local.name, latest.name);
  const description = fieldChange('description', 'Dashboard description',
    baseline.description, local.description, latest.description);
  if (name) changes.push(name);
  if (description) changes.push(description);

  const originals = new Map(baseline.widgets.map(widget => [widget.id, widget]));
  const drafts = new Map(local.widgets.map(widget => [widget.id, widget]));
  const saved = new Map(latest.widgets.map(widget => [widget.id, widget]));
  const ids = new Set([...originals.keys(), ...drafts.keys(), ...saved.keys()]);
  for (const id of ids) {
    const before = originals.get(id), here = drafts.get(id), there = saved.get(id);
    const localChanged = !sameWidget(before, here), remoteChanged = !sameWidget(before, there);
    if (!localChanged && !remoteChanged) continue;
    const kind: ConflictChangeKind = !before ? 'widget-add'
      : !here || !there ? 'widget-remove' : 'widget-edit';
    const label = `Visualization: ${here?.title ?? there?.title ?? before?.title ?? id}`;
    const status: ConflictChangeStatus = !localChanged ? 'remote'
      : !remoteChanged ? 'compatible'
        : sameWidget(here, there) ? 'already-saved' : 'overlapping';
    changes.push({ key: `widget:${id}`, label, kind, status,
      detail: status === 'compatible'
        ? !before ? 'Added in your draft; recovery appends it after saved visualizations.'
          : !here ? 'Removed in your draft; the saved copy is unchanged.'
            : 'Changed in your draft; the saved copy is unchanged.'
        : status === 'remote' ? 'Changed only in the newer saved dashboard.'
          : status === 'already-saved' ? 'The newer saved dashboard already has your change.'
            : !here || !there ? 'A removal overlaps another change. Reconcile manually.'
              : 'Both editors changed this visualization. Reconcile manually.' });
  }

  const localOrder = changedOrder(baseline.widgets, local.widgets);
  const remoteOrder = changedOrder(baseline.widgets, latest.widgets);
  if (localOrder || remoteOrder) changes.push({
    key: 'order', label: 'Visualization order', kind: 'order',
    status: localOrder ? 'manual' : 'remote',
    detail: localOrder ? 'Your reordering must be repeated manually after recovery; the latest saved order is retained.'
      : 'Another editor rearranged visualizations; their saved order is retained.',
  });
  return { changes,
    compatible: changes.filter(change => change.status === 'compatible'),
    overlapping: changes.filter(change => change.status === 'overlapping'),
    remote: changes.filter(change => change.status === 'remote'),
    manual: changes.filter(change => change.status === 'manual'),
    alreadySaved: changes.filter(change => change.status === 'already-saved') };
}

/**
 * Explicit opt-in only. Never send this draft to the server automatically.
 * The caller must freshly authorize and re-fetch latest before invoking.
 */
export function recoverDashboardChanges(
  baseline: Dashboard, local: DashboardDraft, latest: Dashboard, selectedKeys: readonly string[],
): DashboardDraft {
  if (baseline.id !== latest.id || baseline.organizationId !== latest.organizationId
    || latest.revision < baseline.revision) throw new Error('The saved dashboard identity or revision changed.');
  const review = reviewDashboardConflict(baseline, local, latest);
  const compatible = new Set(review.compatible.map(change => change.key));
  if (selectedKeys.some(key => !compatible.has(key))) throw new Error('Some selected changes need manual review.');
  const chosen = new Set(selectedKeys);
  const originals = new Map(baseline.widgets.map(widget => [widget.id, widget]));
  const localWidgets = new Map(local.widgets.map(widget => [widget.id, widget]));
  const clone = (widget: DashboardWidget): DashboardWidget => ({
    ...widget, appearance: widget.appearance ? { ...widget.appearance } : widget.appearance,
  });
  let widgets = latest.widgets.map(clone);
  for (const change of review.compatible) {
    if (!chosen.has(change.key) || !change.key.startsWith('widget:')) continue;
    const id = change.key.slice('widget:'.length);
    const before = originals.get(id), here = localWidgets.get(id);
    if (before && !here) widgets = widgets.filter(widget => widget.id !== id);
    else if (before && here) widgets = widgets.map(widget => widget.id === id ? clone(here) : widget);
    else if (!before && here) widgets.push(clone(here));
  }
  if (widgets.length > 24 || new Set(widgets.map(widget => widget.id)).size !== widgets.length)
    throw new Error('Recovery exceeds the 24-visualization limit or duplicates an identifier.');
  const result: DashboardDraft = {
    name: chosen.has('name') ? local.name : latest.name,
    description: chosen.has('description') ? local.description : latest.description,
    widgets,
  };
  if (!result.name.trim() || result.name.length > 100 || result.description.length > 500)
    throw new Error('Recovered dashboard fields exceed application limits.');
  return result;
}
