import { describe, expect, it } from 'vitest';
import { describeWidgetFilters } from './widgetFilterContext';

describe('per-widget filter context for independent fictional datasets', () => {
  const selected = { period: '3m' as const, channel: 'Organic search' };

  it('shows the selected channel on channel widgets, not the unrelated date range', () => {
    expect(describeWidgetFilters('channels', selected)).toEqual({
      applied: { kind: 'channel', label: 'Organic search' },
      unaffected: null,
    });
  });

  it('treats the reporting period as context on commerce widgets', () => {
    expect(describeWidgetFilters('commerce', selected)).toEqual({
      applied: null,
      unaffected: 'Organic search does not apply; commerce records have no channel attribution.',
    });
  });

  it('identifies a lone unrelated filter without implying it changed the widget', () => {
    expect(describeWidgetFilters('commerce', { period: '12m', channel: 'Referral' })).toEqual({
      applied: null,
      unaffected: 'Referral does not apply; commerce records have no channel attribution.',
    });
    expect(describeWidgetFilters('channels', { period: '6m', channel: null })).toEqual({
      applied: null,
      unaffected: null,
    });
  });

  it('adds no per-widget clutter without active filters', () => {
    expect(describeWidgetFilters('commerce', { period: '12m', channel: null })).toEqual({ applied: null, unaffected: null });
  });
});
