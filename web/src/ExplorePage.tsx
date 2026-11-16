import { useState } from 'react';
import { ArrowRight, Check, Database, ShieldCheck } from 'lucide-react';
import { datasetOptions, dimensions, formatMetric, metrics, selectRows, visualizations } from './demoData';
import { WidgetTile } from './WidgetTile';
import type { DashboardWidget, DatasetKey, WidgetKind } from './model';

interface Props {
  canEdit: boolean;
  onCreate: (name: string, widget: DashboardWidget) => Promise<void>;
}

const datasetDescriptions: Record<DatasetKey, string> = {
  commerce: 'Revenue, orders, and customer activity across the year.',
  channels: 'Sessions, orders, and conversion across acquisition channels.',
};

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
  const defaultTitle = `${metrics[datasetKey].find(option => option.key === metricKey)?.label ?? 'Measure'} by ${dimensionKey}`;
  const widget: DashboardWidget = { id: 'explore-preview', title: title.trim() || 'Untitled visualization', kind, datasetKey, metricKey, dimensionKey };

  function chooseDataset(next: DatasetKey) {
    setDatasetKey(next);
    setMetricKey(metrics[next][0]?.key ?? 'orders');
    setTitle(`${metrics[next][0]?.label ?? 'Measure'} by ${dimensions[next]}`);
    setPeriod('12m');
  }

  function chooseMetric(next: string) {
    if (title === defaultTitle) {
      setTitle(`${metrics[datasetKey].find(option => option.key === next)?.label ?? 'Measure'} by ${dimensionKey}`);
    }
    setMetricKey(next);
  }

  async function save() {
    if (!canEdit || !dashboardName.trim() || !title.trim() || saving) return;
    setSaving(true);
    try { await onCreate(dashboardName.trim(), { ...widget, id: crypto.randomUUID() }); }
    catch { /* The application shell displays the sanitized API error. */ }
    finally { setSaving(false); }
  }

  return <div className="explore-page">
    <div className="page-heading"><div><div className="eyebrow">EXPLORE / SAMPLE WORKSPACE</div><h1>Turn data into a story.</h1><p>Choose a dataset, shape your visualization, and add it to a dashboard. No SQL required.</p></div></div>
    <div className="explore-notice"><ShieldCheck size={18} aria-hidden="true" /><span><strong>Sample data only.</strong> These built-in datasets are not connected to customer databases. Live queries remain disabled.</span></div>
    <div className="explore-grid">
      <section className="explore-panel" aria-label="Visualization settings">
        <div className="explore-step">01 / CHOOSE DATA</div><h2>What would you like to explore?</h2>
        <div className="explore-datasets" role="group" aria-label="Choose a sample dataset">
          {datasetOptions.map(option => <button key={option.key} type="button" className={`explore-dataset ${datasetKey === option.key ? 'explore-dataset-active' : ''}`} aria-pressed={datasetKey === option.key} onClick={() => chooseDataset(option.key)}>
            <span className="explore-dataset-icon"><Database size={19} aria-hidden="true" /></span>
            <span className="explore-dataset-copy"><strong>{option.label}</strong><small>{datasetDescriptions[option.key]}</small><em>{selectRows(option.key, '12m').length} sample records</em></span>
            {datasetKey === option.key && <Check size={17} className="explore-dataset-check" aria-hidden="true" />}
          </button>)}
        </div>
        <p className="explore-hint">Explore by {dimensionKey}. All values are deterministic sample data.</p>
        <div className="explore-step">02 / VISUALIZE</div><h2>Make it meaningful</h2>
        <label className="form-label">Measure<select value={metricKey} onChange={event => chooseMetric(event.target.value)}>{metrics[datasetKey].map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
        <label className="form-label">Chart type<select value={kind} onChange={event => setKind(event.target.value as WidgetKind)}>{visualizations.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
        {datasetKey === 'commerce' && <label className="form-label">Preview date range<select value={period} onChange={event => setPeriod(event.target.value)}><option value="12m">Last 12 months</option><option value="6m">Last 6 months</option><option value="3m">Last 3 months</option></select><span className="explore-field-note">This changes the preview only. Dashboard viewers control their own date range.</span></label>}
        <label className="form-label">Visualization title<input maxLength={100} value={title} onChange={event => setTitle(event.target.value)} /></label>
      </section>
      <section className="explore-results" aria-label="Live sample preview">
        <div className="explore-preview-heading"><div><div className="explore-step">03 / PREVIEW</div><h2>Your visualization</h2><p>Updates immediately as you make changes.</p></div><span className="demo-label">SAMPLE PREVIEW</span></div>
        <WidgetTile widget={widget} period={period} />
        <div className="explore-table"><h3>Underlying sample records <span>({rows.length})</span></h3><div className="explore-table-scroll" role="region" aria-label="Scrollable sample records" tabIndex={0}><table><thead><tr><th scope="col">{dimensionKey}</th><th scope="col">{metrics[datasetKey].find(option => option.key === metricKey)?.label ?? metricKey}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{row[dimensionKey]}</td><td>{formatMetric(Number(row[metricKey] ?? 0), metricKey)}</td></tr>)}</tbody></table></div></div>
        {canEdit ? <div className="explore-save"><div><div className="explore-step">04 / COMPOSE</div><h2>Make it a dashboard</h2><p>Create a saved dashboard with this visualization. You can add more later.</p></div><label className="form-label">Dashboard name<input maxLength={100} value={dashboardName} onChange={event => setDashboardName(event.target.value)} /></label><button className="button button-primary" disabled={saving || !dashboardName.trim() || !title.trim()} onClick={() => void save()}>{saving ? 'Saving…' : 'Create dashboard'} <ArrowRight size={16} /></button></div>
          : <div className="explore-save"><h2>Ready to share your insight?</h2><p>Your organization role permits exploration only. Ask an editor to create dashboards.</p></div>}
      </section>
    </div>
  </div>;
}
