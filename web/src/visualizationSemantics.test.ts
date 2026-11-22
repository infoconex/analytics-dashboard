import { describe, expect, it } from 'vitest';
import { channels, commerce } from './demoData';
import { buildHistogram, suggestedDimension, visualizationProblem } from './visualizationSemantics';
import type { DashboardWidget } from './model';

const base: DashboardWidget = {
  id: '11111111-1111-4111-8111-111111111111', title: 'Revenue', kind: 'histogram',
  datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month',
};

describe('expanded fictional visualizations', () => {
  it('makes histogram bins deterministic and conserves every original row', () => {
    const bins = buildHistogram(commerce, 'revenue', 4);
    expect(bins).toHaveLength(4);
    expect(bins.reduce((count, bin) => count + bin.count, 0)).toBe(12);
    expect(bins[0]!.lower).toBe(18400);
    expect(bins[3]!.upper).toBe(48300);
    expect(buildHistogram(commerce, 'revenue', 4)).toEqual(bins);
  });

  it('handles constant values without invented ranges or phantom records', () => {
    expect(buildHistogram([{ value: 7 }, { value: 7 }], 'value')).toEqual([
      { lower: 7, upper: 7, count: 2, label: '7' },
    ]);
    expect(buildHistogram([{ value: 7 }, { value: Number.NaN }], 'value')).toEqual([]);
  });

  it('rejects non-additive pie and donut rates without inventing a proportion', () => {
    const invalid = { ...base, datasetKey: 'channels' as const, metricKey: 'conversion',
      dimensionKey: 'channel', kind: 'pie' as const };
    expect(visualizationProblem(invalid, channels)).toMatch(/cannot be summed/i);
    expect(visualizationProblem({ ...invalid, kind: 'donut' }, channels)).toMatch(/cannot be summed/i);
    expect(visualizationProblem({ ...invalid, kind: 'pie', metricKey: 'orders' }, channels)).toBeNull();
  });

  it('restricts scatter axes to distinct numeric columns from the same rows', () => {
    const scatter = { ...base, kind: 'scatter' as const, dimensionKey: 'orders' };
    expect(visualizationProblem(scatter, commerce)).toBeNull();
    expect(visualizationProblem({ ...scatter, dimensionKey: 'month' }, commerce)).toMatch(/numeric/i);
    expect(visualizationProblem({ ...scatter, dimensionKey: 'revenue' }, commerce)).toMatch(/different/i);
    expect(suggestedDimension('scatter', 'commerce', 'revenue')).toBe('orders');
    expect(suggestedDimension('scatter', 'channels', 'orders')).toBe('sessions');
    expect(suggestedDimension('pie', 'commerce', 'revenue')).toBe('month');
  });

  it('disallows unsupported fields and unusable histogram datasets', () => {
    expect(visualizationProblem({ ...base, metricKey: 'missing' }, commerce)).not.toBeNull();
    expect(visualizationProblem({ ...base, kind: 'histogram' }, [])).not.toBeNull();
  });
});
