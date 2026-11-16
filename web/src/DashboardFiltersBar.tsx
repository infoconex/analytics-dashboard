import { useLayoutEffect, useRef } from 'react';
import { CalendarDays, Filter, RotateCcw, X } from 'lucide-react';
import { channels } from './demoData';
import { defaultConsumerFilters } from './consumerFilters';
import type { ConsumerFilters, ConsumerPeriod } from './consumerFilters';

interface Props {
  filters: ConsumerFilters;
  onChange: (filters: ConsumerFilters) => void;
  hasCommerce: boolean;
  hasChannels: boolean;
}

const periods: Record<ConsumerPeriod, string> = {
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
};

export function DashboardFiltersBar({ filters, onChange, hasCommerce, hasChannels }: Props) {
  const dateActive = hasCommerce && filters.period !== '12m';
  const channelActive = hasChannels && Boolean(filters.channel);
  const activeCount = Number(dateActive) + Number(channelActive);
  const dateSelect = useRef<HTMLSelectElement>(null);
  const channelSelect = useRef<HTMLSelectElement>(null);
  const pendingFocus = useRef<'date' | 'channel' | null>(null);

  // A removed chip or Reset button disappears after the filter update. Restore
  // focus to its surviving native select before the browser paints the change.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const control = (target === 'channel' ? channelSelect : dateSelect).current;
    control?.focus({ preventScroll: true });
    // Native focus can consider a control visible even when a sticky header
    // covers it at 400% zoom. Restore a clearly visible focus position.
    control?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [filters]);

  function changeFromTransientAction(next: ConsumerFilters, focus: 'date' | 'channel') {
    pendingFocus.current = focus;
    onChange(next);
  }

  return <section className="consumer-filters" aria-label="Dashboard filters">
    <div className="consumer-filters-header">
      <div className="consumer-filters-title"><Filter size={17} aria-hidden="true" /><div><strong>Explore this dashboard</strong><span>Filter the sample data. Your view changes instantly, without changing the saved dashboard.</span></div></div>
      {activeCount > 0 && <button type="button" className="reset-filters" onClick={() => changeFromTransientAction({ ...defaultConsumerFilters }, channelActive ? 'channel' : 'date')}><RotateCcw size={14} aria-hidden="true" /> Reset filters</button>}
    </div>
    {(hasCommerce || hasChannels) && <div className="consumer-controls">
      {hasCommerce && <label className="consumer-filter-field"><span><CalendarDays size={14} aria-hidden="true" /> Date range <small>Commerce only</small></span>
        <select ref={dateSelect} aria-label="Date range (commerce only)" value={filters.period} onChange={event => onChange({ ...filters, period: event.target.value as ConsumerPeriod })}>
          <option value="12m">Last 12 months</option><option value="6m">Last 6 months</option><option value="3m">Last 3 months</option>
        </select></label>}
      {hasChannels && <label className="consumer-filter-field"><span>Marketing channel <small>Channel charts only</small></span>
        <select ref={channelSelect} aria-label="Marketing channel" value={filters.channel ?? ''} onChange={event => onChange({ ...filters, channel: event.target.value || null })}>
          <option value="">All channels</option>{channels.map(row => <option key={row.channel} value={row.channel}>{row.channel}</option>)}
        </select></label>}
    </div>}
    <div className="consumer-filter-bottom">
      <div className="active-filters" aria-label="Active filters">
        <span className="filter-status-label">{activeCount ? `${activeCount} active ${activeCount === 1 ? 'filter' : 'filters'}` : 'All sample records'}</span>
        {dateActive && <button type="button" className="filter-chip" aria-label={`Remove ${periods[filters.period]} filter`} onClick={() => changeFromTransientAction({ ...filters, period: '12m' }, 'date')}>{periods[filters.period]} <X size={14} aria-hidden="true" /></button>}
        {channelActive && <button type="button" className="filter-chip" aria-label={`Remove ${filters.channel} filter`} onClick={() => changeFromTransientAction({ ...filters, channel: null }, 'channel')}>{filters.channel} <X size={14} aria-hidden="true" /></button>}
      </div>
      <span className="filter-scope-note">Monthly date ranges don’t affect channel totals; channels have no dates in this sample.</span>
    </div>
    <div className="sr-only" role="status" aria-label="Dashboard filter changes" aria-live="polite" aria-atomic="true">{activeCount ? `Showing ${dateActive ? periods[filters.period] : 'all months'} and ${channelActive ? filters.channel : 'all channels'}.` : 'Showing all sample records.'}</div>
  </section>;
}
