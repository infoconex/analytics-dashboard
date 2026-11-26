import { chartInsight } from './chartInsights';
import { selectConsumerRows } from './consumerFilters';
import type { ConsumerFilters } from './consumerFilters';
import { formatDetailedMetric } from './demoData';
import type { Dashboard, DashboardWidget } from './model';
import { organizationHash } from './organizationRoute';
import { sampleMetricContext } from './sampleInterpretation';

const monthNames: Record<ConsumerFilters['period'], string> = {
  '3m': 'Final 3 sample months',
  '6m': 'Final 6 sample months',
  '12m': 'All 12 sample months',
};

/** The link is an existing saved-resource locator, never an authorization or filter-state token. */
export function dashboardHandoffLink(origin: string, pathname: string, dashboard: Dashboard): string {
  return `${origin}${pathname}${organizationHash(dashboard.organizationId, 'dashboards', dashboard.id)}`;
}

export function viewingScope(filters: ConsumerFilters, widgets: ReadonlyArray<DashboardWidget>): string[] {
  const scope: string[] = [];
  if (widgets.some(widget => widget.datasetKey === 'commerce')) {
    scope.push(`Commerce: ${monthNames[filters.period]} (year unspecified)`);
  }
  if (widgets.some(widget => widget.datasetKey === 'channels')) {
    scope.push(`Marketing channels: ${filters.channel ?? 'All channels'} (no dates)`);
  }
  return scope.length ? scope : ['No sample filters apply to this dashboard'];
}

const boundary = 'Temporary filters, selected visualizations, expanded explanations and data tables are not preserved by this link. Recipients open the latest authorized saved dashboard revision with default filters; the link does not pin a revision or grant organization access, and viewing still requires authorization for the organization.';
const revisionBoundary = 'This note records the sender’s displayed saved revision and viewing context, not a live or automatically updated report. The link may open a newer saved revision.';

export function dashboardHandoffNote(dashboard: Dashboard, organizationName: string, filters: ConsumerFilters, link: string): string {
  return [
    'Dashboard handoff — deterministic fictional sample data, not live customer activity',
    `Organization: ${organizationName}`,
    `Dashboard: ${dashboard.name}`,
    `Saved revision shown to sender: ${dashboard.revision}`,
    revisionBoundary,
    'Viewing selections at the time this note was copied (commerce and channel filters apply independently):',
    ...viewingScope(filters, dashboard.widgets).map(item => `- ${item}`),
    'Sample records have no refresh timestamp; the dashboard save date is not data freshness.',
    boundary,
    `Open saved dashboard: ${link}`,
  ].join('\n');
}

export function insightHandoffNote(dashboard: Dashboard, organizationName: string, widget: DashboardWidget, filters: ConsumerFilters, link: string): string | null {
  if (widget.datasetKey === 'fictionalQuery' || widget.queryDefinition) return null;
  // Only describe a visualization that actually belongs to this authorized dashboard.
  if (!dashboard.widgets.some(item => item.id === widget.id && item.datasetKey === widget.datasetKey
    && item.metricKey === widget.metricKey && item.dimensionKey === widget.dimensionKey)) return null;
  const rows = selectConsumerRows(widget.datasetKey, filters);
  const context = sampleMetricContext(widget.datasetKey, widget.metricKey, widget.dimensionKey, rows, filters);
  if (!context) return null;
  const atAGlance = widget.kind !== 'metric' && widget.kind !== 'table'
    ? chartInsight(widget.dimensionKey, widget.metricKey, rows) : null;
  const exact = rows.map(row => `${String(row[widget.dimensionKey])}: ${formatDetailedMetric(Number(row[widget.metricKey]), widget.metricKey)}`);

  return [
    'Insight snapshot — deterministic fictional sample data (copied viewing context, not a saved view)',
    `Organization: ${organizationName}`,
    `Dashboard: ${dashboard.name}`,
    `Saved revision shown to sender: ${dashboard.revision}`,
    revisionBoundary,
    `Visualization: ${widget.title}`,
    `Metric: ${context.label} (${context.unit})`,
    `Coverage: ${context.coverage}`,
    `Selected view: ${viewingScope(filters, dashboard.widgets).join('; ')}`,
    `Filter applicability: ${context.filterScope}`,
    ...(atAGlance ? [`At a glance: ${atAGlance}`] : []),
    'Exact supporting sample values:',
    ...exact.map(item => `- ${item}`),
    `Meaning: ${context.meaning}`,
    `Source: ${context.provenance}`,
    `Limits: ${context.limitation} This cannot establish causation, significance or current customer performance.`,
    boundary,
    `Open saved dashboard: ${link}`,
  ].join('\n');
}
