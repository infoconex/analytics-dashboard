import { describe, expect, it } from 'vitest';
import { defaultConsumerFilters } from './consumerFilters';
import { dashboardHandoffLink, dashboardHandoffNote, insightHandoffNote, viewingScope } from './insightHandoff';
import type { Dashboard } from './model';

const dashboard: Dashboard = {
  id: 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441', organizationId: 'northstar',
  name: 'Business performance', description: 'Fictional performance', revision: 1,
  createdBy: 'sample', createdAt: '2026-01-01', updatedAt: '2026-01-02', widgets: [
    { id: 'revenue', title: 'Revenue over time', kind: 'area', datasetKey: 'commerce', metricKey: 'revenue', dimensionKey: 'month' },
    { id: 'orders', title: 'Orders by channel', kind: 'bar', datasetKey: 'channels', metricKey: 'orders', dimensionKey: 'channel' },
  ],
};

describe('UX-10 insight handoff contract', () => {
  const link = dashboardHandoffLink('https://example.test', '/app', dashboard);

  it('links only to the existing organization-scoped saved dashboard route', () => {
    expect(link).toBe('https://example.test/app#/organization/northstar/dashboard/a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441');
    expect(link).not.toContain('?');
  });

  it('describes independent sample selection and states missing filters explicitly', () => {
    expect(viewingScope(defaultConsumerFilters, dashboard.widgets)).toEqual([
      'Commerce: All 12 sample months (year unspecified)',
      'Marketing channels: All channels (no dates)',
    ]);
    expect(viewingScope({ period: '3m', channel: 'Direct' }, dashboard.widgets)).toEqual([
      'Commerce: Final 3 sample months (year unspecified)',
      'Marketing channels: Direct (no dates)',
    ]);
    expect(viewingScope({ period: '3m', channel: 'Direct' }, dashboard.widgets.slice(0, 1))).toEqual([
      'Commerce: Final 3 sample months (year unspecified)',
    ]);
  });

  it('warns that a copied dashboard link never includes transient selections or access rights', () => {
    const note = dashboardHandoffNote(dashboard, 'Northstar Commerce', { period: '3m', channel: 'Direct' }, link);
    expect(note).toContain('Organization: Northstar Commerce');
    expect(note).toContain('Dashboard: Business performance');
    expect(note).toContain('Commerce: Final 3 sample months (year unspecified)');
    expect(note).toContain('Marketing channels: Direct (no dates)');
    expect(note).toContain('not preserved by this link');
    expect(note).toContain('requires authorization');
    expect(note).toContain(link);
    expect(note).not.toContain('2026-01-02');
  });

  it('includes UX-9 meaning, limitations, filter-aware coverage, and exact fictional chart values', () => {
    const note = insightHandoffNote(dashboard, 'Northstar Commerce', dashboard.widgets[0]!, { period: '3m', channel: 'Direct' }, link);
    expect(note).toContain('Visualization: Revenue over time');
    expect(note).toContain('Metric: Revenue (USD)');
    expect(note).toContain('Oct–Dec (3 fictional sample months; year unspecified)');
    expect(note).toContain('Oct: $41,400');
    expect(note).toContain('Dec: $48,300');
    expect(note).not.toContain('Jan: $18,400');
    expect(note).toContain('channel filter does not apply to commerce');
    expect(note).toContain('no customer data, live connection or refresh timestamp');
    expect(note).toContain('not preserved by this link');
  });

  it('refuses to fabricate unknown insight values and does not blend rates', () => {
    const unavailable = { ...dashboard.widgets[0]!, metricKey: 'missing' };
    expect(insightHandoffNote(dashboard, 'Northstar Commerce', unavailable, defaultConsumerFilters, link)).toBeNull();
    const rate = { ...dashboard.widgets[1]!, metricKey: 'conversion' };
    const note = insightHandoffNote({ ...dashboard, widgets: [rate] }, 'Northstar Commerce', rate, defaultConsumerFilters, link);
    expect(note).toContain('Direct: 5.4%');
    expect(note).toContain('Adding or averaging rates cannot establish a combined rate');
    expect(note).not.toContain('Total conversion:');
  });
});
