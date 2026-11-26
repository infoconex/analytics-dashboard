import { describe, expect, it } from 'vitest';
import {
  evaluateFieldFilters, fieldFilterValueError, getFieldFilterCapabilities, parseFieldFilterValues,
  type FieldFilter,
} from './fieldFilterFixtures';

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
