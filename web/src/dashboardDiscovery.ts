import type { Dashboard, DashboardWidget, DatasetKey } from './model';

export interface BusinessQuestion {
  id: string;
  question: string;
  description: string;
  datasetKey: DatasetKey;
  metricKey: string;
  dimensionKey: string;
}

// These describe fictional, built-in sample datasets. A production data catalog
// must never infer available customer data from these demonstration questions.
export const businessQuestions: readonly BusinessQuestion[] = [
  { id: 'revenue-trend', question: 'How is revenue changing?',
    description: 'Compare revenue across months and time ranges.',
    datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' },
  { id: 'orders-channel', question: 'Where are orders coming from?',
    description: 'See which marketing channels contribute orders.',
    datasetKey: 'channels', metricKey: 'orders', dimensionKey: 'channel' },
  { id: 'traffic-channel', question: 'Which channels bring visitors?',
    description: 'Understand the mix of sample traffic sources.',
    datasetKey: 'channels', metricKey: 'sessions', dimensionKey: 'channel' },
] as const;

export interface QuestionMatch {
  dashboard: Dashboard;
  widget: DashboardWidget;
}

export function findQuestionMatches(dashboards: readonly Dashboard[], organizationId: string, questionId: string): QuestionMatch[] {
  const question = businessQuestions.find(item => item.id === questionId);
  if (!question || !organizationId) return [];
  return dashboards.flatMap(dashboard => {
    // Defense in depth: even malformed or stale client data cannot be promoted
    // into a recommendation for another organization's dashboard.
    if (dashboard.organizationId !== organizationId) return [];
    const candidates = dashboard.widgets.filter(item => item.datasetKey === question.datasetKey
      && item.metricKey === question.metricKey && item.dimensionKey === question.dimensionKey);
    // For an explanatory first stop, prefer a chart over an aggregate tile or
    // table, without reordering or mutating the saved dashboard composition.
    const preferred = questionId === 'revenue-trend' ? ['area', 'line', 'bar']
      : questionId === 'orders-channel' ? ['bar', 'donut'] : ['donut', 'bar'];
    const widget = preferred.map(kind => candidates.find(item => item.kind === kind)).find(Boolean) ?? candidates[0];
    return widget ? [{ dashboard, widget }] : [];
  });
}

export function matchQuestion(dashboards: readonly Dashboard[], organizationId: string, questionId: string): QuestionMatch | null {
  const matches = findQuestionMatches(dashboards, organizationId, questionId);
  // A richer sample overview is usually a better first-use destination than
  // an incidental one-chart draft created during another task. Keep API order
  // as the deterministic tie-breaker; never widen the organization scope.
  return matches.reduce<QuestionMatch | null>((best, item) =>
    !best || item.dashboard.widgets.length > best.dashboard.widgets.length ? item : best, null);
}
