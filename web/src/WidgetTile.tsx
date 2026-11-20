import { Pencil, Trash2, TrendingUp, X } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { dimensions, formatDetailedMetric, formatMetric, metrics, selectRows } from './demoData';
import { chartInsight } from './chartInsights';
import { selectConsumerRows } from './consumerFilters';
import { aggregateSampleMetric, sampleMetricContext } from './sampleInterpretation';
import type { ConsumerFilters } from './consumerFilters';
import type { DashboardWidget } from './model';
import { buildHistogram, visualizationProblem } from './visualizationSemantics';
import { colorForCategory, formatChartAxis, formatChartTooltip } from './chartPresentation';
import { describeWidgetFilters } from './widgetFilterContext';

const axisTick = { fontSize: 12, fill: '#566780' };

interface Props {
  widget: DashboardWidget;
  period: string;
  position?: number;
  total?: number;
  editing?: boolean;
  onEdit?: (widget: DashboardWidget) => void;
  onRemove?: (id: string) => void;
  filters?: ConsumerFilters;
  onChannelSelect?: (channel: string) => void;
  onPeriodClear?: () => void;
  onReturnToIndex?: () => void;
  onShareInsight?: (widget: DashboardWidget) => void;
}

export function WidgetTile({ widget, period, position, total, editing, onEdit, onRemove, filters, onChannelSelect, onPeriodClear, onReturnToIndex, onShareInsight }: Props) {
  const headingId = `widget-heading-${widget.id}`;
  const data = filters ? selectConsumerRows(widget.datasetKey, filters) : selectRows(widget.datasetKey, period);
  const scatter = widget.kind === 'scatter';
  const axis = scatter ? dimensions[widget.datasetKey] : widget.dimensionKey;
  const context = sampleMetricContext(widget.datasetKey, widget.metricKey, axis, data, filters);
  const problem = visualizationProblem(widget, data);
  const histogram = widget.kind === 'histogram' ? buildHistogram(data, widget.metricKey) : [];
  const xMeasure = metrics[widget.datasetKey]?.find(item => item.key === widget.dimensionKey)?.label ?? widget.dimensionKey;
  const tooltipValue = (value: unknown) => formatChartTooltip(Number(value), metric);
  const axisValue = (value: number) => formatChartAxis(value, metric);
  const channelInteraction = widget.datasetKey === 'channels' && Boolean(onChannelSelect);
  const selectedChannel = filters?.channel;
  const filterContext = filters && !editing ? describeWidgetFilters(widget.datasetKey, filters) : null;
  function clearLocalFilter() {
    // Move focus to a persistent heading before the transient chip disappears.
    // It remains in this exact visualization at high zoom and inside iframes.
    const heading = document.getElementById(headingId);
    heading?.focus({ preventScroll: true });
    if (filterContext?.applied?.kind === 'channel' && filters?.channel) onChannelSelect?.(filters.channel);
    if (filterContext?.applied?.kind === 'period') onPeriodClear?.();
  }
  const insight = context && !['table', 'metric', 'histogram', 'scatter'].includes(widget.kind)
    ? chartInsight(widget.dimensionKey, widget.metricKey, data)
    : null;
  function selectCategory(index: number) {
    const category = data[index]?.channel;
    if (channelInteraction && typeof category === 'string') onChannelSelect?.(category);
  }
  const aggregate = aggregateSampleMetric(widget.datasetKey, widget.metricKey, data);
  const value = aggregate ?? 0;
  const metric = widget.metricKey;
  const first = data[0];
  const last = data[data.length - 1];
  const trend = widget.datasetKey === 'commerce' && data.length > 1 && Number(first?.[metric]) > 0
    ? ((Number(last?.[metric]) - Number(first?.[metric])) / Number(first?.[metric])) * 100
    : null;

  if (!context || problem) {
    return (
      <article className="widget-tile" aria-labelledby={headingId}>
        <div className="widget-heading"><div><h2 className="widget-title" id={headingId} tabIndex={-1}>{widget.title}</h2></div></div>
        <p className="widget-empty"><strong>Insight unavailable.</strong> {problem ?? (data.length === 0
          ? selectedChannel && widget.datasetKey === 'channels'
            ? 'No sample records match this channel. Remove the channel filter to see all channels.'
            : 'This dataset has no available sample records.'
          : 'The saved metric or dimension is not supported by the fictional sample. Ask a dashboard editor to choose an available metric.')} No value has been inferred.</p>
        {editing && <div className="widget-actions">
          <button aria-label={`Edit ${widget.title}`} className="icon-button" onClick={() => onEdit?.(widget)}><Pencil size={15} /></button>
          <button aria-label={`Remove ${widget.title}`} className="icon-button danger-hover" onClick={() => onRemove?.(widget.id)}><Trash2 size={15} /></button>
        </div>}
        {onReturnToIndex && <div className="widget-return"><button type="button" onClick={onReturnToIndex} aria-label={`Back to visualization list from ${widget.title}`}>Back to visualization list</button></div>}
      </article>
    );
  }

  return (
    <article className={`widget-tile widget-${widget.kind}`} aria-labelledby={headingId}>
      <div className="widget-heading">
        <div>
          <h2 className="widget-title" id={headingId} tabIndex={-1}>{widget.title}</h2>
          <div className="widget-subtitle">{widget.datasetKey === 'commerce' ? 'Commerce performance' : 'Marketing channels'} · {context.label} ({context.unit})</div>
          <p className="widget-scope">{context.coverage}</p>
        </div>
        {position && total && !editing && <span className="widget-position"><span aria-hidden="true">{position} / {total}</span><span className="sr-only">Visualization {position} of {total}</span></span>}
        {editing ? (
          <div className="widget-actions">
            <button aria-label={`Edit ${widget.title}`} className="icon-button" onClick={() => onEdit?.(widget)}><Pencil size={15} /></button>
            <button aria-label={`Remove ${widget.title}`} className="icon-button danger-hover" onClick={() => onRemove?.(widget.id)}><Trash2 size={15} /></button>
          </div>
        ) : null}
      </div>

      {filterContext && (filterContext.applied || filterContext.unaffected) && <div className="widget-filter-context" aria-label={`Filter scope for ${widget.title}`}>
        {filterContext.applied && <div className="widget-filter-applied">
          <span className="widget-filter-status">Filtered</span>
          {((filterContext.applied.kind === 'channel' && onChannelSelect) || (filterContext.applied.kind === 'period' && onPeriodClear))
            ? <button type="button" className="widget-filter-clear" onClick={clearLocalFilter} aria-label={`Remove ${filterContext.applied.label} filter from ${widget.title}`}>{filterContext.applied.label}<X size={14} aria-hidden="true" /></button>
            : <span className="widget-filter-label">{filterContext.applied.label}</span>}
        </div>}
        {filterContext.unaffected && <span className="widget-filter-unaffected"><strong>Not affected:</strong> {filterContext.unaffected}</span>}
      </div>}

      {widget.kind === 'metric' ? (
        <div className="metric-content">
          <div className="metric-number">{aggregate !== null ? formatMetric(aggregate, metric) : 'Combined rate unavailable'}</div>
          {aggregate === null && <p className="metric-limitation">A combined conversion rate cannot be calculated from these independent example percentages. Inspect the individual channels below.</p>}
          {trend !== null && <div className="metric-trend"><TrendingUp size={14} aria-hidden="true" /> {trend > 0 ? '+' : ''}{trend.toFixed(1)}% <span>last versus first sample month, not year-over-year</span></div>}
          {aggregate !== null && <div className="metric-sparkline" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} accessibilityLayer={false}>
                <defs><linearGradient id={`gradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6179f4" stopOpacity={0.22} /><stop offset="100%" stopColor="#6179f4" stopOpacity={0} /></linearGradient></defs>
                <Area type="monotone" dataKey={metric} stroke="#6179f4" strokeWidth={2.2} fill={`url(#gradient-${widget.id})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>}
        </div>
      ) : widget.kind === 'table' ? (
        <div className="widget-table-wrap" role="region" aria-label={`Scrollable ${widget.title} table`} tabIndex={0}>
          <table className="widget-table">
            <caption className="sr-only">{widget.title}: sample {metric} values by {axis}</caption>
            <thead><tr><th scope="col">{axis === 'month' ? 'Month' : 'Channel'}</th><th scope="col">{context.label} ({context.unit})</th>{context.additive && <th scope="col">Share (rounded)</th>}</tr></thead>
            <tbody>{data.map((row) => (
              <tr key={String(row[axis])}><th scope="row">{channelInteraction ? <button type="button" className="table-filter-button" aria-label={selectedChannel === row.channel ? `Show all channels instead of ${row.channel}` : `Show only ${row.channel}`} aria-pressed={selectedChannel === row.channel} onClick={() => onChannelSelect?.(String(row.channel))}>{row[axis]}</button> : row[axis]}</th><td>{formatDetailedMetric(Number(row[metric]), metric)}</td>{context.additive && <td>{value ? Math.round(Number(row[metric]) / value * 100) : 0}%</td>}</tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="widget-chart" role="img" aria-label={`${widget.title} ${widget.kind} chart ${scatter ? `comparing ${context.label} with ${xMeasure} from the same original records` : widget.kind === 'histogram' ? `showing the frequency of ${context.label} values in ${histogram.length} bins` : `showing ${metric} by ${axis}`}${selectedChannel && widget.datasetKey === 'channels' ? `, filtered to ${selectedChannel}` : ''}. A text interpretation and exact data table follow.${channelInteraction ? ' Channel selection is also available from the data table.' : ''}`}>
          <ResponsiveContainer width="100%" height="100%">
            {widget.kind === 'donut' || widget.kind === 'pie' ? (
              <PieChart>
                <Pie data={data} dataKey={metric} nameKey={axis} cx="50%" cy="50%" innerRadius={widget.kind === 'donut' ? '59%' : 0} outerRadius="80%" paddingAngle={3} stroke="none" isAnimationActive={false} onClick={(_entry, index) => selectCategory(index)} cursor={channelInteraction ? 'pointer' : 'default'}>
                  {data.map(row => <Cell key={String(row[axis])} fill={colorForCategory(widget.datasetKey, String(row[axis]))} />)}
                </Pie>
                <Tooltip formatter={value => [tooltipValue(value), context.label]} />
              </PieChart>
            ) : widget.kind === 'histogram' ? (
              <BarChart data={histogram} margin={{ top: 8, right: 8, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} width={42} />
                <Tooltip formatter={(count) => [`${count} sample ${widget.datasetKey === 'commerce' ? 'months' : 'channels'}`, 'Frequency']} />
                <Bar dataKey="count" name="Frequency" fill="#6179f4" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            ) : widget.kind === 'scatter' ? (
              <ScatterChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" />
                <XAxis type="number" dataKey={widget.dimensionKey} name={xMeasure} tick={axisTick} tickFormatter={value => formatChartAxis(value, widget.dimensionKey)} />
                <YAxis type="number" dataKey={metric} name={context.label} tick={axisTick} tickFormatter={axisValue} width={52} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value, name) => [formatChartTooltip(Number(value), name === xMeasure ? widget.dimensionKey : metric), name]} />
                <Scatter name={`${xMeasure} and ${context.label}`} data={data} fill="#6179f4" isAnimationActive={false} />
              </ScatterChart>
            ) : widget.kind === 'bar' ? (
              <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey={axis} tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={axisValue} width={52} />
                <Tooltip cursor={{ fill: '#f2f5fd' }} formatter={value => [tooltipValue(value), context.label]} />
                <Bar dataKey={metric} radius={[6, 6, 0, 0]} maxBarSize={35} fill="#6179f4" onClick={(_entry, index) => selectCategory(index)} cursor={channelInteraction ? 'pointer' : 'default'} />
              </BarChart>
            ) : widget.kind === 'line' ? (
              <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey={axis} tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={axisValue} width={52} />
                <Tooltip formatter={value => [tooltipValue(value), context.label]} />
                <Line type="monotone" dataKey={metric} stroke="#6179f4" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            ) : (
              <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <defs><linearGradient id={`area-${widget.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6179f4" stopOpacity={0.27} /><stop offset="100%" stopColor="#6179f4" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey={axis} tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={axisValue} width={52} />
                <Tooltip formatter={value => [tooltipValue(value), context.label]} />
                <Area type="monotone" dataKey={metric} stroke="#6179f4" strokeWidth={2.7} fill={`url(#area-${widget.id})`} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {insight && <p className="chart-insight"><strong>At a glance:</strong> {insight}</p>}
      {widget.kind === 'histogram' && <p className="chart-insight"><strong>Distribution:</strong> {data.length} observed fictional {widget.datasetKey === 'commerce' ? 'months' : 'channels'} grouped into {histogram.length} value {histogram.length === 1 ? 'range' : 'ranges'}. These are counts of source records, not an additional business metric.</p>}
      {scatter && <p className="chart-insight"><strong>Relationship:</strong> Each point pairs {xMeasure} and {context.label} from one original fictional {widget.datasetKey === 'commerce' ? 'month' : 'channel'}. A visual relationship alone cannot establish causation or statistical significance.</p>}
      <details className="insight-context">
        <summary>What this means</summary>
        <dl>
          <div><dt>Metric</dt><dd>{context.label} · {context.unit}. {context.meaning}</dd></div>
          <div><dt>Scope</dt><dd>{context.coverage}. {context.filterScope}</dd></div>
          <div><dt>Source</dt><dd>{context.provenance}</dd></div>
          <div><dt>Cannot conclude</dt><dd>{context.limitation} These values cannot explain causes, statistical significance or current customer performance.</dd></div>
        </dl>
        {onShareInsight && <button type="button" className="text-link insight-share" onClick={() => onShareInsight(widget)}>Share this insight’s context</button>}
      </details>
      {(widget.kind === 'donut' || widget.kind === 'pie') && <div className="donut-legend">
        {data.map(row => channelInteraction
          ? <button type="button" className="donut-legend-button" key={String(row[axis])} aria-label={selectedChannel === row.channel ? `Show all channels instead of ${row.channel}` : `Show only ${row.channel}`} aria-pressed={selectedChannel === row.channel} onClick={() => onChannelSelect?.(String(row.channel))}><i style={{ background: colorForCategory(widget.datasetKey, String(row[axis])) }} />{row[axis]}</button>
          : <span key={String(row[axis])}><i style={{ background: colorForCategory(widget.datasetKey, String(row[axis])) }} />{row[axis]}</span>)}
      </div>}
      {channelInteraction && (widget.kind === 'bar' || widget.kind === 'donut' || widget.kind === 'pie') && <p className="chart-interaction-hint">Select a {widget.kind === 'bar' ? 'bar' : 'slice'} to filter, or use the keyboard-accessible channel selector or data table.</p>}
      {widget.kind !== 'table' && <details className="chart-data">
        <summary>View data table <span className="chart-data-count">({data.length} {data.length === 1 ? 'record' : 'records'})</span></summary>
        <div className="chart-data-scroll" role="region" aria-label={`Scrollable ${widget.title} data`} tabIndex={0}>
          <table className="widget-table">
            <caption>{widget.title} — sample values by {axis}</caption>
            <thead><tr><th scope="col">{axis === 'month' ? 'Month' : 'Channel'}</th>{scatter && <th scope="col">{xMeasure}</th>}<th scope="col">{context.label} ({context.unit})</th></tr></thead>
            <tbody>{data.map(row => <tr key={String(row[axis])}>
              <th scope="row">{channelInteraction
                ? <button type="button" className="table-filter-button" aria-label={selectedChannel === row.channel ? `Show all channels instead of ${row.channel}` : `Show only ${row.channel}`} aria-pressed={selectedChannel === row.channel} onClick={() => onChannelSelect?.(String(row.channel))}>{row[axis]}</button>
                : row[axis]}</th>{scatter && <td>{formatDetailedMetric(Number(row[widget.dimensionKey]), widget.dimensionKey)}</td>}
              <td>{formatDetailedMetric(Number(row[metric]), metric)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>}
      {onReturnToIndex && <div className="widget-return"><button type="button" onClick={onReturnToIndex} aria-label={`Back to visualization list from ${widget.title}`}>Back to visualization list</button></div>}
    </article>
  );
}
