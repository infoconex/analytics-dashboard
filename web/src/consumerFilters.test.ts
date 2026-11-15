import { describe, expect, it } from 'vitest';
import { defaultConsumerFilters, selectConsumerRows, toggleChannel } from './consumerFilters';

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

  it('toggles the chosen category and ignores unknown future datasets safely', () => {
    expect(toggleChannel(null, 'Direct')).toBe('Direct');
    expect(toggleChannel('Direct', 'Direct')).toBeNull();
    expect(toggleChannel('Direct', 'Referral')).toBe('Referral');
    expect(selectConsumerRows('future_connector' as 'commerce', defaultConsumerFilters)).toEqual([]);
    expect(selectConsumerRows('channels', { ...defaultConsumerFilters, channel: 'Not a channel' })).toEqual([]);
  });
});
