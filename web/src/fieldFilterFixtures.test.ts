import { describe, expect, it } from 'vitest';
import {
  evaluateAuthoredQueryPreviews, evaluateFieldFilters, fieldFilterValueError, getFieldFilterCapabilities, getQueryPreviewAuthoringOptions, parseFieldFilterValues,
  type FieldFilter, type QueryPreviewDefinition,
} from './fieldFilterFixtures';
import { resolveReportingRange } from './reportingCalendar';

const filter = (dimension: string, type: FieldFilter['type'], operator: FieldFilter['operator'], ...values: FieldFilter['values']): FieldFilter =>
  ({ dimension, type, operator, values });

describe('experimental typed business-dimension filters', () => {
  it('maps one customer filter through different physical names and explains the incompatible and unmapped visualizations', () => {
    const outcomes = evaluateFieldFilters([filter('customer_id', 'text', 'Equal', 'C-101')]);
    expect(outcomes.find(item => item.id === 'sales')).toMatchObject({ count: 1, applied: ['customer_id'], unapplied: [] });
    expect(outcomes.find(item => item.id === 'support')).toMatchObject({ count: 1, applied: ['customer_id'], unapplied: [] });
    expect(outcomes.find(item => item.id === 'renewals')?.unapplied).toEqual([{ dimension: 'customer_id', reason: 'IncompatibleType' }]);
    expect(outcomes.find(item => item.id === 'inventory')?.unapplied).toEqual([{ dimension: 'customer_id', reason: 'NoApprovedMapping' }]);
  });

  it('exposes text operators that at least one mapped provider supports and reports provider limitations', () => {
    expect(getFieldFilterCapabilities('order_status').operators).toContain('Contains');
    const outcomes = evaluateFieldFilters([filter('order_status', 'text', 'Contains', 'ing')]);
    expect(outcomes.find(item => item.id === 'sales')).toMatchObject({ count: 1, applied: ['order_status'] });
    expect(outcomes.find(item => item.id === 'support')).toMatchObject({ count: 1, applied: ['order_status'] });
    expect(outcomes.find(item => item.id === 'renewals')?.unapplied).toEqual([{ dimension: 'order_status', reason: 'UnsupportedOperator' }]);
  });

  it('reports non-filterable mappings and leaves unrelated sample records unchanged', () => {
    const outcomes = evaluateFieldFilters([filter('service_tier', 'text', 'Equal', 'Gold')]);
    expect(outcomes.find(item => item.id === 'sales')).toMatchObject({ count: 2, applied: ['service_tier'] });
    expect(outcomes.find(item => item.id === 'support')).toMatchObject({ count: 4, applied: [], unapplied: [{ dimension: 'service_tier', reason: 'FieldNotFilterable' }] });
    expect(outcomes.find(item => item.id === 'inventory')).toMatchObject({ count: 3, unapplied: [{ dimension: 'service_tier', reason: 'NoApprovedMapping' }] });
  });

  it('handles null checks without requiring a typed input value', () => {
    const outcomes = evaluateFieldFilters([filter('service_tier', 'text', 'IsNull')]);
    expect(outcomes.find(item => item.id === 'sales')).toMatchObject({ count: 1, applied: ['service_tier'] });
    expect(outcomes.find(item => item.id === 'support')?.unapplied).toEqual([{ dimension: 'service_tier', reason: 'FieldNotFilterable' }]);
    expect(fieldFilterValueError(filter('service_tier', 'text', 'IsNotNull'))).toBeNull();
  });

  it('parses user input into the selected scalar type without query-string construction', () => {
    expect(parseFieldFilterValues('42.5', 'number', 'Equal')).toEqual([42.5]);
    expect(parseFieldFilterValues('true\nfalse', 'boolean', 'In')).toEqual([true, false]);
    expect(parseFieldFilterValues('2026-11-16T12:30', 'timestamp', 'Equal')).toEqual(['2026-11-16T12:30Z']);
    expect(parseFieldFilterValues('Open\nPending', 'text', 'In')).toEqual(['Open', 'Pending']);
    expect(parseFieldFilterValues('', 'text', 'IsNull')).toEqual([]);
  });

  it('combines multiple typed predicates with AND before calculating sample results', () => {
    const outcomes = evaluateFieldFilters([
      filter('customer_id', 'text', 'Equal', 'C-101'),
      filter('order_status', 'text', 'Equal', 'Closed'),
    ]);
    expect(outcomes.find(item => item.id === 'sales')).toMatchObject({ count: 0, applied: ['customer_id', 'order_status'] });
    expect(outcomes.find(item => item.id === 'support')).toMatchObject({ count: 0, applied: ['customer_id', 'order_status'] });
    expect(outcomes.find(item => item.id === 'renewals')?.unapplied).toEqual([{ dimension: 'customer_id', reason: 'IncompatibleType' }]);
  });

  it('applies typed predicates and one inclusive-start, exclusive-end range before grouping query previews', () => {
    const range = resolveReportingRange({ preset: 'custom', zone: 'UTC', weekStart: 1,
      start: '2026-11-18T00:00', end: '2026-11-21T00:00' }, new Date('2026-11-26T12:00:00Z'));
    const outcomes = evaluateAuthoredQueryPreviews([filter('customer_id', 'text', 'Equal', 'C-103')], range);
    expect(outcomes.find(item => item.id === 'sales')).toMatchObject({
      count: 1, applied: ['customer_id'], calendar: 'Applied', groups: [{ label: 'Open', value: 2400 }],
      query: { dataset: 'sales', groupByDimension: 'order_status', aggregate: 'sum', measureDimension: 'amount' },
    });
    expect(outcomes.find(item => item.id === 'support')).toMatchObject({
      count: 1, calendar: 'Applied', groups: [{ label: 'Open', value: 1 }],
    });
    expect(outcomes.find(item => item.id === 'renewals')).toMatchObject({
      count: 1, calendar: 'Applied', groups: [{ label: 'Open', value: 1900 }],
      unapplied: [{ dimension: 'customer_id', reason: 'IncompatibleType' }],
    });
    expect(outcomes.find(item => item.id === 'inventory')).toMatchObject({
      count: 3, calendar: 'No approved reporting time', groups: [
        { label: 'Adapters', value: 3200 }, { label: 'Cables', value: 900 }, { label: 'Displays', value: 5100 },
      ], unapplied: [{ dimension: 'customer_id', reason: 'NoApprovedMapping' }],
    });
  });

  it('keeps existing base sample rows and authored query definitions unchanged when selections clear', () => {
    const outcomes = evaluateAuthoredQueryPreviews([], null);
    expect(outcomes.find(item => item.id === 'sales')).toMatchObject({
      count: 4, calendar: 'All time', groups: [{ label: 'Open', value: 3600 }, { label: 'Closed', value: 800 }, { label: 'Pending', value: 500 }],
    });
    expect(outcomes.find(item => item.id === 'support')).toMatchObject({ count: 4, calendar: 'All time' });
  });

  it('supports numeric comparisons, booleans, timestamps, and bounded categorical sets', () => {
    expect(evaluateFieldFilters([filter('amount', 'number', 'GreaterThan', 1000)]).find(item => item.id === 'sales'))
      .toMatchObject({ count: 2, total: 3600, applied: ['amount'] });
    expect(evaluateFieldFilters([filter('renewal_ready', 'boolean', 'Equal', true)]).find(item => item.id === 'support'))
      .toMatchObject({ count: 2, applied: ['renewal_ready'] });
    expect(evaluateFieldFilters([filter('ordered_at', 'timestamp', 'GreaterThanOrEqual', '2026-11-18T00:00Z')]).find(item => item.id === 'sales'))
      .toMatchObject({ count: 2, applied: ['ordered_at'] });
    expect(evaluateFieldFilters([filter('category', 'text', 'In', 'Adapters', 'Displays')]).find(item => item.id === 'inventory'))
      .toMatchObject({ count: 2, applied: ['category'] });
  });

  it('validates empty, oversized, malformed and unsupported values before activation', () => {
    expect(fieldFilterValueError(filter('order_status', 'text', 'Equal'))).toContain('at least one value');
    expect(fieldFilterValueError(filter('amount', 'number', 'Equal', Number.NaN))).toContain('finite number');
    expect(fieldFilterValueError(filter('renewal_ready', 'boolean', 'Equal', 'true' as never))).toContain('true or false');
    expect(fieldFilterValueError(filter('ordered_at', 'timestamp', 'Equal', '2026-11-16T12:30'))).toContain('explicit UTC offset');
    expect(fieldFilterValueError(filter('order_status', 'text', 'GreaterThan', 'Open'))).toContain('not supported');
    const oversized = filter('order_status', 'text', 'In', ...Array.from({ length: 101 }, (_, index) => `value-${index}`));
    expect(fieldFilterValueError(oversized)).toContain('at most 100');
  });
});

