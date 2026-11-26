import { getQueryPreviewAuthoringOptions, queryFixtureOptions } from './fieldFilterFixtures';
import type { DashboardWidget } from './model';
import { queryWidgetProblem, withQueryDefinition } from './queryVisualization';

export function QueryVisualizationFields({ widget, onChange }: { widget: DashboardWidget; onChange: (widget: DashboardWidget) => void }) {
  const query = widget.queryDefinition;
  const options = query ? getQueryPreviewAuthoringOptions(query.dataset) : null;
  const valid = !queryWidgetProblem(widget);
  const chooseDataset = (dataset: string) => {
    const next = getQueryPreviewAuthoringOptions(dataset);
    if (next) onChange(withQueryDefinition(widget, next.defaultDefinition));
  };
  return <section className="visualization-data-fields" aria-label="Raw record query">
    <h2>Data and measures</h2>
    <p>Approved fictional records only. No customer connection or query execution is enabled.</p>
    <label className="form-label">Raw dataset<select className="query-source-select" value={valid ? query?.dataset : ''} onChange={event => chooseDataset(event.target.value)}>
      {!valid && <option value="">Choose a supported replacement</option>}
      {queryFixtureOptions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
    </select></label>
    {query && options && valid && <>
      <label className="form-label">Group by<select value={query.groupByDimension} onChange={event => onChange(withQueryDefinition(widget, { ...query, groupByDimension: event.target.value }))}>
        {options.groups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}
      </select></label>
      <label className="form-label">Aggregate<select value={query.aggregate} onChange={event => {
        if (event.target.value === 'count') onChange(withQueryDefinition(widget, { ...query, aggregate: 'count', measureDimension: undefined }));
        else if (options.sumMeasure) onChange(withQueryDefinition(widget, { ...query, aggregate: 'sum', measureDimension: options.sumMeasure.id }));
      }}>
        <option value="count">Count records</option>
        {options.sumMeasure && <option value="sum">Sum {options.sumMeasure.label}</option>}
      </select></label>
    </>}
  </section>;
}
