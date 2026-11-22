import { describe, expect, it } from 'vitest';
import { sampleAvailability, summarizeSampleAvailability } from './sampleAvailability';
import type { DashboardWidget } from './model';

const revenue: DashboardWidget = {
  id: 'a1111111-1111-4111-8111-111111111111', title: 'Revenue',
  kind: 'metric', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month',
};
const channels: DashboardWidget = {
  ...revenue, id: 'b1111111-1111-4111-8111-111111111111', title: 'Channels',
  kind: 'bar', datasetKey: 'channels', metricKey: 'orders', dimensionKey: 'channel',
};
const defaults = { period: '12m' as const, channel: null };

describe('fictional widget data availability', () => {
  it('keeps a valid source available when an unrelated filter is selected', () => {
    expect(sampleAvailability(revenue, { period: '3m', channel: 'Does not exist' }).state).toBe('available');
  });
  it('distinguishes an empty filter result from a missing source', () => {
    const state = sampleAvailability(channels, { ...defaults, channel: 'Does not exist' });
    expect(state.state).toBe('no-match');
    expect(state.state === 'no-match' && state.explanation).toContain('Remove the channel filter');
  });
  it('rejects unsupported data source without inventing zero', () => {
    const state = sampleAvailability({ ...channels, datasetKey: 'unknown-source' as DashboardWidget['datasetKey'] }, defaults);
    expect(state.state).toBe('unavailable');
    expect(state.state === 'unavailable' && state.explanation).toContain('unavailable in this sample viewer');
  });
  it('rejects invalid saved measures and unsafe chart aggregations independently', () => {
    expect(sampleAvailability({ ...revenue, metricKey: 'unrecognized' }, defaults).state).toBe('unavailable');
    expect(sampleAvailability({ ...channels, kind: 'donut', metricKey: 'conversion' }, defaults).state).toBe('unavailable');
  });
  it('summarizes mixed cards without interpreting unmatched records as a zero total', () => {
    expect(summarizeSampleAvailability([
      revenue, channels,
      { ...channels, id: 'unsupported', metricKey: 'broken' },
      { ...channels, id: 'source', datasetKey: 'future' as DashboardWidget['datasetKey'] },
    ], { period: '3m', channel: 'Does not exist' })).toEqual({
      available: 1, noMatch: 1, unavailable: 2,
    });
  });
});
