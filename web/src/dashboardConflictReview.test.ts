import { describe, expect, it } from 'vitest';
import { recoverDashboardChanges, reviewDashboardConflict } from './dashboardConflictReview';
import type { Dashboard, DashboardDraft, DashboardWidget } from './model';

const widget = (id: string, title = id): DashboardWidget => ({
  id, title, kind: 'metric', datasetKey: 'commerce', metricKey: 'orders', dimensionKey: 'month',
});
const baseline: Dashboard = {
  id: 'dashboard', organizationId: 'northstar', name: 'Original', description: 'Summary',
  widgets: [widget('a'), widget('b'), widget('c')], revision: 1,
  createdBy: 'editor', createdAt: '', updatedAt: '',
};
const draft = (changes: Partial<DashboardDraft> = {}): DashboardDraft => ({
  name: baseline.name, description: baseline.description,
  widgets: baseline.widgets.map(item => ({ ...item })), ...changes,
});
const remote = (changes: Partial<Dashboard> = {}): Dashboard => ({
  ...baseline, revision: 2, widgets: baseline.widgets.map(item => ({ ...item })), ...changes,
});

describe('dashboard conflict comparison', () => {
  it('distinguishes independent metadata changes and preserves the remote field', () => {
    const local = draft({ name: 'My name' });
    const latest = remote({ description: 'Their description' });
    const review = reviewDashboardConflict(baseline, local, latest);
    expect(review.compatible.map(change => change.key)).toEqual(['name']);
    expect(review.remote.map(change => change.key)).toEqual(['description']);
    expect(recoverDashboardChanges(baseline, local, latest, ['name']))
      .toMatchObject({ name: 'My name', description: 'Their description' });
  });

  it('refuses different values for a simultaneously edited metadata field', () => {
    const local = draft({ name: 'Locally named' });
    const latest = remote({ name: 'Remotely named' });
    expect(reviewDashboardConflict(baseline, local, latest).overlapping.map(change => change.key)).toEqual(['name']);
    expect(() => recoverDashboardChanges(baseline, local, latest, ['name'])).toThrow('manual review');
  });

  it('recognizes identical concurrent field edits as already saved', () => {
    const review = reviewDashboardConflict(baseline, draft({ name: 'Same' }), remote({ name: 'Same' }));
    expect(review.alreadySaved.map(change => change.key)).toEqual(['name']);
    expect(review.compatible).toHaveLength(0);
  });

  it('recovers independent widget edits without modifying the other editor’s widget', () => {
    const local = draft({ widgets: [widget('a', 'My repair'), widget('b'), widget('c')] });
    const latest = remote({ widgets: [widget('a'), widget('b', 'Their update'), widget('c')] });
    const review = reviewDashboardConflict(baseline, local, latest);
    expect(review.compatible.map(change => change.key)).toEqual(['widget:a']);
    expect(review.remote.map(change => change.key)).toEqual(['widget:b']);
    const result = recoverDashboardChanges(baseline, local, latest, ['widget:a']);
    expect(result.widgets.map(item => item.title)).toEqual(['My repair', 'Their update', 'c']);
    expect(result.widgets[0]).not.toBe(local.widgets[0]);
    expect(local.widgets[0]?.title).toBe('My repair');
  });

  it('rejects simultaneous edits to the same widget, including a UX-37 repair', () => {
    const local = draft({ widgets: [{ ...widget('a'), metricKey: 'revenue' }, widget('b'), widget('c')] });
    const latest = remote({ widgets: [widget('a', 'Their title'), widget('b'), widget('c')] });
    expect(reviewDashboardConflict(baseline, local, latest).overlapping[0]?.key).toBe('widget:a');
    expect(() => recoverDashboardChanges(baseline, local, latest, ['widget:a'])).toThrow();
  });

  it('refuses deletion vs edit and modification vs remote deletion', () => {
    const localDelete = draft({ widgets: [widget('b'), widget('c')] });
    const remoteEdit = remote({ widgets: [widget('a', 'Remote'), widget('b'), widget('c')] });
    expect(reviewDashboardConflict(baseline, localDelete, remoteEdit).overlapping[0]?.key).toBe('widget:a');
    const localEdit = draft({ widgets: [widget('a', 'Local'), widget('b'), widget('c')] });
    const remoteDelete = remote({ widgets: [widget('b'), widget('c')] });
    expect(reviewDashboardConflict(baseline, localEdit, remoteDelete).overlapping[0]?.key).toBe('widget:a');
  });

  it('recovers an independent deletion and leaves unrelated additions untouched', () => {
    const local = draft({ widgets: [widget('a'), widget('c')] });
    const latest = remote({ widgets: [widget('a'), widget('b'), widget('c'), widget('remote-added')] });
    const result = recoverDashboardChanges(baseline, local, latest, ['widget:b']);
    expect(result.widgets.map(item => item.id)).toEqual(['a', 'c', 'remote-added']);
  });

  it('appends a selected local new visualization after the saved order', () => {
    const local = draft({ widgets: [widget('local-added'), widget('a'), widget('b'), widget('c')] });
    const latest = remote({ widgets: [widget('c'), widget('a'), widget('b'), widget('remote-added')] });
    const review = reviewDashboardConflict(baseline, local, latest);
    expect(review.compatible.map(change => change.key)).toContain('widget:local-added');
    expect(review.manual.map(change => change.key)).toEqual([]); // insertion alone is not reordering
    const recovered = recoverDashboardChanges(baseline, local, latest, ['widget:local-added']);
    expect(recovered.widgets.map(item => item.id)).toEqual(['c', 'a', 'b', 'remote-added', 'local-added']);
  });

  it('never automatically reapplies local reorder even when another editor added a widget', () => {
    const local = draft({ widgets: [widget('b'), widget('a'), widget('c')] });
    const latest = remote({ widgets: [widget('a'), widget('b'), widget('c'), widget('new')] });
    const review = reviewDashboardConflict(baseline, local, latest);
    expect(review.manual.map(change => change.key)).toEqual(['order']);
    expect(() => recoverDashboardChanges(baseline, local, latest, ['order'])).toThrow();
    expect(recoverDashboardChanges(baseline, local, latest, []).widgets.map(item => item.id))
      .toEqual(['a', 'b', 'c', 'new']);
  });

  it('recognizes layout, appearance and title differences in whole-widget snapshots', () => {
    const local = draft({ widgets: [{ ...widget('a'), columns: 9, height: 420,
      appearance: { showLegend: true } }, widget('b'), widget('c')] });
    const latest = remote();
    expect(reviewDashboardConflict(baseline, local, latest).compatible.map(change => change.key)).toEqual(['widget:a']);
    expect(recoverDashboardChanges(baseline, local, latest, ['widget:a']).widgets[0])
      .toMatchObject({ columns: 9, height: 420, appearance: { showLegend: true } });
  });

  it('blocks a 25th visualization instead of creating an unsavable draft', () => {
    const full = remote({ widgets: Array.from({ length: 24 }, (_, index) => widget(`remote-${index}`)) });
    const local = draft({ widgets: [...baseline.widgets, widget('local-added')] });
    expect(() => recoverDashboardChanges(baseline, local, full, ['widget:local-added'])).toThrow('24-visualization');
  });

  it('rejects identity or revision mismatch and does not mutate any snapshot', () => {
    const local = draft({ name: 'Update' });
    const latest = remote({ widgets: [{ ...widget('a'), appearance: { showLegend: false } }, widget('b'), widget('c')] });
    const before = structuredClone(latest);
    expect(() => recoverDashboardChanges(baseline, local, { ...latest, organizationId: 'other' }, ['name'])).toThrow();
    expect(() => recoverDashboardChanges(baseline, local, { ...latest, revision: 0 }, ['name'])).toThrow();
    const recovered = recoverDashboardChanges(baseline, local, latest, ['name']);
    recovered.widgets[0]!.title = 'Edited after recovery';
    expect(latest).toEqual(before);
  });
});
