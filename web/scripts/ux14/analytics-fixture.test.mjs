import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titles } from '../ux13/kibana-dashboard.mjs';
import { dashboardId, fixtureDashboard, assertNoApiWrites } from './analytics-fixture.mjs';

test('the Analytics UX14 target has the exact UX11 fictional viewer contract and matched panel order', () => {
  assert.equal(dashboardId, 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441');
  assert.equal(fixtureDashboard.organizationId, 'northstar');
  assert.equal(fixtureDashboard.widgets.length, 12);
  assert.deepEqual(fixtureDashboard.widgets.map(widget => widget.title), titles);
  assert.equal(fixtureDashboard.widgets.filter(widget => widget.datasetKey === 'channels').length, 1);
  assert.equal(fixtureDashboard.widgets.filter(widget => widget.datasetKey === 'commerce').length, 11);
  assert.equal(fixtureDashboard.widgets[11].id, '996e3063-18e9-4ddb-887a-229198c6dd12');
});

test('blocked external resources are separate from write attempts, and API writes fail closed', () => {
  assert.doesNotThrow(() => assertNoApiWrites([{ type: 'external-network-blocked' }]));
  assert.throws(() => assertNoApiWrites([{ type: 'external-network-blocked' },
    { type: 'write-refused', method: 'POST', path: '/api/dashboards' }]), /POST \/api\/dashboards/);
});
