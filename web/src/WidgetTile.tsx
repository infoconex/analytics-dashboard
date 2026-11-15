import { MoreHorizontal, Pencil, Trash2, TrendingUp } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatMetric, selectRows } from './demoData';
import type { DashboardWidget } from './model';

const palette = ['#6179f4', '#36b8b0', '#f0b35d', '#a38af4', '#f17f97'];

interface Props {
  widget: DashboardWidget;
  period: string;
  editing?: boolean;
  onEdit?: (widget: DashboardWidget) => void;
  onRemove?: (id: string) => void;
}

export function WidgetTile({ widget, period, editing, onEdit, onRemove }: Props) {
  const data = selectRows(widget.datasetKey, period);
  const value = data.reduce((total, row) => total + Number(row[widget.metricKey] ?? 0), 0);
  const metric = widget.metricKey;
  const axis = widget.dimensionKey;
  const first = data[0];
  const last = data[data.length - 1];
  const trend = Number(first?.[metric]) > 0
    ? ((Number(last?.[metric]) - Number(first[metric])) / Number(first[metric])) * 100
    : 0;

  return (
    <article className={`widget-tile widget-${widget.kind}`}>
      <div className="widget-heading">
        <div>
          <div className="widget-title">{widget.title}</div>
          <div className="widget-subtitle">{widget.datasetKey === 'commerce' ? 'Commerce performance' : 'Marketing channels'}</div>
        </div>
        {editing ? (
          <div className="widget-actions">
            <button aria-label={`Edit ${widget.title}`} className="icon-button" onClick={() => onEdit?.(widget)}><Pencil size={15} /></button>
            <button aria-label={`Remove ${widget.title}`} className="icon-button danger-hover" onClick={() => onRemove?.(widget.id)}><Trash2 size={15} /></button>
          </div>
        ) : <MoreHorizontal size={18} className="muted-icon" aria-hidden="true" />}
      </div>

      {widget.kind === 'metric' ? (
        <div className="metric-content">
          <div className="metric-number">{formatMetric(value, metric)}</div>
          <div className="metric-trend"><TrendingUp size={14} /> {trend > 0 ? '+' : ''}{trend.toFixed(1)}% <span>across selected period</span></div>
          <div className="metric-sparkline">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs><linearGradient id={`gradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6179f4" stopOpacity={0.22} /><stop offset="100%" stopColor="#6179f4" stopOpacity={0} /></linearGradient></defs>
                <Area type="monotone" dataKey={metric} stroke="#6179f4" strokeWidth={2.2} fill={`url(#gradient-${widget.id})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : widget.kind === 'table' ? (
        <div className="widget-table-wrap">
          <table className="widget-table">
            <thead><tr><th>{axis === 'month' ? 'Month' : 'Channel'}</th><th>{metric}</th><th>Share</th></tr></thead>
            <tbody>{data.map((row) => (
              <tr key={String(row[axis])}><td>{row[axis]}</td><td>{formatMetric(Number(row[metric] ?? 0), metric)}</td><td>{value ? Math.round(Number(row[metric] ?? 0) / value * 100) : 0}%</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="widget-chart" role="img" aria-label={`${widget.title} ${widget.kind} chart showing ${metric} by ${axis}`}>
          <ResponsiveContainer width="100%" height="100%">
            {widget.kind === 'donut' ? (
              <PieChart>
                <Pie data={data} dataKey={metric} nameKey={axis} cx="50%" cy="50%" innerRadius="59%" outerRadius="80%" paddingAngle={3} stroke="none">
                  {data.map((row, index) => <Cell key={String(row[axis])} fill={palette[index % palette.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            ) : widget.kind === 'bar' ? (
              <BarChart data={data} margin={{ top: 6, right: 6, left: -17, bottom: 0 }}>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey={axis} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8a95a9' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8a95a9' }} width={48} />
                <Tooltip cursor={{ fill: '#f2f5fd' }} />
                <Bar dataKey={metric} radius={[6, 6, 0, 0]} maxBarSize={35} fill="#6179f4" />
              </BarChart>
            ) : widget.kind === 'line' ? (
              <LineChart data={data} margin={{ top: 8, right: 10, left: -17, bottom: 0 }}>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey={axis} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8a95a9' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8a95a9' }} width={48} />
                <Tooltip />
                <Line type="monotone" dataKey={metric} stroke="#6179f4" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            ) : (
              <AreaChart data={data} margin={{ top: 8, right: 10, left: -17, bottom: 0 }}>
                <defs><linearGradient id={`area-${widget.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6179f4" stopOpacity={0.27} /><stop offset="100%" stopColor="#6179f4" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey={axis} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8a95a9' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8a95a9' }} width={48} />
                <Tooltip />
                <Area type="monotone" dataKey={metric} stroke="#6179f4" strokeWidth={2.7} fill={`url(#area-${widget.id})`} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {widget.kind === 'donut' && <div className="donut-legend">
        {data.slice(0, 4).map((row, index) => <span key={String(row[axis])}><i style={{ background: palette[index] }} />{row[axis]}</span>)}
      </div>}
    </article>
  );
}
