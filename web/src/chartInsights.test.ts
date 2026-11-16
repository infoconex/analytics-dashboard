import { describe, expect, it } from 'vitest';
import { chartInsight } from './chartInsights';
import { channels, commerce } from './demoData';

describe('chart insight from the same rows as the table alternative', () => {
  it('describes the leading channel with an unrounded value', () => {
    expect(chartInsight('channel', 'orders', channels)).toBe(
      'Highest: Organic search, 1,820 orders across 5 channels.',
    );
  });

  it('updates when the filtered channel changes', () => {
    expect(chartInsight('channel', 'orders', channels.filter(row => row.channel === 'Direct'))).toBe(
      'Showing Direct: 1,530 orders (1 channel).',
    );
  });

  it('reports first and last points and their direction without abbreviating currency', () => {
    expect(chartInsight('month', 'revenue', commerce)).toBe(
      'From Jan ($18,400) to Dec ($48,300): increased across 12 months.',
    );
  });

  it('handles one point, zero values and a stable trend without invented changes', () => {
    expect(chartInsight('month', 'orders', [{ month: 'Jan', orders: 0 }])).toBe(
      'Jan: 0 orders (1 month).',
    );
    expect(chartInsight('month', 'orders', [{ month: 'Jan', orders: 0 }, { month: 'Feb', orders: 0 }])).toBe(
      'From Jan (0) to Feb (0): unchanged across 2 months.',
    );
  });

  it('keeps conversion rates as single percentages rather than pretending to add percentages', () => {
    expect(chartInsight('channel', 'conversion', channels)).toBe(
      'Highest: Direct, 5.4% conversion rate across 5 channels.',
    );
  });

  it('returns no insight for invalid or empty input', () => {
    expect(chartInsight('month', 'orders', [])).toBeNull();
    expect(chartInsight('month', 'orders', [{ month: 'Jan', orders: Number.NaN }])).toBeNull();
  });
});
