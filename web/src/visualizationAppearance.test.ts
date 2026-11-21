import { describe, expect, it } from 'vitest';
import { buildHistogram } from './visualizationSemantics';
import { channels, commerce } from './demoData';
import { chartAppearance, chartCategoryRows, compatibleAppearance, layoutForChangedKind, withAppearance } from './visualizationAppearance';
import type { DashboardWidget } from './model';

const pie: DashboardWidget = { id: 'pie', title: 'Channel values', kind: 'pie',
  datasetKey: 'channels', metricKey: 'orders', dimensionKey: 'channel' };

describe('UX-22 chart appearance', () => {
  it('preserves legacy presentation and only stores options when configured', () => {
    expect(chartAppearance(pie)).toEqual({
      showLegend: true, showSliceLabels: false, maxSliceLabels: 5,
      histogramBins: 4, categorySort: 'source',
    });
    const configured = withAppearance(pie, { showLegend: false, showSliceLabels: true, maxSliceLabels: 12 });
    expect(pie.appearance).toBeUndefined();
    expect(configured.appearance).toEqual({ showLegend: false, showSliceLabels: true, maxSliceLabels: 12 });
  });

  it('retains compatible pie/donut settings on type changes while dropping unrelated options', () => {
    const initial = withAppearance(pie, { showLegend: false, maxSliceLabels: 8, categorySort: 'valueDesc' });
    expect(compatibleAppearance(initial.appearance, 'donut', 'channels')).toEqual(initial.appearance);
    expect(compatibleAppearance(initial.appearance, 'bar', 'channels')).toEqual({ categorySort: 'valueDesc' });
    expect(compatibleAppearance(initial.appearance, 'line', 'commerce')).toBeUndefined();
    expect(compatibleAppearance(initial.appearance, 'pie', 'commerce')).toEqual({
      showLegend: false, maxSliceLabels: 8,
    });
  });

  it('sorts existing categorical rows stably, retaining original data and identity', () => {
    const ascending = { ...pie, appearance: { categorySort: 'valueAsc' as const } };
    expect(chartCategoryRows(channels, ascending).map(row => row.channel)).toEqual([
      'Referral', 'Social', 'Paid search', 'Direct', 'Organic search',
    ]);
    expect(chartCategoryRows(channels, { ...pie, appearance: { categorySort: 'valueDesc' } })
      .map(row => row.channel)).toEqual(channels.map(row => row.channel));
    expect(chartCategoryRows(channels, ascending)).not.toBe(channels);
    expect(channels[0]?.channel).toBe('Organic search');
    expect(chartCategoryRows(commerce, { ...ascending, datasetKey: 'commerce', kind: 'bar', metricKey: 'revenue' }))
      .toEqual(commerce); // chronological sample order is never sorted
  });

  it('adjusts compact saved layout on kind changes without discarding valid sizes', () => {
    const compact = { ...pie, kind: 'metric' as const, columns: 3, height: 220 };
    expect(layoutForChangedKind(compact, 'donut')).toEqual({ columns: 6, height: 320 });
    expect(layoutForChangedKind({ ...pie, columns: 9, height: 420 }, 'donut'))
      .toEqual({ columns: 9, height: 420 });
    expect(layoutForChangedKind({ ...pie, columns: null, height: null }, 'bar'))
      .toEqual({ columns: null, height: null });
  });

  it('uses only original finite observations for configurable histogram bins', () => {
    const six = buildHistogram(commerce, 'revenue', 6);
    expect(six).toHaveLength(6);
    expect(six.reduce((sum, bin) => sum + bin.count, 0)).toBe(commerce.length);
    expect(buildHistogram(commerce, 'revenue', 1)).toEqual([]);
    expect(buildHistogram(commerce, 'revenue', 13)).toEqual([]);
    expect(buildHistogram([{ orders: 6 }, { orders: 6 }], 'orders', 12)).toMatchObject([{ count: 2 }]);
  });
});
