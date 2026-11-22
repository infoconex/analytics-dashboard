import { describe, expect, it } from 'vitest';
import { consumerPeriodLabels, defaultConsumerFilters, selectConsumerRows, summarizeFilterImpact, toggleChannel } from './consumerFilters';

describe('dashboard consumer filters', () => {
  it('uses a 12-month unfiltered default without changing the source records', () => {
    expect(selectConsumerRows('commerce', defaultConsumerFilters)).toHaveLength(12);
    expect(selectConsumerRows('channels', defaultConsumerFilters)).toHaveLength(5);
  });

  it('coordinates the selected date range only for commerce observations', () => {
    const filters = { ...defaultConsumerFilters, period: '3m' as const };
    expect(selectConsumerRows('commerce', filters).map(row => row.month)).toEqual(['Oct', 'Nov', 'Dec']);
    expect(selectConsumerRows('channels', filters)).toHaveLength(5);
  });

  it('coordinates the selected category only for channel observations', () => {
    const filters = { ...defaultConsumerFilters, channel: 'Organic search' };
    expect(selectConsumerRows('channels', filters).map(row => row.channel)).toEqual(['Organic search']);
    expect(selectConsumerRows('commerce', filters)).toHaveLength(12);
  });

  it('combines independent filters and does not mutate source records', () => {
    const filters = { period: '6m' as const, channel: 'Paid search' };
    expect(selectConsumerRows('commerce', filters)).toHaveLength(6);
    expect(selectConsumerRows('channels', filters)).toEqual([{ channel: 'Paid search', orders: 1120, sessions: 5340, conversion: 3.6 }]);
    expect(selectConsumerRows('channels', defaultConsumerFilters)).toHaveLength(5);
  });

  it('counts compatible visualizations without assuming cross-source relationships', () => {
    const widgets = Array.from({ length: 18 }, (_, index) => ({
      datasetKey: (index % 2 === 0 ? 'commerce' : 'channels') as 'commerce' | 'channels',
    }));
    expect(summarizeFilterImpact(widgets)).toEqual({ commerce: 9, channels: 9, other: 0 });
    expect(summarizeFilterImpact([{ datasetKey: 'future' as 'commerce' }, widgets[0]!]))
      .toEqual({ commerce: 1, channels: 0, other: 1 });
    expect(consumerPeriodLabels['3m']).toBe('Final 3 sample months');
    expect(consumerPeriodLabels['6m']).toBe('Final 6 sample months');
  });

  it('toggles the chosen category and ignores unknown future datasets safely', () => {
    expect(toggleChannel(null, 'Direct')).toBe('Direct');
    expect(toggleChannel('Direct', 'Direct')).toBeNull();
    expect(toggleChannel('Direct', 'Referral')).toBe('Referral');
    expect(selectConsumerRows('future_connector' as 'commerce', defaultConsumerFilters)).toEqual([]);
    expect(selectConsumerRows('channels', { ...defaultConsumerFilters, channel: 'Not a channel' })).toEqual([]);
  });
});
