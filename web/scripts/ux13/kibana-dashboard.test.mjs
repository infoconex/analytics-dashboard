import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createComparisonDashboard, validateComparisonDashboard, dashboardDigest } from './kibana-dashboard.mjs';

it('builds 12 title/order-matched fictional charts without crossing data sets or inventing timestamps', () => {
  const definition = createComparisonDashboard();
  validateComparisonDashboard(definition);
  assert.equal(definition.panels[0].config.title, 'Revenue over time');
  assert.equal(definition.panels[11].config.title, 'Insight 12');
  assert.match(definition.description, /fictional/);
  assert.equal(dashboardDigest(definition), dashboardDigest(createComparisonDashboard()));
});
