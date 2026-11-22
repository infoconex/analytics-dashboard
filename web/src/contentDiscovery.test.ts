import { describe, expect, it } from 'vitest';
import { discoverDashboards, discoverVisualizations, savedDateLabel } from './contentDiscovery';
import type { Dashboard, SavedVisualization } from './model';

const dashboard = (id: string, name: string, organizationId = 'northstar', updatedAt = '2026-10-03T00:00:00Z'): Dashboard => ({
  id, organizationId, name, description: 'Sales conversion overview', widgets: [], revision: 1,
  createdBy: 'fictional-author', createdAt: '2026-01-01T00:00:00Z', updatedAt,
});
const template = (id: string, title: string, kind: SavedVisualization['definition']['kind'] = 'bar',
  organizationId = 'northstar', updatedAt = '2026-10-03T00:00:00Z'): SavedVisualization => ({
  id, organizationId, description: 'Revenue by market', revision: 1, createdBy: 'fictional-author',
  createdAt: '2026-01-01T00:00:00Z', updatedAt,
  definition: { id: 'chart-' + id, title, kind, datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' },
});

describe('authorized organization-scoped dashboard discovery', () => {
  it('matches case-insensitive query words across name and description and ignores extra whitespace', () => {
    expect(discoverDashboards([
      dashboard('a', 'April Enterprise'), dashboard('b', 'Customer retention'),
    ], 'northstar', '  APRIL   conversion  ', 'recent').map(item => item.id)).toEqual(['a']);
  });
  it('sorts recent and same-name results deterministically without changing the source', () => {
    const original = [
      dashboard('z', 'Sales 10', 'northstar', '2026-10-03T00:00:00Z'),
      dashboard('a', 'Sales 2', 'northstar', '2026-10-04T00:00:00Z'),
      dashboard('b', 'Sales 2', 'northstar', '2026-10-04T00:00:00Z'),
    ];
    expect(discoverDashboards(original, 'northstar', '', 'recent').map(item => item.id)).toEqual(['a', 'b', 'z']);
    expect(discoverDashboards(original, 'northstar', '', 'name-asc').map(item => item.id)).toEqual(['a', 'b', 'z']);
    expect(discoverDashboards(original, 'northstar', '', 'name-desc').map(item => item.id)).toEqual(['z', 'a', 'b']);
    expect(original.map(item => item.id)).toEqual(['z', 'a', 'b']);
  });
  it('never includes another tenant regardless of search or order', () => {
    const items = [dashboard('other', 'Important', 'isolated'), dashboard('own', 'Important')];
    expect(discoverDashboards(items, 'northstar', '', 'recent').map(item => item.id)).toEqual(['own']);
    expect(discoverDashboards(items, '', '', 'recent')).toEqual([]);
    expect(discoverDashboards(items, 'northstar', 'not-present', 'recent')).toEqual([]);
  });
});

describe('authorized reusable visualization discovery', () => {
  it('combines description search, type filtering and deterministic sorting', () => {
    const items = [
      template('a', 'Revenue 10', 'bar', 'northstar', '2026-10-04T00:00:00Z'),
      template('b', 'Revenue 2', 'donut', 'northstar', '2026-10-05T00:00:00Z'),
      template('c', 'Revenue 1', 'bar', 'northstar', '2026-10-06T00:00:00Z'),
    ];
    expect(discoverVisualizations(items, 'northstar', 'revenue market', 'bar', 'name-asc')
      .map(item => item.id)).toEqual(['c', 'a']);
    expect(discoverVisualizations(items, 'northstar', '', 'all', 'recent')
      .map(item => item.id)).toEqual(['c', 'b', 'a']);
    expect(items.map(item => item.id)).toEqual(['a', 'b', 'c']);
  });
  it('protects tenant boundary and empty results without changing templates', () => {
    const foreign = template('other', 'Revenue', 'bar', 'isolated');
    const own = template('own', 'Revenue');
    expect(discoverVisualizations([foreign, own], 'northstar', 'revenue', 'all', 'recent')).toEqual([own]);
    expect(discoverVisualizations([foreign], 'northstar', '', 'all', 'recent')).toEqual([]);
    expect(discoverVisualizations([own], 'northstar', '', 'donut', 'recent')).toEqual([]);
  });
  it('displays a stable UTC date, with a fallback for malformed server data', () => {
    expect(savedDateLabel('2026-11-21T23:45:00Z')).toBe('Nov 21, 2026');
    expect(savedDateLabel('invalid')).toBe('Unknown date');
  });
});
