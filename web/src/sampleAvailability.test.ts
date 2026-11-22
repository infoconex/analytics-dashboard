import { describe, expect, it } from 'vitest';
import { sampleAvailability, sampleConfigurationIssue, summarizeSampleAvailability } from './sampleAvailability';
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
  it('pinpoints invalid saved source, metric, axis and chart compatibility without changing fields', () => {
    const missingSource = { ...revenue, datasetKey: 'future-source' as DashboardWidget['datasetKey'] };
    expect(sampleConfigurationIssue(missingSource)?.field).toBe('dataset');
    expect(sampleConfigurationIssue({ ...revenue, metricKey: 'legacy' })?.field).toBe('metric');
    expect(sampleConfigurationIssue({ ...revenue, dimensionKey: 'channel' })?.field).toBe('dimension');
    expect(sampleConfigurationIssue({ ...channels, kind: 'donut', metricKey: 'conversion' })?.field).toBe('kind');
    expect(sampleConfigurationIssue({ ...channels, kind: 'not-a-chart' as DashboardWidget['kind'] })?.field).toBe('kind');
    expect(sampleConfigurationIssue({ ...channels, kind: 'scatter', dimensionKey: 'orders' })?.field).toBe('dimension');
    expect(sampleConfigurationIssue(channels)).toBeNull();
    expect(missingSource.datasetKey).toBe('future-source');
    for (const key of ['__proto__', 'constructor', 'toString']) {
      const widget = { ...revenue, datasetKey: key as DashboardWidget['datasetKey'] };
      expect(sampleConfigurationIssue(widget)?.field).toBe('dataset');
      expect(sampleAvailability(widget, defaults).state).toBe('unavailable');
    }
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
