import { describe, expect, it } from 'vitest';
import { categoryTooltipLabel, colorForCategory, formatChartAxis, formatChartTooltip, selectedPieLabels } from './chartPresentation';
import { commerce } from './demoData';
import { buildHistogram } from './visualizationSemantics';

describe('stable sample chart presentation', () => {
  it('limits leader labels by share and value while preserving source order', () => {
    const months = Array.from({ length: 12 }, (_, index) => ({ month: `M${index + 1}`, revenue: (index + 1) * 100 }));
    const selected = selectedPieLabels(months, 'month', 'revenue');
    expect(selected.size).toBe(5);
    expect([...selected]).toEqual(['M12', 'M11', 'M10', 'M9', 'M8']);
    expect(months[0]?.month).toBe('M1');
    expect(selectedPieLabels([{ channel: 'A', sessions: 0 }], 'channel', 'sessions').size).toBe(0);
  });
  it('names both category and measure in pie/donut tooltip labels', () => {
    expect(categoryTooltipLabel('Referral', 'Sessions')).toBe('Referral · Sessions');
    expect(formatChartTooltip(2820, 'sessions')).toBe('2,820');
  });
  it('preserves channel identity across filtered and full datasets', () => {
    expect(colorForCategory('channels', 'Referral')).toBe('#b03057');
    expect(colorForCategory('channels', 'Organic search')).toBe('#435bc9');
    expect(colorForCategory('channels', 'Referral')).not.toBe(colorForCategory('channels', 'Organic search'));
  });

  it('assigns stable colors to chronological months', () => {
    expect(colorForCategory('commerce', 'Jan')).toBe(colorForCategory('commerce', 'Jan'));
    expect(colorForCategory('commerce', 'Jan')).not.toBe(colorForCategory('commerce', 'Feb'));
  });

  it('formats currency, numeric counts, and percentages consistently', () => {
    expect(formatChartTooltip(18400, 'revenue')).toBe('$18,400');
    expect(formatChartTooltip(2820, 'sessions')).toBe('2,820');
    expect(formatChartTooltip(4.8, 'conversion')).toBe('4.8%');
    expect(formatChartAxis(18400, 'revenue')).toBe('$18.4K');
    expect(formatChartAxis(2820, 'sessions')).toBe('2.8K');
    expect(formatChartAxis(4.8, 'conversion')).toBe('4.8%');
  });

  it('keeps histogram counts as frequencies while labeling revenue bucket ranges as USD', () => {
    const bins = buildHistogram(commerce, 'revenue');
    expect(bins.map(bin => bin.count)).toEqual([4, 3, 3, 2]);
    expect(bins[0]?.label).toBe('$18.4K–$25.88K');
    expect(buildHistogram([{ revenue: 18400 }], 'revenue')[0]?.label).toBe('$18.4K');
  });
});