describe('EXP-05 bounded preview authoring', () => {
  const sales: QueryPreviewDefinition = {
    dataset: 'sales', visualization: 'bar', groupByDimension: 'customer_id', aggregate: 'sum', measureDimension: 'amount',
  };
  const range = { start: '2026-11-18T00:00:00Z', end: '2026-11-21T00:00:00Z' };

  it('exposes only approved grouping and aggregation options per fixture', () => {
    expect(getQueryPreviewAuthoringOptions('sales')).toMatchObject({
      groups: [{ id: 'customer_id', label: 'Customer' }, { id: 'order_status', label: 'Order status' }, { id: 'service_tier', label: 'Service tier' }],
      sumMeasure: { id: 'amount', label: 'Amount (USD)' },
    });
    expect(getQueryPreviewAuthoringOptions('support')).toMatchObject({
      groups: [{ id: 'customer_id', label: 'Customer' }, { id: 'order_status', label: 'Ticket status' }],
      sumMeasure: null,
    });
    expect(getQueryPreviewAuthoringOptions('unknown')).toBeNull();
  });

  it('applies typed predicates and reporting time before an authored group and aggregate', () => {
    const filters = [filter('customer_id', 'text', 'Equal', 'C-103')];
    const sum = evaluateAuthoredQueryPreviews(filters, range, [sales]);
    expect(sum.find(item => item.id === 'sales')).toMatchObject({
      query: sales, groups: [{ label: 'C-103', value: 2400 }], count: 1, calendar: 'Applied', applied: ['customer_id'],
    });
    const count = { ...sales, aggregate: 'count' as const, measureDimension: undefined };
    const changed = evaluateAuthoredQueryPreviews(filters, range, [count]);
    expect(changed.find(item => item.id === 'sales')).toMatchObject({ query: count, groups: [{ label: 'C-103', value: 1 }] });
    expect(changed.filter(item => item.id !== 'sales')).toEqual(sum.filter(item => item.id !== 'sales'));
    expect(evaluateAuthoredQueryPreviews([], null, [count]).find(item => item.id === 'sales')).toMatchObject({
      query: count, count: 4, groups: ['C-101', 'C-102', 'C-103', 'C-104'].map(label => ({ label, value: 1 })),
    });
    expect(evaluateAuthoredQueryPreviews(filters, range).find(item => item.id === 'sales')).toMatchObject({
      groups: [{ label: 'Open', value: 2400 }], calendar: 'Applied', applied: ['customer_id'],
    });
  });

  it('rejects unknown datasets, grouping and measure identifiers, chart kinds, aggregate types and duplicates rather than falling back', () => {
    const invalid: QueryPreviewDefinition[] = [
      { ...sales, dataset: 'customer-dataset' },
      { ...sales, groupByDimension: 'CustomerId' },
      { ...sales, groupByDimension: 'amount' },
      { ...sales, measureDimension: 'TotalAmount' },
      { ...sales, measureDimension: undefined },
      { ...sales, aggregate: 'count' },
      { ...sales, dataset: 'support' },
      { ...sales, visualization: 'line' as never },
      { ...sales, aggregate: 'avg' as never },
      { ...sales, dataset: 'support', groupByDimension: 'service_tier', aggregate: 'count', measureDimension: undefined },
    ];
    for (const definition of invalid) {
      expect(() => evaluateAuthoredQueryPreviews([], null, [definition])).toThrow('Unsupported fictional query preview definition.');
    }
    expect(() => evaluateAuthoredQueryPreviews([], null, [sales, sales])).toThrow('Duplicate fictional query preview definition.');
  });
});
