import { datasets } from './demoData';
import { selectConsumerRows, type ConsumerFilters } from './consumerFilters';
import type { DashboardWidget } from './model';
import { visualizationProblem } from './visualizationSemantics';

export type SampleAvailability =
  | { state: 'available' }
  | { state: 'no-match'; explanation: string }
  | { state: 'unavailable'; explanation: string };

/**
 * Local fictional sample data is synchronous. This intentionally does not
 * invent network loading, request failure, refresh times or per-card retries.
 * It must not mistake absent source rows for a measured zero.
 */
export function sampleAvailability(widget: DashboardWidget, filters: ConsumerFilters): SampleAvailability {
  const source = datasets[widget.datasetKey];
  if (!source) return {
    state: 'unavailable',
    explanation: 'This saved visualization uses a source unavailable in this sample viewer. An editor can choose a supported source.',
  };
  if (source.length === 0) return {
    state: 'unavailable',
    explanation: 'This sample source has no available records. Its values cannot be calculated.',
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
