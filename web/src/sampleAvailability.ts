import { datasets, dimensions, metrics, visualizations } from './demoData';
import { selectConsumerRows, type ConsumerFilters } from './consumerFilters';
import type { DashboardWidget } from './model';
import { visualizationProblem } from './visualizationSemantics';

export type SampleAvailability =
  | { state: 'available' }
  | { state: 'no-match'; explanation: string }
  | { state: 'unavailable'; explanation: string };

export type SampleConfigurationField = 'dataset' | 'kind' | 'metric' | 'dimension';
export interface SampleConfigurationIssue {
  field: SampleConfigurationField;
  explanation: string;
}

/**
 * Diagnose the saved sample definition before applying viewer filters. A field
 * hint helps the existing editor without changing the underlying validation
 * or manufacturing a replacement field/dataset.
 */
export function sampleConfigurationIssue(widget: DashboardWidget): SampleConfigurationIssue | null {
  const source = datasets[widget.datasetKey];
  if (!source) return { field: 'dataset', explanation: 'This saved visualization uses a source unavailable in this sample viewer. Choose a supported fictional dataset to repair it.' };
  if (source.length === 0) return { field: 'dataset', explanation: 'This sample source has no available records. Its values cannot be calculated.' };
  if (!visualizations.some(item => item.key === widget.kind))
    return { field: 'kind', explanation: 'This saved visualization type is unsupported. Choose a supported chart type to repair it.' };
  if (!metrics[widget.datasetKey]?.some(item => item.key === widget.metricKey))
    return { field: 'metric', explanation: 'The saved metric is not supported for this fictional dataset. Choose a listed measure to repair it.' };

  const problem = visualizationProblem(widget, source);
  if (!problem) return null;
  const isDimension = widget.kind === 'scatter'
    ? widget.dimensionKey === widget.metricKey || !metrics[widget.datasetKey].some(item => item.key === widget.dimensionKey)
    : widget.dimensionKey !== dimensions[widget.datasetKey];
  return {
    field: isDimension ? 'dimension' : widget.kind === 'pie' || widget.kind === 'donut' ? 'kind' : 'metric',
    explanation: problem,
  };
}

/**
 * Local fictional sample data is synchronous. This intentionally does not
 * invent network loading, request failure, refresh times or per-card retries.
 * It must not mistake absent source rows for a measured zero.
 */
export function sampleAvailability(widget: DashboardWidget, filters: ConsumerFilters): SampleAvailability {
  const definitionProblem = sampleConfigurationIssue(widget);
  if (definitionProblem) return {
    state: 'unavailable',
    explanation: `${definitionProblem.explanation} An editor can review this visualization's saved configuration.`,
  };
  const rows = selectConsumerRows(widget.datasetKey, filters);
  if (rows.length === 0) return {
    state: 'no-match',
    explanation: filters.channel && widget.datasetKey === 'channels'
      ? 'No sample records match this channel. Remove the channel filter to see all channels.'
      : 'No sample records match the current selection.',
  };
  const problem = visualizationProblem(widget, rows);
  if (problem) return {
    state: 'unavailable',
    explanation: `${problem} An editor can review this visualization's saved configuration.`,
  };
  return { state: 'available' };
}

export function summarizeSampleAvailability(widgets: readonly DashboardWidget[], filters: ConsumerFilters) {
  const counts = { available: 0, noMatch: 0, unavailable: 0 };
  for (const widget of widgets) {
    const result = sampleAvailability(widget, filters);
    if (result.state === 'available') counts.available++;
    else if (result.state === 'no-match') counts.noMatch++;
    else counts.unavailable++;
  }
  return counts;
}
