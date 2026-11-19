import { AreaChart, BarChart3, ChartLine, ChartPie, ChartScatter, CircleDot, Hash, Table2 } from 'lucide-react';
import { visualizations } from './demoData';
import type { WidgetKind } from './model';

const chartIcons = { metric: Hash, area: AreaChart, line: ChartLine, bar: BarChart3, donut: CircleDot,
  pie: ChartPie, histogram: BarChart3, scatter: ChartScatter, table: Table2 };
const descriptions: Record<WidgetKind, string> = {
  metric: 'One important number', area: 'Volume over time', line: 'Changes and trends',
  bar: 'Compare categories', donut: 'Share of the whole', table: 'Detailed values',
  pie: 'Show parts of a total', histogram: 'Distribution of values', scatter: 'Compare two measures',
};

export function VisualizationGallery({ kind, onSelect }: { kind: WidgetKind; onSelect: (kind: WidgetKind) => void }) {
  return <fieldset className="gallery-fieldset"><legend>Choose a visualization</legend><div className="visualization-gallery">
    {visualizations.map(item => { const Icon = chartIcons[item.key]; return <button
      key={item.key} type="button" aria-pressed={kind === item.key}
      className={`gallery-card ${kind === item.key ? 'gallery-selected' : ''}`}
      onClick={() => onSelect(item.key)}>
      <Icon size={25} aria-hidden="true" /><strong>{item.label}</strong><small>{descriptions[item.key]}</small>
    </button>; })}
  </div></fieldset>;
}
