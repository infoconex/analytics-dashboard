import { describe, expect, it } from 'vitest';
import { describeWidgetFilters } from './widgetFilterContext';

describe('per-widget filter scope for independent fictional datasets', () => {
  const both = { period: '3m' as const, channel: 'Organic search' };

  it('applies channels to marketing, while the reporting period cannot filter undated channels', () => {
    expect(describeWidgetFilters('channels', both)).toEqual({
      applied: { kind: 'channel', label: 'Organic search' },
      unaffected: 'Reporting period does not apply; marketing channel records have no dates.',
    });
  });

  it('applies narrowed sample months to commerce without inventing channel attribution', () => {
    expect(describeWidgetFilters('commerce', both)).toEqual({
      applied: { kind: 'period', label: 'Final 3 sample months' },
      unaffected: 'Organic search does not apply; commerce records have no channel attribution.',
    });
  });

  it('distinguishes date-only, channel-only and unchanged card scopes', () => {
    expect(describeWidgetFilters('commerce', { period: '6m', channel: null })).toEqual({
      applied: { kind: 'period', label: 'Final 6 sample months' }, unaffected: null,
    });
    expect(describeWidgetFilters('channels', { period: '6m', channel: null })).toEqual({
      applied: null, unaffected: 'Reporting period does not apply; marketing channel records have no dates.',
    });
    expect(describeWidgetFilters('commerce', { period: '12m', channel: 'Referral' })).toEqual({
      applied: null, unaffected: 'Referral does not apply; commerce records have no channel attribution.',
    });
    expect(describeWidgetFilters('channels', { period: '12m', channel: 'Referral' })).toEqual({
      applied: { kind: 'channel', label: 'Referral' }, unaffected: null,
    });
    expect(describeWidgetFilters('commerce', { period: '12m', channel: null })).toEqual({
      applied: null, unaffected: null,
    });
    expect(describeWidgetFilters('channels', { period: '12m', channel: null })).toEqual({
      applied: null, unaffected: null,
    });
  });

  it('does not infer filter compatibility for a future dataset', () => {
    expect(describeWidgetFilters('future' as 'commerce', both)).toEqual({ applied: null, unaffected: null });
  });
});
