import { Pencil, Trash2, TrendingUp } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatDetailedMetric, formatMetric, selectRows } from './demoData';
import { chartInsight } from './chartInsights';
import { selectConsumerRows } from './consumerFilters';
import type { ConsumerFilters } from './consumerFilters';
import type { DashboardWidget } from './model';

const palette = ['#435bc9', '#087b75', '#99620a', '#714eaf', '#b03057'];
const axisTick = { fontSize: 12, fill: '#566780' };
const formatAxisValue = (value: number) => new Intl.NumberFormat('en-US', {
  notation: 'compact', maximumFractionDigits: 1,
}).format(value);

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
  onReturnToIndex?: () => void;
}

export function WidgetTile({ widget, period, position, total, editing, onEdit, onRemove, filters, onChannelSelect, onReturnToIndex }: Props) {
  const headingId = `widget-heading-${widget.id}`;
  const data = filters ? selectConsumerRows(widget.datasetKey, filters) : selectRows(widget.datasetKey, period);
  const channelInteraction = widget.datasetKey === 'channels' && Boolean(onChannelSelect);
  const selectedChannel = filters?.channel;
  const insight = widget.kind !== 'table' && widget.kind !== 'metric'
    ? chartInsight(widget.dimensionKey, widget.metricKey, data)
    : null;
  function selectCategory(index: number) {
    const category = data[index]?.channel;
    if (channelInteraction && typeof category === 'string') onChannelSelect?.(category);
  }
  const value = data.reduce((total, row) => total + Number(row[widget.metricKey] ?? 0), 0);
  const metric = widget.metricKey;
  const axis = widget.dimensionKey;
  const first = data[0];
  const last = data[data.length - 1];
  const trend = Number(first?.[metric]) > 0
    ? ((Number(last?.[metric]) - Number(first?.[metric])) / Number(first?.[metric])) * 100
    : 0;

  if (data.length === 0) {
    return (
      <article className="widget-tile" aria-labelledby={headingId}>
        <div className="widget-heading"><div><h2 className="widget-title" id={headingId} tabIndex={-1}>{widget.title}</h2></div></div>
        <p className="widget-empty">{filters && widget.datasetKey === 'channels' && selectedChannel
          ? 'No sample records match this channel. Remove the filter to see all channels.'
          : `No sample data is available for dataset “${widget.datasetKey}”.`}</p>
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
          <div className="widget-subtitle">{widget.datasetKey === 'commerce' ? 'Commerce performance' : 'Marketing channels'}{filters && widget.datasetKey === 'channels' && selectedChannel ? ` · ${selectedChannel}` : ''}</div>
        </div>
        {position && total && !editing && <span className="widget-position"><span aria-hidden="true">{position} / {total}</span><span className="sr-only">Visualization {position} of {total}</span></span>}
        {editing ? (
          <div className="widget-actions">
            <button aria-label={`Edit ${widget.title}`} className="icon-button" onClick={() => onEdit?.(widget)}><Pencil size={15} /></button>
            <button aria-label={`Remove ${widget.title}`} className="icon-button danger-hover" onClick={() => onRemove?.(widget.id)}><Trash2 size={15} /></button>
          </div>
        ) : null}
      </div>

      {widget.kind === 'metric' ? (
        <div className="metric-content">
          <div className="metric-number">{formatMetric(value, metric)}</div>
          <div className="metric-trend"><TrendingUp size={14} /> {trend > 0 ? '+' : ''}{trend.toFixed(1)}% <span>across selected period</span></div>
          <div className="metric-sparkline" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} accessibilityLayer={false}>
                <defs><linearGradient id={`gradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6179f4" stopOpacity={0.22} /><stop offset="100%" stopColor="#6179f4" stopOpacity={0} /></linearGradient></defs>
                <Area type="monotone" dataKey={metric} stroke="#6179f4" strokeWidth={2.2} fill={`url(#gradient-${widget.id})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : widget.kind === 'table' ? (
        <div className="widget-table-wrap" role="region" aria-label={`Scrollable ${widget.title} table`} tabIndex={0}>
          <table className="widget-table">
            <caption className="sr-only">{widget.title}: sample {metric} values by {axis}</caption>
            <thead><tr><th scope="col">{axis === 'month' ? 'Month' : 'Channel'}</th><th scope="col">{metric}</th><th scope="col">Share (rounded)</th></tr></thead>
            <tbody>{data.map((row) => (
              <tr key={String(row[axis])}><th scope="row">{channelInteraction ? <button type="button" className="table-filter-button" aria-label={selectedChannel === row.channel ? `Show all channels instead of ${row.channel}` : `Show only ${row.channel}`} aria-pressed={selectedChannel === row.channel} onClick={() => onChannelSelect?.(String(row.channel))}>{row[axis]}</button> : row[axis]}</th><td>{formatDetailedMetric(Number(row[metric] ?? 0), metric)}</td><td>{value ? Math.round(Number(row[metric] ?? 0) / value * 100) : 0}%</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="widget-chart" role="img" aria-label={`${widget.title} ${widget.kind} chart showing ${metric} by ${axis}${selectedChannel && widget.datasetKey === 'channels' ? `, filtered to ${selectedChannel}` : ''}. A text insight and exact data table follow.${channelInteraction ? ' Channel selection is also available from the data table.' : ''}`}>
          <ResponsiveContainer width="100%" height="100%">
            {widget.kind === 'donut' ? (
              <PieChart>
                <Pie data={data} dataKey={metric} nameKey={axis} cx="50%" cy="50%" innerRadius="59%" outerRadius="80%" paddingAngle={3} stroke="none" onClick={(_entry, index) => selectCategory(index)} cursor={channelInteraction ? 'pointer' : 'default'}>
                  {data.map((row, index) => <Cell key={String(row[axis])} fill={palette[index % palette.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : widget.kind === 'bar' ? (
              <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey={axis} tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={formatAxisValue} width={52} />
                <Tooltip cursor={{ fill: '#f2f5fd' }} />
                <Bar dataKey={metric} radius={[6, 6, 0, 0]} maxBarSize={35} fill="#6179f4" onClick={(_entry, index) => selectCategory(index)} cursor={channelInteraction ? 'pointer' : 'default'} />
              </BarChart>
            ) : widget.kind === 'line' ? (
              <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey={axis} tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={formatAxisValue} width={52} />
                <Tooltip />
                <Line type="monotone" dataKey={metric} stroke="#6179f4" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            ) : (
              <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <defs><linearGradient id={`area-${widget.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6179f4" stopOpacity={0.27} /><stop offset="100%" stopColor="#6179f4" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey={axis} tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={formatAxisValue} width={52} />
                <Tooltip />
                <Area type="monotone" dataKey={metric} stroke="#6179f4" strokeWidth={2.7} fill={`url(#area-${widget.id})`} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {insight && <p className="chart-insight"><strong>At a glance:</strong> {insight}</p>}
      {widget.kind === 'donut' && <div className="donut-legend">
        {data.map((row, index) => channelInteraction
          ? <button type="button" className="donut-legend-button" key={String(row[axis])} aria-label={selectedChannel === row.channel ? `Show all channels instead of ${row.channel}` : `Show only ${row.channel}`} aria-pressed={selectedChannel === row.channel} onClick={() => onChannelSelect?.(String(row.channel))}><i style={{ background: palette[index % palette.length] }} />{row[axis]}</button>
          : <span key={String(row[axis])}><i style={{ background: palette[index % palette.length] }} />{row[axis]}</span>)}
      </div>}
      {channelInteraction && (widget.kind === 'bar' || widget.kind === 'donut') && <p className="chart-interaction-hint">Select a {widget.kind === 'bar' ? 'bar' : 'slice'} to filter, or use the keyboard-accessible channel selector or data table.</p>}
      {widget.kind !== 'table' && <details className="chart-data">
        <summary>View data table <span className="chart-data-count">({data.length} {data.length === 1 ? 'record' : 'records'})</span></summary>
        <div className="chart-data-scroll" role="region" aria-label={`Scrollable ${widget.title} data`} tabIndex={0}>
          <table className="widget-table">
            <caption>{widget.title} — sample values by {axis}</caption>
            <thead><tr><th scope="col">{axis === 'month' ? 'Month' : 'Channel'}</th><th scope="col">{metric}</th></tr></thead>
            <tbody>{data.map(row => <tr key={String(row[axis])}>
              <th scope="row">{channelInteraction
                ? <button type="button" className="table-filter-button" aria-label={selectedChannel === row.channel ? `Show all channels instead of ${row.channel}` : `Show only ${row.channel}`} aria-pressed={selectedChannel === row.channel} onClick={() => onChannelSelect?.(String(row.channel))}>{row[axis]}</button>
                : row[axis]}</th>
              <td>{formatDetailedMetric(Number(row[metric] ?? 0), metric)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details>}
      {onReturnToIndex && <div className="widget-return"><button type="button" onClick={onReturnToIndex} aria-label={`Back to visualization list from ${widget.title}`}>Back to visualization list</button></div>}
    </article>
  );
}
