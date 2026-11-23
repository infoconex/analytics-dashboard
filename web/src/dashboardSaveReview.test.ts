import { describe, expect, it } from 'vitest';
import type { Dashboard, DashboardDraft, DashboardWidget } from './model';
import { reviewPendingDashboardSave } from './dashboardSaveReview';
import { hasDashboardChanges, copySavedVisualization } from './composition';
import { recoverDashboardChanges } from './dashboardConflictReview';

const widget = (id: string, title = id): DashboardWidget => ({
  id, title, kind: 'metric', datasetKey: 'commerce', metricKey: 'orders', dimensionKey: 'month',
});
const saved: Dashboard = {
  id: 'dashboard', organizationId: 'northstar', name: 'Overview', description: 'Original',
  widgets: [widget('a', 'Revenue'), widget('b', 'Orders'), widget('c', 'Sessions')],
  revision: 1, createdBy: 'editor', createdAt: '', updatedAt: '',
};
const draft = (parts: Partial<DashboardDraft> = {}): DashboardDraft => ({
  name: saved.name, description: saved.description,
  widgets: saved.widgets.map(item => ({ ...item })), ...parts,
});
const changes = (value: DashboardDraft, baseline = saved) => reviewPendingDashboardSave(baseline, value);

describe('UX-39 pending dashboard save review', () => {
  it('has no changes when opened or a metadata edit is undone', () => {
    expect(changes(draft()).changes).toEqual([]);
    expect(changes(draft({ name: 'Temporary' })).changes.map(item => item.kind)).toEqual(['name']);
    expect(changes(draft({ name: saved.name })).changes).toEqual([]);
    expect(hasDashboardChanges(draft(), saved)).toBe(false);
  });

  it('describes metadata values without publishing or changing the baseline', () => {
    const review = changes(draft({ name: 'New name', description: 'New description' }));
    expect(review.changes.map(item => item.label)).toEqual(['Dashboard name', 'Dashboard description']);
    expect(review.changes[0]?.detail).toContain('“Overview” → “New name”');
    expect(review.summary).toBe('Pending: name · description');
    expect(saved.name).toBe('Overview');
  });

  it('reports several independent additions, edits and removal with recognizable titles', () => {
    const review = changes(draft({ name: 'Updated',
      widgets: [{ ...saved.widgets[0]!, title: 'Revenue changed' }, saved.widgets[1]!,
        widget('added-one', 'Acquisition'), widget('added-two', 'Conversions')] }));
    expect(review.changes.map(item => item.label)).toEqual([
      'Dashboard name', 'Updated: Revenue changed', 'Removed: Sessions',
      'Added: Acquisition', 'Added: Conversions',
    ]);
    expect(review.summary).toContain('2 visualizations added');
    expect(review.summary).toContain('1 visualization updated');
    expect(review.summary).toContain('1 visualization removed');
    expect(review.removedCount).toBe(1);
  });

  it('elides an added then removed unsaved widget', () => {
    const temporary = widget('temporary', 'Scratch chart');
    expect(changes(draft({ widgets: [...saved.widgets, temporary] })).changes).toHaveLength(1);
    expect(changes(draft({ widgets: [...saved.widgets] })).changes).toHaveLength(0);
  });

  it('elides a changed widget after undo returns to the authorized snapshot', () => {
    const edited = draft({ widgets: saved.widgets.map((item, index) =>
      index === 1 ? { ...item, columns: 9, height: 420 } : item) });
    expect(changes(edited).changes.map(item => item.kind)).toEqual(['widget-edit']);
    expect(changes(draft()).changes).toEqual([]);
  });

  it('counts a repeatedly edited widget once, including title, layout and appearance', () => {
    const updated = { ...saved.widgets[0]!, title: 'Better revenue',
      metricKey: 'revenue', columns: 6, height: 400, appearance: { showLegend: false } };
    const review = changes(draft({ widgets: [updated, ...saved.widgets.slice(1)] }));
    expect(review.changes).toHaveLength(1);
    expect(review.changes[0]?.label).toBe('Updated: Better revenue');
    expect(review.changes[0]?.detail).toContain('Title:');
    expect(review.changes[0]?.detail).toContain('Configuration changed');
    expect(review.changes[0]?.detail).toContain('Size or layout changed');
    expect(review.changes[0]?.detail).toContain('Appearance changed');
  });

  it('identifies repaired unavailable configurations only when support is restored', () => {
    const original = { ...saved, widgets: [{ ...widget('a', 'Broken'), metricKey: 'missing' }] };
    const repaired = { name: original.name, description: original.description,
      widgets: [{ ...original.widgets[0]!, metricKey: 'orders', title: 'Repaired' }] };
    const review = changes(repaired, original);
    expect(review.changes).toHaveLength(1);
    expect(review.changes[0]?.detail).toContain('Repaired unavailable configuration');
    expect(review.changes[0]?.detail).not.toContain('Configuration changed');
    expect(changes({ ...repaired, widgets: [{ ...repaired.widgets[0]!, metricKey: 'also-missing' }] }, original)
      .changes[0]?.detail).toContain('Configuration changed');
  });

  it('distinguishes persistent ordering from resize without duplicating a widget edit', () => {
    const widgets = [saved.widgets[1]!, { ...saved.widgets[0]!, columns: 6 }, saved.widgets[2]!];
    const review = changes(draft({ widgets }));
    expect(review.changes.map(item => item.kind)).toEqual(['widget-edit', 'order']);
    expect(review.changes[0]?.detail).toContain('Size or layout changed');
    expect(review.summary).toContain('order');
    expect(review.changes[1]?.detail).toContain('Orders, Revenue');
  });

  it('does not manufacture a reordering when simply removing an existing widget', () => {
    const review = changes(draft({ widgets: [saved.widgets[0]!, saved.widgets[2]!] }));
    expect(review.changes.map(item => item.kind)).toEqual(['widget-remove']);
    expect(review.changes[0]?.label).toBe('Removed: Orders');
  });

  it('ignores absent/empty appearance settings on legacy saved widgets', () => {
    const copy = draft({ widgets: [{ ...saved.widgets[0]!, appearance: {} }, ...saved.widgets.slice(1)] });
    expect(changes(copy).changes).toEqual([]);
  });

  it('treats a copied library template as an added independent widget, not a template mutation', () => {
    const template = { ...widget('library-id', 'Shared chart'), appearance: { showLegend: false } };
    const copied = copySavedVisualization(template, 'dashboard-copy');
    const review = changes(draft({ widgets: [...saved.widgets, copied] }));
    expect(review.changes.map(item => item.label)).toEqual(['Added: Shared chart']);
    copied.title = 'Dashboard-only title';
    expect(template.title).toBe('Shared chart');
    expect(changes(draft()).changes).toEqual([]);
  });

  it('uses the newer saved revision as the review baseline after selective UX-38 recovery', () => {
    const local = draft({ name: 'Local name', description: 'Local description',
      widgets: [{ ...saved.widgets[0]!, title: 'Local revenue' }, ...saved.widgets.slice(1)] });
    const latest: Dashboard = { ...saved, revision: 2, description: 'Remote description',
      widgets: [saved.widgets[0]!, { ...saved.widgets[1]!, title: 'Remote orders' }, saved.widgets[2]!] };
    const recovered = recoverDashboardChanges(saved, local, latest, ['name', 'widget:a']);
    const review = changes(recovered, latest);
    expect(review.changes.map(item => item.label)).toEqual(['Dashboard name', 'Updated: Local revenue']);
    expect(recovered.description).toBe('Remote description');
    expect(recovered.widgets[1]!.title).toBe('Remote orders');
    expect(review.summary).not.toContain('description');
    expect(changes({ name: latest.name, description: latest.description, widgets: latest.widgets }, latest).changes).toEqual([]);
  });

  it('retains the same pending changes across a rejected save until the baseline changes', () => {
    const local = draft({ name: 'Draft name' });
    const before = changes(local);
    expect(before.changes).toHaveLength(1);
    expect(changes(local).changes).toEqual(before.changes);
    const latest = { ...saved, name: 'Remote name', revision: 2 };
    expect(changes(local, latest).changes).toHaveLength(1);
    expect(changes(draft({ name: latest.name }), latest).changes).toHaveLength(0);
  });
});
