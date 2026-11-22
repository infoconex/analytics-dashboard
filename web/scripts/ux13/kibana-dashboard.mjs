import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

export const dashboardId = 'ux13-northstar-business-performance';
export const titles = Array.from({ length: 12 }, (_, i) => i === 0
  ? 'Revenue over time' : i === 1 ? 'Orders by channel' : `Insight ${i + 1}`);

export function createComparisonDashboard() {
  const panels = titles.map((title, index) => {
    const channel = index === 1;
    // Two isolated ES|QL sources: no join and no manufactured observation dates.
    const query = channel
      ? 'FROM ux13-northstar-channels | STATS orders = SUM(orders) BY channel | SORT orders DESC'
      : 'FROM ux13-northstar-commerce | STATS revenue = SUM(revenue) BY month, monthOrdinal | SORT monthOrdinal';
    const layer = {
      type: channel ? 'bar' : 'area',
      data_source: { type: 'esql', query },
      x: { column: channel ? 'channel' : 'month' },
      y: [{ column: channel ? 'orders' : 'revenue' }],
    };
    return {
      grid: { x: index % 2 === 0 ? 0 : 24, y: Math.floor(index / 2) * 14, w: 24, h: 14 },
      type: 'vis', config: { type: 'xy', title, layers: [layer] },
    };
  });
  return {
    title: 'Business performance',
    description: 'Northstar Commerce — fictional, undated Jan–Dec monthly commerce and five undated marketing channels. USD revenue; channel conversion is illustrative. No distinct-customer inference or current-year claim.',
    panels,
  };
}

export function validateComparisonDashboard(dashboard) {
  assert.equal(dashboard.panels?.length, 12);
  assert.deepEqual(dashboard.panels.map(panel => panel.config.title), titles);
  assert.equal(dashboard.panels.filter(panel => panel.config.layers[0].data_source.query.includes('channels')).length, 1);
  assert.equal(dashboard.panels.filter(panel => panel.config.layers[0].data_source.query.includes('commerce')).length, 11);
  for (const panel of dashboard.panels) {
    assert.equal(panel.type, 'vis');
    assert.equal(panel.config.type, 'xy');
    assert.equal(panel.config.layers.length, 1);
    const query = panel.config.layers[0].data_source.query;
    assert.equal(/\bJOIN\b|@timestamp|\bDATE_\w+\b|20\d\d/i.test(query), false);
  }
}

export function dashboardDigest(dashboard) {
  return createHash('sha256').update(JSON.stringify(dashboard)).digest('hex');
}
