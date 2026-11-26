import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { BookmarkPlus, CopyPlus, Pencil, Trash2, TrendingUp, X } from 'lucide-react';
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
import { categoryTooltipLabel, colorForCategory, formatChartAxis, formatChartTooltip, selectedPieLabels, fitOutsidePieLabels } from './chartPresentation';
import { describeWidgetFilters } from './widgetFilterContext';
import { sampleAvailability } from './sampleAvailability';
import { chartAppearance, chartCategoryRows } from './visualizationAppearance';
import { isQueryWidget, type QueryContext } from './queryVisualization';
import { QueryWidgetTile } from './QueryWidgetTile';

const axisTick = { fontSize: 12, fill: '#566780' };

// Table regions scroll horizontally when columns need room, never vertically.
// Measure actual rendered overflow so the cue stays truthful at any width/zoom.
function ScrollableTable({ className, label, children }: { className: string; label: string; children: ReactNode }) {
  const regionRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [scrollState, setScrollState] = useState({ overflow: false, left: false, right: false });

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const measure = () => {
      const maxScroll = Math.max(0, region.scrollWidth - region.clientWidth);
      const next = { overflow: maxScroll > 1, left: region.scrollLeft > 1, right: region.scrollLeft < maxScroll - 1 };
      setScrollState(current => current.overflow === next.overflow && current.left === next.left && current.right === next.right ? current : next);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(region);
    const table = region.querySelector('table');
    if (table) observer?.observe(table);
    region.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect();
      region.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  return <div className="table-viewport">
    {scrollState.overflow && <p id={hintId} className="table-scroll-hint">
      {scrollState.left && scrollState.right ? 'More columns on both sides.' : scrollState.left ? 'More columns to the left.' : 'More columns to the right.'}
      {' '}Focus the table and use left/right arrow keys, or swipe sideways.
    </p>}
    <div ref={regionRef} className={className} role="region" aria-label={label}
      aria-describedby={scrollState.overflow ? hintId : undefined} tabIndex={0}>{children}</div>
  </div>;
}

interface Props {
  widget: DashboardWidget;
  period: string;
  preview?: boolean;
  position?: number;
  total?: number;
  editing?: boolean;
  onEdit?: (widget: DashboardWidget) => void;
  onRepair?: (widget: DashboardWidget) => void;
  onRemove?: (id: string) => void;
  onDuplicate?: (widget: DashboardWidget) => void;
  onSaveToLibrary?: (widget: DashboardWidget) => void;
  filters?: ConsumerFilters;
  queryContext?: QueryContext;
  onChannelSelect?: (channel: string) => void;
  onPeriodReset?: () => void;
  onReturnToIndex?: () => void;
  onShareInsight?: (widget: DashboardWidget) => void;
}

export function WidgetTile(props: Props) {
  return isQueryWidget(props.widget) ? <QueryWidgetTile {...props} /> : <LegacyWidgetTile {...props} />;
}

function LegacyWidgetTile({ widget, period, preview, position, total, editing, onEdit, onRepair, onRemove, onDuplicate, onSaveToLibrary, filters, onChannelSelect, onPeriodReset, onReturnToIndex, onShareInsight }: Props) {
  const [keyboardIndex, setKeyboardIndex] = useState(0);
  const [chartFocused, setChartFocused] = useState(false);
  const appearance = chartAppearance(widget);
  // These consumer-only controls temporarily override the saved appearance.
  // The editor preview follows the widget draft directly, with no extra controls.
  const [showOutsideLabels, setShowOutsideLabels] = useState(appearance.showSliceLabels);
  const [maxOutsideLabels, setMaxOutsideLabels] = useState<5 | 8 | 12>(appearance.maxSliceLabels);
  useEffect(() => { setShowOutsideLabels(appearance.showSliceLabels); }, [widget.id, appearance.showSliceLabels]);
  useEffect(() => { setMaxOutsideLabels(appearance.maxSliceLabels); }, [widget.id, appearance.maxSliceLabels]);
  const pointerFocusRef = useRef(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  const headingId = `widget-heading-${preview ? 'preview-' : ''}${widget.id}`;
  const data = filters ? selectConsumerRows(widget.datasetKey, filters) : selectRows(widget.datasetKey, period);
  const availability = sampleAvailability(widget, filters ?? { period: period as '3m' | '6m' | '12m', channel: null });
  const chartRows = chartCategoryRows(data, widget);
  const scatter = widget.kind === 'scatter';
  const axis = scatter ? dimensions[widget.datasetKey] : widget.dimensionKey;
  const context = sampleMetricContext(widget.datasetKey, widget.metricKey, axis, data, filters);
  const problem = data.length ? visualizationProblem(widget, data) : null;
  const histogram = widget.kind === 'histogram' ? buildHistogram(data, widget.metricKey, appearance.histogramBins) : [];
  const xMeasure = (Array.isArray(metrics[widget.datasetKey]) ? metrics[widget.datasetKey] : []).find(item => item.key === widget.dimensionKey)?.label ?? widget.dimensionKey;
  const tooltipValue = (value: unknown) => formatChartTooltip(Number(value), metric);
  const axisValue = (value: number) => formatChartAxis(value, metric);
  const channelInteraction = widget.datasetKey === 'channels' && Boolean(onChannelSelect);
  const chartKeyboardInteraction = channelInteraction && (widget.kind === 'donut' || widget.kind === 'pie' || widget.kind === 'bar');
  // Recharts can expose a second tabbable SVG surface even when the chart's
  // accessibility layer is disabled. Our outer chart is the sole keyboard control.
  useEffect(() => {
    if (!chartKeyboardInteraction || !chartContainerRef.current) return;
    const chart = chartContainerRef.current;
    const removeInnerTabStops = () => {
      chart.querySelectorAll<HTMLElement | SVGElement>('[tabindex]').forEach(element => {
        if (element !== chart && element.getAttribute('tabindex') !== '-1') element.setAttribute('tabindex', '-1');
      });
    };
    removeInnerTabStops();
    const observer = new MutationObserver(removeInnerTabStops);
    observer.observe(chart, { subtree: true, childList: true, attributes: true, attributeFilter: ['tabindex'] });
    return () => observer.disconnect();
  }, [chartKeyboardInteraction, data.length]);
  // Measure the chart itself, not the viewport. A narrow desktop widget is
  // subject to the same label constraints as a phone or embedded preview.
  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const bounds = element.getBoundingClientRect();
      const width = Math.floor(bounds.width);
      const height = Math.floor(bounds.height);
      setChartSize(current => current.width === width && current.height === height
        ? current : { width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [widget.id, widget.kind, problem]);
  const pieLabels = selectedPieLabels(chartRows, axis, widget.metricKey, maxOutsideLabels);
  const fittedPieLabels = fitOutsidePieLabels(pieLabels, chartRows, axis, widget.metricKey, chartSize.width, chartSize.height);
  const outsideLabelsVisible = showOutsideLabels && fittedPieLabels.size > 0;
  const selectedChannel = filters?.channel;
  const filterContext = filters && !editing ? describeWidgetFilters(widget.datasetKey, filters) : null;
  function clearLocalFilter() {
    // Move focus to a persistent heading before the transient chip disappears.
    // It remains in this exact visualization at high zoom and inside iframes.
    const heading = document.getElementById(headingId);
    heading?.focus({ preventScroll: true });
    if (filterContext?.applied?.kind === 'channel' && filters?.channel) onChannelSelect?.(filters.channel);
    if (filterContext?.applied?.kind === 'period') onPeriodReset?.();
  }
  const insight = context && !['table', 'metric', 'histogram', 'scatter'].includes(widget.kind)
    ? chartInsight(widget.dimensionKey, widget.metricKey, data)
    : null;
  function selectCategory(index: number) {
    const category = chartRows[index]?.channel;
    if (channelInteraction && typeof category === 'string') onChannelSelect?.(category);
  }
  const activeKeyboardIndex = Math.min(keyboardIndex, Math.max(0, chartRows.length - 1));
  const keyboardCategory = String(chartRows[activeKeyboardIndex]?.[axis] ?? '');
  function onChartKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!chartKeyboardInteraction || !chartRows.length || event.target !== event.currentTarget) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault(); setKeyboardIndex(Math.min(activeKeyboardIndex + 1, chartRows.length - 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault(); setKeyboardIndex(Math.max(activeKeyboardIndex - 1, 0));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); setKeyboardIndex(event.key === 'Home' ? 0 : chartRows.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault(); event.stopPropagation(); selectCategory(activeKeyboardIndex);
    }
  }
  const aggregate = aggregateSampleMetric(widget.datasetKey, widget.metricKey, data);
  const value = aggregate ?? 0;
  const metric = widget.metricKey;
  const first = data[0];
  const last = data[data.length - 1];
  const trend = widget.datasetKey === 'commerce' && data.length > 1 && Number(first?.[metric]) > 0
    ? ((Number(last?.[metric]) - Number(first?.[metric])) / Number(first?.[metric])) * 100
    : null;

  if (availability.state !== 'available' || !context || problem) {
    return (
      <article className="widget-tile widget-unavailable" data-availability={availability.state} aria-labelledby={headingId}>
        <div className="widget-heading"><div><h2 className="widget-title" id={headingId} tabIndex={-1}>{widget.title}</h2></div>
          {onReturnToIndex && <button type="button" className="widget-index-shortcut" onClick={onReturnToIndex} aria-label={`Jump to visualization index from ${widget.title}`}>Index</button>}
        </div>
        <p className="widget-empty"><strong>{availability.state === 'no-match' ? 'No matching sample data.' : 'Insight unavailable.'}</strong> {availability.state === 'available' ? (problem ?? 'This saved visualization cannot be interpreted from the available sample records.') : availability.explanation} No value has been inferred.</p>
        {availability.state === 'no-match' && widget.datasetKey === 'channels' && filters?.channel && onChannelSelect &&
          <button type="button" className="widget-recovery" onClick={() => {
            document.getElementById(headingId)?.focus({ preventScroll: true });
            onChannelSelect(filters.channel!);
          }}>Clear channel filter for {widget.title}</button>}
        {!editing && availability.state === 'unavailable' && onRepair && <button type="button" className="widget-recovery" onClick={() => onRepair(widget)}>Review configuration for {widget.title}</button>}
        {editing && <div className="widget-actions">
          <button type="button" aria-label={availability.state === 'unavailable' ? `Review configuration for ${widget.title}` : `Edit ${widget.title}`}
            className={availability.state === 'unavailable' ? 'widget-recovery' : 'icon-button'}
            onClick={() => onEdit?.(widget)}>{availability.state === 'unavailable' ? 'Review configuration' : <Pencil size={15} />}</button>
            <button aria-label={`Duplicate ${widget.title}`} title="Duplicate on dashboard" className="icon-button" onClick={() => onDuplicate?.(widget)}><CopyPlus size={15} /></button>
            <button aria-label={`Save ${widget.title} to library`} title="Save reusable visualization" className="icon-button" onClick={() => onSaveToLibrary?.(widget)}><BookmarkPlus size={15} /></button>
          <button aria-label={`Remove ${widget.title}`} className="icon-button danger-hover" onClick={() => onRemove?.(widget.id)}><Trash2 size={15} /></button>
        </div>}
        {onReturnToIndex && <div className="widget-return"><button type="button" onClick={onReturnToIndex} aria-label={`Back to visualization list from ${widget.title}`}>Back to visualization list</button></div>}
      </article>
    );
  }

  return (
    <article className={`widget-tile widget-${widget.kind}`} data-availability="available" aria-labelledby={headingId}>
      <div className="widget-heading">
        <div>
          <h2 className="widget-title" id={headingId} tabIndex={-1}>{widget.title}</h2>
          <div className="widget-subtitle">{widget.datasetKey === 'commerce' ? 'Commerce performance' : 'Marketing channels'} · {context.label} ({context.unit})</div>
          <p className="widget-scope">{context.coverage}</p>
        </div>
        {!editing && (position && total || onReturnToIndex) && <div className="widget-heading-shortcuts">
          {position && total && <span className="widget-position"><span aria-hidden="true">{position} / {total}</span><span className="sr-only">Visualization {position} of {total}</span></span>}
          {onReturnToIndex && <button type="button" className="widget-index-shortcut" onClick={onReturnToIndex} aria-label={`Jump to visualization index from ${widget.title}`}>Index</button>}
        </div>}
        {editing ? (
          <div className="widget-actions">
            <button aria-label={`Edit ${widget.title}`} className="icon-button" onClick={() => onEdit?.(widget)}><Pencil size={15} /></button>
            <button aria-label={`Duplicate ${widget.title}`} title="Duplicate on dashboard" className="icon-button" onClick={() => onDuplicate?.(widget)}><CopyPlus size={15} /></button>
            <button aria-label={`Save ${widget.title} to library`} title="Save reusable visualization" className="icon-button" onClick={() => onSaveToLibrary?.(widget)}><BookmarkPlus size={15} /></button>
            <button aria-label={`Remove ${widget.title}`} className="icon-button danger-hover" onClick={() => onRemove?.(widget.id)}><Trash2 size={15} /></button>
          </div>
        ) : null}
      </div>

      {filterContext && (filterContext.applied || filterContext.unaffected) && <div className="widget-filter-context" aria-label={`Filter scope for ${widget.title}`}>
        {filterContext.applied && <div className="widget-filter-applied">
          <span className="widget-filter-status">Filter applied</span>
          {(filterContext.applied.kind === 'channel' ? Boolean(onChannelSelect) : Boolean(onPeriodReset))
            ? <button type="button" className="widget-filter-clear" onClick={clearLocalFilter} aria-label={`Remove ${filterContext.applied.label} filter from ${widget.title}`}>{filterContext.applied.label}<X size={14} aria-hidden="true" /></button>
            : <span className="widget-filter-label">{filterContext.applied.label}</span>}
        </div>}
        {filterContext.unaffected && <span className="widget-filter-unaffected"><strong>Filter not applied:</strong> {filterContext.unaffected}</span>}
      </div>}

      {widget.kind === 'metric' ? (
        <div className="metric-content">
          <div className="metric-number">{aggregate !== null ? formatMetric(aggregate, metric) : 'Combined rate unavailable'}</div>
          {aggregate === null && <p className="metric-limitation">A combined conversion rate cannot be calculated from these independent example percentages. Inspect the individual channels below.</p>}
          {trend !== null && <div className="metric-trend"><TrendingUp size={14} aria-hidden="true" /> {trend > 0 ? '+' : ''}{trend.toFixed(1)}% <span>last versus first sample month, not year-over-year</span></div>}

        </div>
      ) : widget.kind === 'table' ? (
        <ScrollableTable className="widget-table-wrap" label={`Scrollable ${widget.title} table`}>
          <table className="widget-table">
            <caption className="sr-only">{widget.title}: sample {metric} values by {axis}</caption>
            <thead><tr><th scope="col">{axis === 'month' ? 'Month' : 'Channel'}</th><th scope="col">{context.label} ({context.unit})</th>{context.additive && <th scope="col">Share (rounded)</th>}</tr></thead>
            <tbody>{data.map((row) => (
              <tr key={String(row[axis])}><th scope="row">{channelInteraction ? <button type="button" className="table-filter-button" aria-label={selectedChannel === row.channel ? `Show all channels instead of ${row.channel}` : `Show only ${row.channel}`} aria-pressed={selectedChannel === row.channel} onClick={() => onChannelSelect?.(String(row.channel))}>{row[axis]}</button> : row[axis]}</th><td>{formatDetailedMetric(Number(row[metric]), metric)}</td>{context.additive && <td>{value ? Math.round(Number(row[metric]) / value * 100) : 0}%</td>}</tr>
            ))}</tbody>
          </table>
        </ScrollableTable>
      ) : (
        <div ref={chartContainerRef} className={`widget-chart${chartKeyboardInteraction ? ' widget-chart-keyboard' : ''}${chartKeyboardInteraction && chartFocused && widget.kind === 'bar' ? ` keyboard-bar-${activeKeyboardIndex}` : ''}`} role={chartKeyboardInteraction ? 'group' : 'img'} tabIndex={chartKeyboardInteraction ? 0 : undefined} onPointerDownCapture={chartKeyboardInteraction ? () => { pointerFocusRef.current = true; } : undefined} onPointerUpCapture={chartKeyboardInteraction ? () => { pointerFocusRef.current = false; } : undefined} onPointerCancel={chartKeyboardInteraction ? () => { pointerFocusRef.current = false; } : undefined} onFocus={chartKeyboardInteraction ? event => { if (event.target === event.currentTarget && !pointerFocusRef.current) { setKeyboardIndex(0); setChartFocused(true); } } : undefined} onBlur={chartKeyboardInteraction ? event => { if (event.target === event.currentTarget) setChartFocused(false); } : undefined} onKeyDown={onChartKeyDown} aria-label={`${widget.title} ${widget.kind} chart ${scatter ? `comparing ${context.label} with ${xMeasure} from the same original records` : widget.kind === 'histogram' ? `showing the frequency of ${context.label} values in ${histogram.length} bins` : `showing ${metric} by ${axis}`}${selectedChannel && widget.datasetKey === 'channels' ? `, filtered to ${selectedChannel}` : ''}. A text interpretation and exact data table follow.${chartKeyboardInteraction ? ' Use arrow keys to choose a category, Enter or Space to filter. ' : ''}${channelInteraction ? ' Channel selection is also available from the data table.' : ''}`}>
          <ResponsiveContainer width="100%" height="100%">
            {widget.kind === 'donut' || widget.kind === 'pie' ? (
              <PieChart accessibilityLayer={false}>
                <Pie data={chartRows} dataKey={metric} nameKey={axis} cx="50%" cy="50%" startAngle={90} endAngle={-270} innerRadius={widget.kind === 'donut' ? (outsideLabelsVisible ? '51%' : '59%') : 0} outerRadius={outsideLabelsVisible ? '72%' : '80%'} paddingAngle={3} stroke="none" isAnimationActive={false} onClick={(_entry, index) => selectCategory(index)} cursor={channelInteraction ? 'pointer' : 'default'} labelLine={false} label={outsideLabelsVisible ? (props) => {
                  const { cx, cy, midAngle, outerRadius, payload } = props;
                  const category = String(payload?.[axis] ?? '');
                  if (!fittedPieLabels.has(category)) return null;
                  const radians = -Number(midAngle) * Math.PI / 180;
                  const radius = Number(outerRadius);
                  const x1 = Number(cx) + (radius + 3) * Math.cos(radians);
                  const y1 = Number(cy) + (radius + 3) * Math.sin(radians);
                  const x2 = Number(cx) + (radius + 13) * Math.cos(radians);
                  const y2 = Number(cy) + (radius + 13) * Math.sin(radians);
                  const right = Math.cos(radians) >= 0;
                  return <g className="chart-outside-label" aria-hidden="true"><path d={`M${x1},${y1} L${x2},${y2} L${x2 + (right ? 6 : -6)},${y2}`} fill="none" /><text x={x2 + (right ? 9 : -9)} y={y2} textAnchor={right ? 'start' : 'end'} dominantBaseline="central">{category}</text></g>;
                } : false}>
                  {chartRows.map((row, index) => <Cell key={String(row[axis])} fill={colorForCategory(widget.datasetKey, String(row[axis]))} stroke={chartFocused && chartKeyboardInteraction && index === activeKeyboardIndex ? '#172c55' : 'none'} strokeWidth={chartFocused && index === activeKeyboardIndex ? 4 : 0} />)}
                </Pie>
                <Tooltip formatter={(value, name, item) => [tooltipValue(value), categoryTooltipLabel(String(item.payload?.[axis] ?? name), context.label)]} />
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
              <BarChart data={chartRows} tabIndex={-1} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
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
                <defs><linearGradient id={`area-${preview ? 'preview-' : ''}${widget.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6179f4" stopOpacity={0.27} /><stop offset="100%" stopColor="#6179f4" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey={axis} tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickLine={false} axisLine={false} tick={axisTick} tickFormatter={axisValue} width={52} />
                <Tooltip formatter={value => [tooltipValue(value), context.label]} />
                <Area type="monotone" dataKey={metric} stroke="#6179f4" strokeWidth={2.7} fill={`url(#area-${preview ? 'preview-' : ''}${widget.id})`} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {chartKeyboardInteraction && chartFocused && <p className="chart-keyboard-hint" aria-live="polite">Keyboard chart selection: <strong>{keyboardCategory}</strong>. Use arrow keys to choose a category; Enter or Space to {selectedChannel === keyboardCategory ? 'clear' : 'apply'} its filter.</p>}
      {preview && (widget.kind === 'donut' || widget.kind === 'pie') && showOutsideLabels && !outsideLabelsVisible && <p className="chart-label-notice">Outside slice labels are hidden at this preview size. All categories remain available in the data table.</p>}
      {!preview && (widget.kind === 'donut' || widget.kind === 'pie') && <div className="chart-label-options"><button type="button" className="text-link" aria-pressed={showOutsideLabels} onClick={() => setShowOutsideLabels(current => !current)}>{showOutsideLabels ? 'Hide slice labels' : 'Show slice labels'}</button>{showOutsideLabels ? <><label htmlFor={`slice-label-count-${widget.id}`}>Maximum labels</label><select id={`slice-label-count-${widget.id}`} value={maxOutsideLabels} onChange={event => setMaxOutsideLabels(Number(event.target.value) as 5 | 8 | 12)}><option value={5}>5</option><option value={8}>8</option><option value={12}>12</option></select><span aria-live="polite">{fittedPieLabels.size ? `Showing ${fittedPieLabels.size} of ${pieLabels.size} selected leader-line labels where they fit; legend and data table retain all categories.` : 'Outside labels do not fit this chart size. Use the legend or exact data table for every category.'}</span></> : <span>Optional leader-line labels</span>}</div>}
      {widget.kind === 'histogram' && <p className="scatter-axis-titles"><strong>X-axis:</strong> {context.label} ({context.unit}) · <strong>Y-axis:</strong> Source-record frequency (count)</p>}
      {(widget.kind === 'bar' || widget.kind === 'line' || widget.kind === 'area') && <p className="scatter-axis-titles"><strong>X-axis:</strong> {widget.datasetKey === 'commerce' ? 'Sample month (Jan–Dec, year unspecified)' : 'Channel'} · <strong>Y-axis:</strong> {context.label} ({context.unit})</p>}
      {widget.datasetKey === 'channels' && appearance.categorySort !== 'source' && ['bar', 'pie', 'donut'].includes(widget.kind) && <p className="chart-order-note">Categories ordered by {context.label.toLowerCase()}, {appearance.categorySort === 'valueAsc' ? 'smallest' : 'largest'} first. The source table retains its original order.</p>}
      {scatter && <div className="scatter-axis-titles"><span><strong>X-axis:</strong> {xMeasure}</span><span><strong>Y-axis:</strong> {context.label} ({context.unit})</span></div>}
      {insight && <p className="chart-insight"><strong>At a glance:</strong> {insight}</p>}
      {widget.kind === 'histogram' && <p className="chart-insight"><strong>Distribution:</strong> {data.length} observed fictional {widget.datasetKey === 'commerce' ? 'months' : 'channels'} grouped into {histogram.length} value {histogram.length === 1 ? 'range' : 'ranges'}. These are counts of source records, not an additional business metric.</p>}
      {scatter && <p className="chart-insight"><strong>Relationship:</strong> Each point pairs {xMeasure} and {context.label} from one original fictional {widget.datasetKey === 'commerce' ? 'month' : 'channel'}. A visual relationship alone cannot establish causation or statistical significance.</p>}
      <details className="insight-context">
        <summary>What this means</summary>
        {filterContext?.applied && onChannelSelect && <div className="insight-active-filter"><span>Applied channel filter:</span> <button type="button" className="widget-filter-clear" aria-label={`Remove ${filterContext.applied.label} from What this means in ${widget.title}`} onClick={clearLocalFilter}>{filterContext.applied.label}<X size={14} aria-hidden="true" /></button></div>}
        <dl>
          <div><dt>Metric</dt><dd>{context.label} · {context.unit}. {context.meaning}</dd></div>
          <div><dt>Scope</dt><dd>{context.coverage}. {context.filterScope}</dd></div>
          <div><dt>Source</dt><dd>{context.provenance}</dd></div>
          <div><dt>Cannot conclude</dt><dd>{context.limitation} These values cannot explain causes, statistical significance or current customer performance.</dd></div>
        </dl>
        {onShareInsight && <button type="button" className="text-link insight-share" onClick={() => onShareInsight(widget)}>Share this insight’s context</button>}
      </details>
      {(widget.kind === 'donut' || widget.kind === 'pie') && appearance.showLegend && <div className="donut-legend">
        {chartRows.map(row => channelInteraction
          ? <button type="button" className={`donut-legend-button${chartFocused && chartRows[activeKeyboardIndex]?.[axis] === row[axis] ? ' keyboard-current' : ''}`} key={String(row[axis])} aria-label={selectedChannel === row.channel ? `Show all channels instead of ${row.channel}` : `Show only ${row.channel}`} aria-pressed={selectedChannel === row.channel} onClick={() => onChannelSelect?.(String(row.channel))}><i style={{ background: colorForCategory(widget.datasetKey, String(row[axis])) }} />{row[axis]}{selectedChannel === row.channel && <X size={13} aria-hidden="true" />}</button>
          : <span key={String(row[axis])}><i style={{ background: colorForCategory(widget.datasetKey, String(row[axis])) }} />{row[axis]}</span>)}
      </div>}
      {channelInteraction && (widget.kind === 'bar' || widget.kind === 'donut' || widget.kind === 'pie') && <p className="chart-interaction-hint">Select a {widget.kind === 'bar' ? 'bar' : 'slice'} to filter, or use the keyboard-accessible channel selector or data table.</p>}
      {widget.kind !== 'table' && <details className="chart-data">
        <summary>View data table <span className="chart-data-count">({data.length} {data.length === 1 ? 'record' : 'records'})</span></summary>
        <ScrollableTable className="chart-data-scroll" label={`Scrollable ${widget.title} data`}>
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
        </ScrollableTable>
      </details>}
      {onReturnToIndex && <div className="widget-return"><button type="button" onClick={onReturnToIndex} aria-label={`Back to visualization list from ${widget.title}`}>Back to visualization list</button></div>}
    </article>
  );
}
