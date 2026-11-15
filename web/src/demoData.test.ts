import { describe, expect, it } from 'vitest';
import { createWidget, formatMetric, selectRows } from './demoData';

describe('sample analytics', () => {
  it('filters commerce observations to the selected period', () => {
    expect(selectRows('commerce', '3m')).toHaveLength(3);
    expect(selectRows('commerce', '6m')).toHaveLength(6);
    expect(selectRows('commerce', '12m')).toHaveLength(12);
    expect(selectRows('channels', '3m')).toHaveLength(5);
  });

  it('gracefully handles a saved widget whose dataset is not available in demo mode', () => {
    expect(selectRows('future_connector' as 'commerce', '12m')).toEqual([]);
  });

  it('formats amounts and conversion percentages', () => {
    expect(formatMetric(12500, 'revenue')).toBe('$12.5K');
    expect(formatMetric(4.75, 'conversion')).toBe('4.8%');
  });

  it('creates unique visualizations with valid default fields', () => {
    const first = createWidget();
    const second = createWidget('table');

    expect(first.id).not.toBe(second.id);
    expect(first.datasetKey).toBe('commerce');
    expect(second.kind).toBe('table');
  });
});
