import { describe, expect, it } from 'vitest';
import { businessQuestions, findQuestionMatches, matchQuestion } from './dashboardDiscovery';
import type { Dashboard } from './model';

const dashboard = (id: string, organizationId: string, widgets: Dashboard['widgets']): Dashboard => ({
  id, organizationId, widgets, name: id, description: '', revision: 1,
  createdBy: 'fictional', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
});
const revenue = { id: 'rev', title: 'Sales progress', kind: 'area' as const,
  datasetKey: 'commerce' as const, metricKey: 'revenue', dimensionKey: 'month' };
const orders = { id: 'orders', title: 'Source orders', kind: 'bar' as const,
  datasetKey: 'channels' as const, metricKey: 'orders', dimensionKey: 'channel' };

describe('sample-only business question discovery', () => {
  it('offers three specific business questions with distinct metric/dataset contracts', () => {
    expect(businessQuestions.map(item => item.id)).toEqual(['revenue-trend', 'orders-channel', 'traffic-channel']);
    expect(new Set(businessQuestions.map(item => `${item.datasetKey}/${item.metricKey}`)).size).toBe(3);
  });

  it('finds a relevant visualization by its dataset and metric, regardless of dashboard title', () => {
    const choice = matchQuestion([dashboard('unexpected-name', 'northstar', [orders, revenue])], 'northstar', 'revenue-trend');
    expect(choice?.dashboard.id).toBe('unexpected-name');
    expect(choice?.widget.id).toBe('rev');
  });

  it('filters recommendations by authorized organization even if mixed-tenant data is supplied', () => {
    const foreign = dashboard('foreign', 'isolated', [revenue]);
    const own = dashboard('own', 'northstar', [revenue]);
    expect(findQuestionMatches([foreign, own], 'northstar', 'revenue-trend').map(item => item.dashboard.id)).toEqual(['own']);
    expect(matchQuestion([foreign], 'northstar', 'revenue-trend')).toBeNull();
  });

  it('rejects unmatched/unknown questions and does not guess from title or unsupported dimensions', () => {
    const wrongDimension = { ...revenue, dimensionKey: 'channel' };
    const titled = { ...dashboard('Revenue trending', 'northstar', [wrongDimension]), name: 'Revenue trending' };
    expect(matchQuestion([titled], 'northstar', 'revenue-trend')).toBeNull();
    expect(matchQuestion([dashboard('empty', 'northstar', [])], 'northstar', 'orders-channel')).toBeNull();
    expect(matchQuestion([dashboard('ready', 'northstar', [revenue])], 'northstar', 'untrusted')).toBeNull();
  });

  it('provides deterministic, non-mutating matches for catalog filtering', () => {
    const list = [dashboard('first', 'northstar', [revenue]), dashboard('second', 'northstar', [orders, revenue])];
    const matches = findQuestionMatches(list, 'northstar', 'revenue-trend');
    expect(matches.map(item => item.dashboard.id)).toEqual(['first', 'second']);
    expect(matches[1]?.widget.id).toBe('rev');
    expect(list.map(item => item.id)).toEqual(['first', 'second']);
  });

  it('prefers an explanatory chart over a metric tile for a revenue-trend starting point', () => {
    const total = { ...revenue, id: 'total', kind: 'metric' as const };
    const chosen = matchQuestion([dashboard('sales', 'northstar', [total, revenue])], 'northstar', 'revenue-trend');
    expect(chosen?.widget.id).toBe('rev');
  });

  it('recommends the most informative matching dashboard over an earlier one-chart draft', () => {
    const draft = dashboard('draft', 'northstar', [revenue]);
    const richer = dashboard('business-overview', 'northstar', [orders, revenue, {
      ...orders, id: 'traffic', metricKey: 'sessions', kind: 'donut',
    }]);
    expect(matchQuestion([draft, richer], 'northstar', 'revenue-trend')?.dashboard.id).toBe('business-overview');
  });
});
