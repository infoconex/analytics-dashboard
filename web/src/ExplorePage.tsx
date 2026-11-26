import { useState } from 'react';
import { ArrowRight, Check, Database, ShieldCheck } from 'lucide-react';
import { datasetOptions, dimensions, formatDetailedMetric, metrics, selectRows, visualizations } from './demoData';
import { WidgetTile } from './WidgetTile';
import type { DashboardWidget, DatasetKey, WidgetKind } from './model';
import { suggestedDimension, visualizationProblem } from './visualizationSemantics';

interface Props {
  canEdit: boolean;
  onCreate: (name: string, widget: DashboardWidget) => Promise<void>;
}

const datasetDescriptions: Record<DatasetKey, string> = {
  fictionalQuery: 'Raw records are authored in the dashboard visualization editor.',
  commerce: 'Revenue, orders, and customer activity across the year.',
  channels: 'Sessions, orders, and conversion across acquisition channels.',
};

function suggestedTitle(dataset: DatasetKey, metric: string, kind: WidgetKind, horizontal: string): string {
  const label = metrics[dataset].find(option => option.key === metric)?.label ?? 'Measure';
  const axis = metrics[dataset].find(option => option.key === horizontal)?.label ?? horizontal;
  return kind === 'scatter' ? `${label} versus ${axis}` : `${label} by ${dimensions[dataset]}`;
}

export function ExplorePage({ canEdit, onCreate }: Props) {
  const [datasetKey, setDatasetKey] = useState<DatasetKey>('commerce');
  const [metricKey, setMetricKey] = useState('revenue');
  const [kind, setKind] = useState<WidgetKind>('area');
  const [horizontalKey, setHorizontalKey] = useState(suggestedDimension('scatter', 'commerce', 'revenue'));
  const [period, setPeriod] = useState('12m');
  const [title, setTitle] = useState('Revenue by month');
  const [dashboardName, setDashboardName] = useState('My first insights');
  const [saving, setSaving] = useState(false);
  const rows = selectRows(datasetKey, period);
  const dimensionKey = dimensions[datasetKey];
  const defaultTitle = suggestedTitle(datasetKey, metricKey, kind, horizontalKey);
  const widget: DashboardWidget = { id: 'explore-preview', title: title.trim() || 'Untitled visualization', kind, datasetKey, metricKey,
    dimensionKey: kind === 'scatter' ? horizontalKey : dimensionKey };
  const problem = visualizationProblem(widget, rows);
  const horizontalLabel = metrics[datasetKey].find(option => option.key === horizontalKey)?.label ?? horizontalKey;

  function chooseDataset(next: DatasetKey) {
    setDatasetKey(next);
    const metric = metrics[next][0]?.key ?? 'orders';
    const horizontal = suggestedDimension('scatter', next, metric);
    setMetricKey(metric);
    setHorizontalKey(horizontal);
    setTitle(suggestedTitle(next, metric, kind, horizontal));
    setPeriod('12m');
  }

  function chooseMetric(next: string) {
    const horizontal = horizontalKey === next ? suggestedDimension('scatter', datasetKey, next) : horizontalKey;
    if (title === defaultTitle) {
      setTitle(suggestedTitle(datasetKey, next, kind, horizontal));
    }
    setMetricKey(next);
    setHorizontalKey(horizontal);
  }

  function chooseKind(next: WidgetKind) {
    if (title === defaultTitle) setTitle(suggestedTitle(datasetKey, metricKey, next, horizontalKey));
    setKind(next);
  }

  function chooseHorizontal(next: string) {
    if (title === defaultTitle) setTitle(suggestedTitle(datasetKey, metricKey, kind, next));
    setHorizontalKey(next);
  }

  async function save() {
    if (!canEdit || !dashboardName.trim() || !title.trim() || saving || problem) return;
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
        <label className="form-label">Chart type<select value={kind} onChange={event => chooseKind(event.target.value as WidgetKind)}>{visualizations.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
        {kind === 'scatter' && <label className="form-label">Horizontal measure<select value={horizontalKey} onChange={event => chooseHorizontal(event.target.value)}>{metrics[datasetKey].filter(option => option.key !== metricKey).map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>}
        {problem && <p role="alert" className="error-banner">{problem} Choose another measure or chart type.</p>}
        {datasetKey === 'commerce' && <label className="form-label">Preview sample months<select value={period} onChange={event => setPeriod(event.target.value)}><option value="12m">All 12 sample months</option><option value="6m">Final 6 sample months</option><option value="3m">Final 3 sample months</option></select><span className="explore-field-note">These fictional Jan–Dec months have no year. This changes the preview only; dashboard viewers control their own sample selection.</span></label>}
        <label className="form-label">Visualization title<input maxLength={100} value={title} onChange={event => setTitle(event.target.value)} /></label>
      </section>
      <section className="explore-results" aria-label="Live sample preview">
        <div className="explore-preview-heading"><div><div className="explore-step">03 / PREVIEW</div><h2>Your visualization</h2><p>Updates immediately as you make changes.</p></div><span className="demo-label">SAMPLE PREVIEW</span></div>
        <WidgetTile widget={widget} period={period} />
        <div className="explore-table"><h3>Underlying sample records <span>({rows.length})</span></h3><div className="explore-table-scroll" role="region" aria-label="Scrollable sample records" tabIndex={0}><table><thead><tr><th scope="col">{dimensionKey}</th>{kind === 'scatter' && <th scope="col">{horizontalLabel}</th>}<th scope="col">{metrics[datasetKey].find(option => option.key === metricKey)?.label ?? metricKey}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{row[dimensionKey]}</td>{kind === 'scatter' && <td>{formatDetailedMetric(Number(row[horizontalKey]), horizontalKey)}</td>}<td>{formatDetailedMetric(Number(row[metricKey]), metricKey)}</td></tr>)}</tbody></table></div></div>
        {canEdit ? <div className="explore-save"><div><div className="explore-step">04 / COMPOSE</div><h2>Make it a dashboard</h2><p>Create a saved dashboard with this visualization. You can add more later.</p></div><label className="form-label">Dashboard name<input maxLength={100} value={dashboardName} onChange={event => setDashboardName(event.target.value)} /></label><button className="button button-primary" disabled={saving || !dashboardName.trim() || !title.trim() || Boolean(problem)} onClick={() => void save()}>{saving ? 'Saving…' : 'Create dashboard'} <ArrowRight size={16} /></button></div>
          : <div className="explore-save"><h2>Ready to share your insight?</h2><p>Your organization role permits exploration only. Ask an editor to create dashboards.</p></div>}
      </section>
    </div>
  </div>;
}
