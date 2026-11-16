import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultConsumerFilters } from './consumerFilters';
import type { DashboardWidget } from './model';
import { WidgetTile } from './WidgetTile';

const channelTable: DashboardWidget = {
  id: 'b1111111-1111-4111-8111-111111111111',
  title: 'Channel details — regional',
  kind: 'table', datasetKey: 'channels', metricKey: 'orders', dimensionKey: 'channel',
};

describe('native dashboard data tables', () => {
  it('presents exact sample values under native row and column headers', () => {
    const html = renderToStaticMarkup(createElement(WidgetTile, {
      widget: channelTable, period: '12m', filters: defaultConsumerFilters, onChannelSelect: () => {},
    }));

    expect(html).toContain('<th scope="col">orders</th>');
    expect(html).toContain('Organic search');
    expect(html).toContain('1,820');
    expect(html).toContain('1,530');
    expect(html).not.toContain('1.8K');
    expect(html).not.toContain('1.5K');
  });

  it('preserves exact counts after a channel filter', () => {
    const html = renderToStaticMarkup(createElement(WidgetTile, {
      widget: channelTable, period: '12m', filters: { ...defaultConsumerFilters, channel: 'Direct' },
      onChannelSelect: () => {},
    }));

    expect(html).toContain('1,530');
    expect(html).not.toContain('1.5K');
    expect(html).not.toContain('Organic search');
  });
});
