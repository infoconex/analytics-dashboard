import { describe, expect, it } from 'vitest';
import type { Dashboard, DashboardWidget } from './model';
import { copySavedVisualization, duplicateWidget, hasDashboardChanges } from './composition';
import { evaluateQueryWidget, withQueryDefinition } from './queryVisualization';
import { captureWidgetChange, emptyWidgetHistory, undoWidgetChange } from './dashboardUndo';
import { reviewDashboardConflict } from './dashboardConflictReview';
import { reviewPendingDashboardSave } from './dashboardSaveReview';
import { sampleAvailability } from './sampleAvailability';
import { defaultConsumerFilters } from './consumerFilters';

const original: DashboardWidget = { id: 'sales', title: 'Fictional raw sales', kind: 'bar', datasetKey: 'fictionalQuery',
  metricKey: 'query', dimensionKey: 'query', queryDefinition: {
    dataset: 'sales', visualization: 'bar', groupByDimension: 'order_status', aggregate: 'sum', measureDimension: 'amount',
  } };
const base: Dashboard = { id: 'dashboard', organizationId: 'northstar', name: 'Fictional dashboard', description: '',
  widgets: [original], revision: 1, createdBy: 'owner', createdAt: '', updatedAt: '' };
const count = withQueryDefinition(original, { ...original.queryDefinition!, aggregate: 'count', measureDimension: undefined });

describe('EXP-06 persisted query-backed widget shapes', () => {
  it('evaluates two independent definitions from the same dataset under the same context', () => {
    const context = { filters: [{ dimension: 'customer_id', type: 'text' as const, operator: 'Equal' as const, values: ['C-103'] }],
      range: { start: '2026-11-18T00:00:00Z', end: '2026-11-21T00:00:00Z' } };
    expect(evaluateQueryWidget(original, context)).toMatchObject({ groups: [{ label: 'Open', value: 2400 }], calendar: 'Applied' });
    expect(evaluateQueryWidget(count, context)).toMatchObject({ groups: [{ label: 'Open', value: 1 }], calendar: 'Applied' });
    expect(evaluateQueryWidget(original)?.groups[0]?.value).toBe(3600);
    const none = { ...context, range: { start: '2025-01-01T00:00:00Z', end: '2025-02-01T00:00:00Z' } };
    expect(sampleAvailability(original, defaultConsumerFilters, none).state).toBe('no-match');
    expect(evaluateQueryWidget(original, none)?.groups).toEqual([]);
  });

  it('fails closed for missing, mixed, physical or unsupported query definitions', () => {
    for (const widget of [
      { ...original, queryDefinition: undefined },
      { ...original, datasetKey: 'commerce' as const },
      { ...original, queryDefinition: { ...original.queryDefinition!, groupByDimension: 'CustomerId' } },
      { ...original, queryDefinition: { ...original.queryDefinition!, aggregate: 'count' as const } },
      { ...original, queryDefinition: { ...original.queryDefinition!, sql: 'unapproved' } },
    ]) {
      expect(evaluateQueryWidget(widget)).toBeNull();
      expect(sampleAvailability(widget, defaultConsumerFilters).state).toBe('unavailable');
    }
  });

  it('copies definitions independently and recognizes query-only edits, undo and overlapping conflicts', () => {
    const copy = copySavedVisualization(original, 'copy');
    const duplicate = duplicateWidget([original], original.id, 'duplicate')[1]!;
    expect(copy.queryDefinition).toEqual(original.queryDefinition);
    expect(copy.queryDefinition).not.toBe(original.queryDefinition);
    expect(duplicate.queryDefinition).not.toBe(original.queryDefinition);
    const draft = { ...base, widgets: [count] };
    expect(hasDashboardChanges(draft, base)).toBe(true);
    expect(reviewPendingDashboardSave(base, draft).changes[0]?.detail).toContain('Configuration changed');
    const history = captureWidgetChange(emptyWidgetHistory(), base.widgets, draft.widgets)!;
    const undone = undoWidgetChange(history, draft.widgets)!;
    expect(undone.widgets[0]?.queryDefinition).toEqual(original.queryDefinition);
    expect(undone.widgets[0]?.queryDefinition).not.toBe(original.queryDefinition);
    const remote = { ...base, revision: 2, widgets: [withQueryDefinition(original, { ...original.queryDefinition!, groupByDimension: 'customer_id' })] };
    expect(reviewDashboardConflict(base, draft, remote).overlapping.map(change => change.key)).toEqual(['widget:sales']);
  });
});
