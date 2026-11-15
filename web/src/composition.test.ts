import { describe, expect, it } from 'vitest';
import { hasDashboardChanges, moveWidget, reorderWidgets } from './composition';
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
