import { describe, expect, it } from 'vitest';
import { hasDashboardChanges, layoutForWidget, moveWidget, reorderWidgets, resizeWidget } from './composition';
import type { Dashboard, DashboardWidget } from './model';

const widget = (id: string): DashboardWidget => ({
  id, title: id, kind: 'bar', datasetKey: 'commerce', metricKey: 'orders', dimensionKey: 'month',
});

const initial: Dashboard = {
  id: 'dashboard', organizationId: 'tenant', name: 'Overview', description: 'Example',
  widgets: [widget('first'), widget('second'), widget('third')], revision: 1,
  createdBy: 'editor', createdAt: '', updatedAt: '',
};

describe('dashboard composition', () => {
  it('gives older dashboards compact metrics, medium charts, and wide tables', () => {
    expect(layoutForWidget({ ...widget('metric'), kind: 'metric' })).toEqual({ columns: 3, height: 220 });
    expect(layoutForWidget(widget('chart'))).toEqual({ columns: 6, height: 340 });
    expect(layoutForWidget({ ...widget('table'), kind: 'table' })).toEqual({ columns: 12, height: 340 });
  });

  it('resizes immutably, clamps dimensions and marks a saved layout as changed', () => {
    const resized = resizeWidget(initial.widgets, 'second', 9, 420);
    expect(resized[1]).toMatchObject({ columns: 9, height: 420 });
    expect(initial.widgets[1]).not.toHaveProperty('columns');
    expect(resizeWidget(initial.widgets, 'second', 6, 340)).toBe(initial.widgets);
    expect(resizeWidget(initial.widgets, 'missing', 9, 420)).toBe(initial.widgets);
    expect(layoutForWidget(resizeWidget(initial.widgets, 'second', 99, 990)[1]!))
      .toEqual({ columns: 12, height: 640 });
    expect(layoutForWidget(resizeWidget(initial.widgets, 'second', 3, 220)[1]!))
      .toEqual({ columns: 6, height: 320 });
    expect(hasDashboardChanges({ name: initial.name, description: initial.description, widgets: resized }, initial)).toBe(true);
  });

  it('moves a dragged widget to its target position without mutating the original list', () => {
    const updated = reorderWidgets(initial.widgets, 'first', 'third');
    expect(updated.map(item => item.id)).toEqual(['second', 'third', 'first']);
    expect(initial.widgets.map(item => item.id)).toEqual(['first', 'second', 'third']);
  });

  it('ignores invalid and same-widget drag targets', () => {
    expect(reorderWidgets(initial.widgets, 'missing', 'first')).toBe(initial.widgets);
    expect(reorderWidgets(initial.widgets, 'first', 'missing')).toBe(initial.widgets);
    expect(reorderWidgets(initial.widgets, 'first', 'first')).toBe(initial.widgets);
  });

  it('moves by one position using keyboard controls, respecting boundaries', () => {
    expect(moveWidget(initial.widgets, 'second', -1).map(item => item.id)).toEqual(['second', 'first', 'third']);
    expect(moveWidget(initial.widgets, 'second', 1).map(item => item.id)).toEqual(['first', 'third', 'second']);
    expect(moveWidget(initial.widgets, 'first', -1)).toBe(initial.widgets);
    expect(moveWidget(initial.widgets, 'third', 1)).toBe(initial.widgets);
  });

  it('compares metadata, widget fields and widget ordering, ignoring revision timestamps', () => {
    const same = { name: initial.name, description: initial.description, widgets: initial.widgets.map(item => ({ ...item })) };
    expect(hasDashboardChanges(same, initial)).toBe(false);
    expect(hasDashboardChanges({ ...same, name: 'New name' }, initial)).toBe(true);
    expect(hasDashboardChanges({ ...same, widgets: moveWidget(same.widgets, 'second', -1) }, initial)).toBe(true);
    expect(hasDashboardChanges({ ...same, widgets: [{ ...same.widgets[0]!, title: 'Edited' }, ...same.widgets.slice(1)] }, initial)).toBe(true);
  });
});
