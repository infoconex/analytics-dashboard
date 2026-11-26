import { describe, expect, it } from 'vitest';
import { categoryTooltipLabel, colorForCategory, fitOutsidePieLabels, formatChartAxis, formatChartTooltip, selectedPieLabels } from './chartPresentation';
import { commerce } from './demoData';
import { buildHistogram } from './visualizationSemantics';

describe('stable sample chart presentation', () => {
  it('limits leader labels by share and value while preserving source order', () => {
    const months = Array.from({ length: 12 }, (_, index) => ({ month: `M${index + 1}`, revenue: (index + 1) * 100 }));
    const selected = selectedPieLabels(months, 'month', 'revenue');
    expect(selected.size).toBe(5);
    expect([...selected]).toEqual(['M12', 'M11', 'M10', 'M9', 'M8']);
    expect(months[0]?.month).toBe('M1');
    expect(selectedPieLabels(months, 'month', 'revenue', 8).size).toBe(8);
    expect(selectedPieLabels(months, 'month', 'revenue', 12).size).toBe(11); // Tiny slices are still omitted.
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
    expect(colorForCategory('commerce', 'Jan')).toBe('#435bc9');
    expect(colorForCategory('commerce', 'Feb')).toBe('#087b75');
    expect(colorForCategory('commerce', 'Dec')).toBe('#0a7a82');
    expect(colorForCategory('commerce', 'unknown')).toBe('#566780');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    expect(new Set(months.map(month => colorForCategory('commerce', month))).size).toBe(12);
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

describe('UX-26 responsive circular labels', () => {
  const categories = ['Organic search', 'Direct', 'Paid search', 'Social', 'Referral'];
  const rows = categories.map(channel => ({ channel, sessions: 20 }));
  const selected = selectedPieLabels(rows, 'channel', 'sessions', 8);

  it('omits outside SVG labels on phone-sized charts but retains the complete category selection', () => {
    expect(fitOutsidePieLabels(selected, rows, 'channel', 'sessions', 320, 220).size).toBe(0);
    expect(fitOutsidePieLabels(selected, rows, 'channel', 'sessions', 390, 320).size).toBe(0);
    expect(selected).toEqual(new Set(categories));
    expect(fitOutsidePieLabels(selected, rows, 'channel', 'sessions', 780, 340).size).toBeGreaterThan(0);
  });

  it('fits to the widget instead of the viewport and does not draw long labels beyond the edge', () => {
    const long = [...rows, { channel: 'A genuinely long category name that cannot fit outside this slice', sessions: 20 }];
    const labels = selectedPieLabels(long, 'channel', 'sessions', 8);
    const fitted = fitOutsidePieLabels(labels, long, 'channel', 'sessions', 600, 300);
    expect(fitted.has(long[5]!.channel)).toBe(false);
    expect([...fitted].every(category => labels.has(category))).toBe(true);
    expect(fitOutsidePieLabels(labels, long, 'channel', 'sessions', 390, 500).size).toBe(0);
    expect(fitOutsidePieLabels(labels, long, 'channel', 'sessions', 1100, 190).size).toBe(0);
  });

  it('avoids same-side collisions without mutating the chart data or selected order', () => {
    const crowded = Array.from({ length: 12 }, (_, index) => ({ month: `M${index + 1}`, revenue: 1 }));
    const labels = selectedPieLabels(crowded, 'month', 'revenue', 12);
    const fitted = fitOutsidePieLabels(labels, crowded, 'month', 'revenue', 900, 220);
    expect(fitted.size).toBeLessThan(labels.size);
    expect(crowded).toHaveLength(12);
    expect(crowded[0]!.month).toBe('M1');
  });
});
