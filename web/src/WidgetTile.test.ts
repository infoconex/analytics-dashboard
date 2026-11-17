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

const channelDonut: DashboardWidget = {
  ...channelTable, id: 'b2222222-2222-4222-8222-222222222222',
  title: 'Traffic sources', kind: 'donut', metricKey: 'sessions',
};

describe('native dashboard data tables', () => {
  it('presents exact sample values under native row and column headers', () => {
    const html = renderToStaticMarkup(createElement(WidgetTile, {
      widget: channelTable, period: '12m', filters: defaultConsumerFilters, onChannelSelect: () => {},
    }));

    expect(html).toContain('<th scope="col">Orders (orders)</th>');
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
    expect(html).toContain('Show all channels instead of Direct');
    expect(html).toContain('aria-pressed="true"');
  });
});

describe('donut legend filter controls', () => {
  it('retains the selected channel identity in its accessible name', () => {
    const html = renderToStaticMarkup(createElement(WidgetTile, {
      widget: channelDonut, period: '12m',
      filters: { ...defaultConsumerFilters, channel: 'Direct' },
      onChannelSelect: () => {},
    }));

    expect(html).toContain('aria-label="Show all channels instead of Direct"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('aria-label="Show all channels"');
  });
});

describe('trustworthy interpretations', () => {
  it('provides optional metric definitions and static-sample provenance beside exact data', () => {
    const html = renderToStaticMarkup(createElement(WidgetTile, {
      widget: channelDonut, period: '12m', filters: defaultConsumerFilters,
    }));
    expect(html).toContain('What this means');
    expect(html).toContain('fictional');
    expect(html).toContain('Sessions');
    expect(html).toContain('View data table');
  });

  it('does not add conversion rates or report category ordering as time growth', () => {
    const html = renderToStaticMarkup(createElement(WidgetTile, {
      widget: { ...channelDonut, kind: 'metric', metricKey: 'conversion' }, period: '12m', filters: defaultConsumerFilters,
    }));
    expect(html).toContain('Combined rate unavailable');
    expect(html).not.toContain('21.3%');
    expect(html).not.toContain('across selected period');
  });

  it('discloses unavailable definitions instead of fabricating a zero', () => {
    const html = renderToStaticMarkup(createElement(WidgetTile, {
      widget: { ...channelDonut, metricKey: 'unsupported' }, period: '12m', filters: defaultConsumerFilters,
    }));
    expect(html).toContain('Insight unavailable');
    expect(html).not.toContain('Highest:');
    expect(html).not.toContain('View data table');
  });
});
