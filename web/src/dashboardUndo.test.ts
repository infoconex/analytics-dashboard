import { describe, expect, it } from 'vitest';
import { captureWidgetChange, emptyWidgetHistory, redoWidgetChange, undoWidgetChange, WIDGET_UNDO_LIMIT } from './dashboardUndo';
import type { DashboardWidget } from './model';

const widget = (id: string): DashboardWidget => ({
  id, title: id, kind: 'bar', datasetKey: 'channels', metricKey: 'orders', dimensionKey: 'channel',
  appearance: { categorySort: 'source' },
});

describe('UX-25 in-memory widget history', () => {
  it('undoes and redoes an added widget without regenerating its id or changing the source snapshot', () => {
    const first = [widget('existing')];
    const added = [...first, widget('copy-id')];
    const history = captureWidgetChange(emptyWidgetHistory(), first, added)!;
    expect(history.past).toHaveLength(1);
    const undone = undoWidgetChange(history, added)!;
    expect(undone.widgets.map(item => item.id)).toEqual(['existing']);
    const redone = redoWidgetChange(undone.history, undone.widgets)!;
    expect(redone.widgets.map(item => item.id)).toEqual(['existing', 'copy-id']);
    expect(redone.widgets[1]).not.toBe(added[1]);
    expect(redone.widgets[1]!.appearance).not.toBe(added[1]!.appearance);
    expect(first).toHaveLength(1);
  });

  it('restores removed, reordered and resized widgets and configurations as full snapshots', () => {
    const original = [widget('a'), widget('b'), widget('c')];
    const removed = [original[0]!, original[2]!];
    const first = captureWidgetChange(emptyWidgetHistory(), original, removed)!;
    const restored = undoWidgetChange(first, removed)!;
    expect(restored.widgets.map(item => item.id)).toEqual(['a', 'b', 'c']);
    const reordered = [original[2]!, original[0]!, original[1]!];
    const changed = captureWidgetChange(restored.history, restored.widgets, reordered)!;
    const resized = reordered.map(item => item.id === 'a' ? { ...item, columns: 9, height: 420,
      appearance: { categorySort: 'valueDesc' as const } } : item);
    const twice = captureWidgetChange(changed, reordered, resized)!;
    expect(undoWidgetChange(twice, resized)!.widgets).toEqual(reordered);
    expect(undoWidgetChange(changed, reordered)!.widgets).toEqual(restored.widgets);
  });

  it('does not record no-ops and invalidates redo after a divergent edit', () => {
    const initial = [widget('one')];
    expect(captureWidgetChange(emptyWidgetHistory(), initial, [...initial])).toBeNull();
    const history = captureWidgetChange(emptyWidgetHistory(), initial, [...initial, widget('two')])!;
    const undone = undoWidgetChange(history, [...initial, widget('two')])!;
    expect(undone.history.future).toHaveLength(1);
    const different = captureWidgetChange(undone.history, undone.widgets, [...initial, widget('three')])!;
    expect(different.future).toHaveLength(0);
    expect(redoWidgetChange(different, [...initial, widget('three')])).toBeNull();
  });

  it('bounds history at twenty actions, and clearing it makes undo and redo unavailable', () => {
    let history = emptyWidgetHistory();
    let present = [widget('original')];
    for (let i = 0; i < WIDGET_UNDO_LIMIT + 9; i++) {
      const next = [{ ...present[0]!, title: 'revision-' + i }];
      history = captureWidgetChange(history, present, next)!;
      present = next;
    }
    expect(history.past).toHaveLength(WIDGET_UNDO_LIMIT);
    for (let i = 0; i < WIDGET_UNDO_LIMIT; i++) {
      const result = undoWidgetChange(history, present)!;
      history = result.history;
      present = result.widgets;
    }
    expect(undoWidgetChange(history, present)).toBeNull();
    expect(history.future).toHaveLength(WIDGET_UNDO_LIMIT);
    const reset = emptyWidgetHistory();
    expect(undoWidgetChange(reset, present)).toBeNull();
    expect(redoWidgetChange(reset, present)).toBeNull();
  });
});
