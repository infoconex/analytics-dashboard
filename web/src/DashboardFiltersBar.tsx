import { useLayoutEffect, useRef } from 'react';
import { CalendarDays, Filter, RotateCcw, X } from 'lucide-react';
import { channels } from './demoData';
import { consumerPeriodLabels, defaultConsumerFilters, summarizeFilterImpact } from './consumerFilters';
import type { ConsumerFilters, ConsumerPeriod } from './consumerFilters';
import type { DashboardWidget } from './model';

interface Props {
  filters: ConsumerFilters;
  onChange: (filters: ConsumerFilters) => void;
  widgets: readonly DashboardWidget[];
}

export function DashboardFiltersBar({ filters, onChange, widgets }: Props) {
  const impact = summarizeFilterImpact(widgets);
  const hasCommerce = impact.commerce > 0;
  const hasChannels = impact.channels > 0;
  const dateActive = filters.period !== defaultConsumerFilters.period;
  const channelActive = Boolean(filters.channel);
  const activeCount = Number(dateActive) + Number(channelActive);
  const dateSelect = useRef<HTMLSelectElement>(null);
  const channelSelect = useRef<HTMLSelectElement>(null);
  const pendingFocus = useRef<'date' | 'channel' | null>(null);

  // A removed chip or Reset button disappears after updating. Restore focus
  // to a persistent, visible native select before the browser paints.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const control = (target === 'channel' ? channelSelect : dateSelect).current;
    control?.focus({ preventScroll: true });
    control?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [filters]);

  function changeFromTransientAction(next: ConsumerFilters, focus: 'date' | 'channel') {
    pendingFocus.current = focus;
    onChange(next);
  }

  function restoreDefaults() {
    // Preserve the existing channel-only reset behavior and its focus target.
    const focus = dateActive ? 'date' : 'channel';
    changeFromTransientAction({ ...defaultConsumerFilters }, focus);
  }

  const plural = (count: number) => count === 1 ? 'visualization' : 'visualizations';

  return <section className="consumer-filters" aria-label="Dashboard filters">
    <div className="consumer-filters-header">
      <div className="consumer-filters-title"><Filter size={17} aria-hidden="true" /><div><strong>Explore this dashboard</strong><span>Selections affect only compatible sample visualizations. Your view does not change the saved dashboard.</span></div></div>
      {activeCount > 0 && <button type="button" className="reset-filters" onClick={restoreDefaults}><RotateCcw size={14} aria-hidden="true" /> {activeCount === 2 ? 'Restore default filters' : channelActive ? 'Clear channel filter' : 'Restore default period'}</button>}
    </div>
    {(hasCommerce || hasChannels || activeCount > 0) && <div className="consumer-controls">
      {(hasCommerce || dateActive) && <label className="consumer-filter-field"><span><CalendarDays size={14} aria-hidden="true" /> Date range <small>Commerce only · {impact.commerce} {plural(impact.commerce)}</small></span>
        <select ref={dateSelect} aria-label="Date range (commerce only)" value={filters.period} onChange={event => onChange({ ...filters, period: event.target.value as ConsumerPeriod })}>
          <option value="12m">All 12 sample months</option><option value="6m">Final 6 sample months</option><option value="3m">Final 3 sample months</option>
        </select></label>}
      {(hasChannels || channelActive) && <label className="consumer-filter-field"><span>Marketing channel <small>Channel charts only · {impact.channels} {plural(impact.channels)}</small></span>
        <select ref={channelSelect} aria-label="Marketing channel" value={filters.channel ?? ''} onChange={event => onChange({ ...filters, channel: event.target.value || null })}>
          <option value="">All channels</option>{channels.map(row => <option key={row.channel} value={row.channel}>{row.channel}</option>)}
        </select></label>}
    </div>}
    <div className="consumer-filter-bottom">
      <div className="active-filters" aria-label="Active filters">
        <span className="filter-status-label">{activeCount === 0 ? 'All sample records' : `${activeCount} active ${activeCount === 1 ? 'filter' : 'filters'}`}</span>
        {dateActive && <button type="button" className="filter-chip" aria-label={`Remove ${consumerPeriodLabels[filters.period]} filter`} onClick={() => changeFromTransientAction({ ...filters, period: '12m' }, 'date')}><CalendarDays size={14} aria-hidden="true" /> {consumerPeriodLabels[filters.period]} <X size={14} aria-hidden="true" /></button>}
        {channelActive && <button type="button" className="filter-chip" aria-label={`Remove ${filters.channel} filter`} onClick={() => changeFromTransientAction({ ...filters, channel: null }, 'channel')}>{filters.channel} <X size={14} aria-hidden="true" /></button>}
      </div>
      <span className="filter-scope-note">Reporting periods apply only to commerce; marketing channels have no dates. Channel selections never attribute commerce sales.</span>
      {activeCount > 0 && <div className="filter-impact" aria-label="Filter impact across visualizations">
        {dateActive && <p><strong>Reporting period:</strong> applies to {impact.commerce} commerce {plural(impact.commerce)}; {impact.channels} marketing {plural(impact.channels)} unchanged (no dates).</p>}
        {channelActive && <p><strong>Marketing channel:</strong> applies to {impact.channels} marketing {plural(impact.channels)}; {impact.commerce} commerce {plural(impact.commerce)} unchanged (no channel attribution).</p>}
        {impact.other > 0 && <p>{impact.other} visualization(s) use other datasets; their filter behavior is not inferred.</p>}
      </div>}
    </div>
    <div className="sr-only" role="status" aria-label="Dashboard filter changes" aria-live="polite" aria-atomic="true">{`Reporting period: ${consumerPeriodLabels[filters.period]}. Channel: ${channelActive ? filters.channel : 'all channels'}. ${dateActive ? `Period applies to ${impact.commerce} commerce visualizations; ${impact.channels} marketing visualizations unchanged.` : ''} ${channelActive ? `Channel applies to ${impact.channels} marketing visualizations; ${impact.commerce} commerce visualizations unchanged.` : ''}`}</div>
  </section>;
}
