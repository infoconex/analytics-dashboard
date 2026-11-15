import { useState } from 'react';
import { ArrowRight, Database, ShieldCheck } from 'lucide-react';
import { datasetOptions, dimensions, metrics, selectRows, visualizations } from './demoData';
import { WidgetTile } from './WidgetTile';
import type { DashboardWidget, DatasetKey, WidgetKind } from './model';

interface Props {
  canEdit: boolean;
  onCreate: (name: string, widget: DashboardWidget) => Promise<void>;
}

export function ExplorePage({ canEdit, onCreate }: Props) {
  const [datasetKey, setDatasetKey] = useState<DatasetKey>('commerce');
  const [metricKey, setMetricKey] = useState('revenue');
  const [kind, setKind] = useState<WidgetKind>('area');
  const [period, setPeriod] = useState('12m');
  const [title, setTitle] = useState('Revenue by month');
  const [dashboardName, setDashboardName] = useState('My first insights');
  const [saving, setSaving] = useState(false);
  const rows = selectRows(datasetKey, period);
  const dimensionKey = dimensions[datasetKey];
  const widget: DashboardWidget = { id: 'explore-preview', title: title.trim() || 'Untitled visualization', kind, datasetKey, metricKey, dimensionKey };

  async function save() {
    if (!canEdit || !dashboardName.trim() || !title.trim() || saving) return;
    setSaving(true);
    try { await onCreate(dashboardName.trim(), { ...widget, id: crypto.randomUUID() }); }
    finally { setSaving(false); }
  }

  return <div className="explore-page">
    <div className="page-heading"><div><div className="eyebrow">EXPLORE / SAMPLE WORKSPACE</div><h1>Turn data into a story.</h1><p>Choose a dataset, shape your visualization, and add it to a dashboard. No SQL required.</p></div></div>
    <div className="explore-notice"><ShieldCheck size={18} aria-hidden="true" /><span><strong>Sample data only.</strong> These built-in datasets are not connected to customer databases. Live queries remain disabled.</span></div>
    <div className="explore-grid">
      <section className="explore-panel" aria-label="Visualization settings">
        <div className="explore-step">01 / CHOOSE DATA</div><h2>What would you like to explore?</h2>
        <label className="form-label">Sample dataset<select value={datasetKey} onChange={event => { const next = event.target.value as DatasetKey; setDatasetKey(next); setMetricKey(metrics[next][0].key); setTitle(metrics[next][0].label + ' by ' + dimensions[next]); setPeriod('12m'); }}>
          {datasetOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select></label>
        <p className="explore-hint"><Database size={14} aria-hidden="true" /> {rows.length} sample records · Dimension: {dimensionKey}</p>
        <div className="explore-step">02 / VISUALIZE</div><h2>Make it meaningful</h2>
        <label className="form-label">Measure<select value={metricKey} onChange={event => setMetricKey(event.target.value)}>{metrics[datasetKey].map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
        <label className="form-label">Chart type<select value={kind} onChange={event => setKind(event.target.value as WidgetKind)}>{visualizations.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
        {datasetKey === 'commerce' && <label className="form-label">Date range<select value={period} onChange={event => setPeriod(event.target.value)}><option value="12m">Last 12 months</option><option value="6m">Last 6 months</option><option value="3m">Last 3 months</option></select></label>}
        <label className="form-label">Visualization title<input maxLength={100} value={title} onChange={event => setTitle(event.target.value)} /></label>
      </section>
      <section className="explore-results" aria-label="Live sample preview">
        <div className="explore-preview-heading"><div><div className="explore-step">03 / PREVIEW</div><h2>Your visualization</h2><p>Updates immediately as you make changes.</p></div><span className="demo-label">SAMPLE PREVIEW</span></div>
        <WidgetTile widget={widget} period={period} />
        <div className="explore-table"><h3>Underlying sample records</h3><div className="explore-table-scroll"><table><thead><tr><th scope="col">{dimensionKey}</th><th scope="col">{metricKey}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{row[dimensionKey]}</td><td>{row[metricKey]}</td></tr>)}</tbody></table></div></div>
        {canEdit ? <div className="explore-save"><div><div className="explore-step">04 / COMPOSE</div><h2>Make it a dashboard</h2><p>Create a saved dashboard with this visualization. You can add more later.</p></div><label className="form-label">Dashboard name<input maxLength={100} value={dashboardName} onChange={event => setDashboardName(event.target.value)} /></label><button className="button button-primary" disabled={saving || !dashboardName.trim() || !title.trim()} onClick={() => void save()}>{saving ? 'Saving…' : 'Create dashboard'} <ArrowRight size={16} /></button></div>
          : <div className="explore-save"><h2>Ready to share your insight?</h2><p>Your organization role permits exploration only. Ask an editor to create dashboards.</p></div>}
      </section>
    </div>
  </div>;
}
