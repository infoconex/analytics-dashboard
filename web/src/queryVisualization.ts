import type { DashboardWidget } from './model';
import { evaluateAuthoredQueryPreviews, validatePreviewDefinition, type FieldFilter, type QueryPreviewDefinition, type QueryPreviewOutcome } from './fieldFilterFixtures';
import type { UtcRange } from './reportingCalendar';

export interface QueryContext {
  filters: readonly FieldFilter[];
  range: UtcRange | null;
}

export function isQueryWidget(widget: DashboardWidget): boolean {
  return widget.datasetKey === 'fictionalQuery' || widget.queryDefinition != null;
}

/** A malformed saved definition must never be interpreted as another sample. */
export function queryWidgetProblem(widget: DashboardWidget): string | null {
  if (widget.datasetKey !== 'fictionalQuery' || widget.metricKey !== 'query' || widget.dimensionKey !== 'query'
    || widget.kind !== 'bar' || widget.appearance != null || !widget.queryDefinition) {
    return 'Unsupported saved fictional query definition. Choose an approved raw dataset and query shape to repair it.';
  }
  try { validatePreviewDefinition(widget.queryDefinition); }
  catch { return 'Unsupported saved fictional query definition. Choose an approved raw dataset and query shape to repair it.'; }
  return null;
}

/** Evaluate each independent dashboard copy, including multiple shapes over one dataset. */
export function evaluateQueryWidget(widget: DashboardWidget, context?: QueryContext): QueryPreviewOutcome | null {
  if (queryWidgetProblem(widget) || !widget.queryDefinition) return null;
  const definition = widget.queryDefinition;
  return evaluateAuthoredQueryPreviews(context?.filters ?? [], context?.range ?? null, [definition])
    .find(result => result.id === definition.dataset) ?? null;
}

export function queryDefinitionSnapshot(widget: DashboardWidget) {
  const query = widget.queryDefinition;
  return query ? { dataset: query.dataset, visualization: query.visualization, groupByDimension: query.groupByDimension,
    aggregate: query.aggregate, measureDimension: query.measureDimension ?? null } : null;
}

export function sameQueryDefinition(a: DashboardWidget, b: DashboardWidget): boolean {
  return JSON.stringify(queryDefinitionSnapshot(a)) === JSON.stringify(queryDefinitionSnapshot(b));
}

export function withQueryDefinition(widget: DashboardWidget, query: QueryPreviewDefinition): DashboardWidget {
  return { ...widget, kind: 'bar', datasetKey: 'fictionalQuery', metricKey: 'query', dimensionKey: 'query',
    columns: widget.columns === 3 ? 6 : widget.columns,
    height: widget.height != null && widget.height < 320 ? 320 : widget.height,
    appearance: undefined, queryDefinition: { ...query } };
}
