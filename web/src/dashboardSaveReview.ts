import type { Dashboard, DashboardDraft, DashboardWidget } from './model';
import { reviewDashboardConflict, type ConflictChangeKind } from './dashboardConflictReview';
import { sampleConfigurationIssue } from './sampleAvailability';

/**
 * UX-39 is a presentation of the same dashboard-local change units used by
 * UX-38. No separate editing baseline, history, or persistence is created.
 * Each changed widget has one entry even when multiple attributes change.
 */
export interface PendingSaveChange {
  key: string;
  kind: ConflictChangeKind;
  label: string;
  detail: string;
}

export interface PendingSaveReview {
  changes: PendingSaveChange[];
  summary: string;
  removedCount: number;
}

const APPEARANCE_FIELDS = ['showLegend', 'showSliceLabels', 'maxSliceLabels', 'histogramBins', 'categorySort'] as const;

function changedAppearance(before: DashboardWidget, current: DashboardWidget): boolean {
  return APPEARANCE_FIELDS.some(key => (before.appearance?.[key] ?? null) !== (current.appearance?.[key] ?? null));
}

function describeWidgetEdit(before: DashboardWidget, current: DashboardWidget): string {
  const parts: string[] = [];
  if (before.title !== current.title) parts.push(`Title: “${before.title}” → “${current.title}”`);
  if (before.kind !== current.kind || before.datasetKey !== current.datasetKey
    || before.metricKey !== current.metricKey || before.dimensionKey !== current.dimensionKey) {
    parts.push(sampleConfigurationIssue(before) && !sampleConfigurationIssue(current)
      ? 'Repaired unavailable configuration' : 'Configuration changed');
  }
  if ((before.columns ?? null) !== (current.columns ?? null)
    || (before.height ?? null) !== (current.height ?? null)) parts.push('Size or layout changed');
  if (changedAppearance(before, current)) parts.push('Appearance changed');
  return parts.join(' · ');
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function reviewPendingDashboardSave(baseline: Dashboard, draft: DashboardDraft): PendingSaveReview {
  // Comparing with the same authorized saved snapshot on both sides produces
  // only local differences, using UX-38's whole-widget and reorder semantics.
  const comparison = reviewDashboardConflict(baseline, draft, baseline);
  const originals = new Map(baseline.widgets.map(widget => [widget.id, widget]));
  const current = new Map(draft.widgets.map(widget => [widget.id, widget]));
  const changes: PendingSaveChange[] = comparison.changes.map(change => {
    if (change.kind === 'name') return {
      key: change.key, kind: change.kind, label: 'Dashboard name',
      detail: `“${baseline.name}” → “${draft.name}”`,
    };
    if (change.kind === 'description') return {
      key: change.key, kind: change.kind, label: 'Dashboard description',
      detail: 'Description changed. The current text will be saved.',
    };
    if (change.kind === 'order') return {
      key: change.key, kind: change.kind, label: 'Visualization order',
      detail: 'The remaining existing visualizations will be saved in their current order.',
    };
    const id = change.key.slice('widget:'.length);
    const before = originals.get(id), next = current.get(id);
    if (!before && next) return {
      key: change.key, kind: 'widget-add', label: `Added: ${next.title}`,
      detail: 'This visualization will be added to the dashboard as an independent copy.',
    };
    if (before && !next) return {
      key: change.key, kind: 'widget-remove', label: `Removed: ${before.title}`,
      detail: 'This visualization will be removed from the dashboard when saved.',
    };
    if (before && next) return {
      key: change.key, kind: 'widget-edit', label: `Updated: ${next.title}`,
      detail: describeWidgetEdit(before, next),
    };
    throw new Error('Unexpected dashboard save comparison.');
  });
  const count = (kind: ConflictChangeKind) => changes.filter(change => change.kind === kind).length;
  const removedCount = count('widget-remove');
  const parts: string[] = [];
  if (count('name')) parts.push('name');
  if (count('description')) parts.push('description');
  if (count('widget-add')) parts.push(`${plural(count('widget-add'), 'visualization')} added`);
  if (count('widget-edit')) parts.push(`${plural(count('widget-edit'), 'visualization')} updated`);
  if (removedCount) parts.push(`${plural(removedCount, 'visualization')} removed`);
  if (count('order')) parts.push('order');
  return { changes, summary: parts.length ? `Pending: ${parts.join(' · ')}` : 'No pending dashboard changes', removedCount };
}
