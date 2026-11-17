import { describe, expect, it } from 'vitest';
import { channels, commerce, selectRows } from './demoData';
import { aggregateSampleMetric, sampleMetricContext, sampleOverview } from './sampleInterpretation';

describe('sample interpretation trust contract', () => {
  it('defines meaning, units, provenance and bounded month coverage', () => {
    const context = sampleMetricContext('commerce', 'revenue', 'month', selectRows('commerce', '3m'), { period: '3m', channel: null });
    expect(context).toMatchObject({ label: 'Revenue', unit: 'USD', coverage: 'Oct–Dec (3 fictional sample months; year unspecified)', recordCount: 3 });
    expect(context?.meaning).toContain('illustrative monthly');
    expect(context?.provenance).toContain('fictional');
    expect(context?.filterScope).toContain('channel filter does not apply');
  });

  it('describes filtered channel observations without suggesting a date range', () => {
    const context = sampleMetricContext('channels', 'conversion', 'channel', channels.filter(row => row.channel === 'Direct'), { period: '3m', channel: 'Direct' });
    expect(context?.unit).toBe('%');
    expect(context?.coverage).toBe('Direct (1 of 5 fictional channels; no dates)');
    expect(context?.filterScope).toContain('date range does not apply');
    expect(context?.limitation).toContain('not derived');
    expect(aggregateSampleMetric('channels', 'conversion', channels)).toBeNull();
  });

  it('refuses to invent values for unknown or invalid metric definitions', () => {
    expect(sampleMetricContext('commerce', 'missing', 'month', commerce)).toBeNull();
    expect(sampleMetricContext('commerce', 'revenue', 'channel', commerce)).toBeNull();
    expect(sampleMetricContext('commerce', 'revenue', 'month', [{ month: 'Jan', revenue: Number.NaN }])).toBeNull();
    expect(aggregateSampleMetric('commerce', 'missing', commerce)).toBeNull();
    expect(aggregateSampleMetric('commerce', 'revenue', [{ month: 'Jan', revenue: Infinity }])).toBeNull();
  });

  it('aggregates additive observations but never sums independent rates', () => {
    expect(aggregateSampleMetric('commerce', 'revenue', commerce)).toBe(375300);
    expect(aggregateSampleMetric('channels', 'sessions', channels)).toBe(26740);
    expect(aggregateSampleMetric('channels', 'conversion', channels)).toBeNull();
  });

  it('computes overview figures from the same selected rows, not fabricated trends', () => {
    const full = sampleOverview('12m');
    const recent = sampleOverview('3m');
    expect(full.map(item => item.value)).toEqual([375300, 7891, 4994, 26740]);
    expect(recent[0]?.value).toBe(128300);
    expect(recent[1]?.value).toBe(2623);
    expect(recent[3]?.value).toBe(26740);
    expect(full.every(item => item.context.provenance.includes('fictional'))).toBe(true);
    expect(full.every(item => item.context.coverage.includes('sample') || item.context.coverage.includes('fictional'))).toBe(true);
  });
});
