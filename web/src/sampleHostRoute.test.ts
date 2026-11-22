import { describe, expect, it } from 'vitest';
import { isHostDashboard, parseHostView, sampleDashboard } from './sampleHostRoute';

describe('same-origin sample host navigation', () => {
  it('recognizes account, discovery and a shareable dashboard link', () => {
    expect(parseHostView('')).toEqual({ page: 'insights', dashboardId: null });
    expect(parseHostView('#analytics-section')).toEqual({ page: 'insights', dashboardId: null });
    expect(parseHostView('#account-summary')).toEqual({ page: 'account' });
    expect(parseHostView(`#insights/${sampleDashboard}`))
      .toEqual({ page: 'insights', dashboardId: sampleDashboard });
  });
  it.each(['#settings', '#insights/../settings', '#insights/nope',
    '#insights/%E0%A4%A', `#insights/${sampleDashboard}?role=owner`,
    '#insights/a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441/edit'])('rejects unrecognized host routes %s', hash => {
      expect(parseHostView(hash)).toBeNull();
    });
  it('only accepts organization-scoped, named GUID dashboards from API discovery', () => {
    expect(isHostDashboard({ id: sampleDashboard, name: 'Business performance', organizationId: 'northstar' })).toBe(true);
    expect(isHostDashboard({ id: sampleDashboard, name: 'Other', organizationId: 'isolated' })).toBe(false);
    expect(isHostDashboard({ id: '../../../', name: 'Bad', organizationId: 'northstar' })).toBe(false);
    expect(isHostDashboard({ id: sampleDashboard, name: '', organizationId: 'northstar' })).toBe(false);
  });
});
