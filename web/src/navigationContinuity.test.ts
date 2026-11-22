import { describe, expect, it } from 'vitest';
import { canRestoreCatalogReturn, readNavigationIndex, withNavigationIndex } from './navigationContinuity';

describe('UX-30 navigation continuity', () => {
  it('only accepts safe history entry indices and preserves other state keys', () => {
    expect(readNavigationIndex(null)).toBeNull();
    expect(readNavigationIndex({ __nexaNavigationIndex: -1 })).toBeNull();
    expect(readNavigationIndex({ __nexaNavigationIndex: '1' })).toBeNull();
    expect(readNavigationIndex({ __nexaNavigationIndex: Number.NaN })).toBeNull();
    expect(readNavigationIndex({ __nexaNavigationIndex: 3.5 })).toBeNull();
    expect(readNavigationIndex(withNavigationIndex({ anotherApp: 'keep' }, 4))).toBe(4);
    expect(withNavigationIndex({ anotherApp: 'keep' }, 4)).toEqual({
      anotherApp: 'keep', __nexaNavigationIndex: 4,
    });
  });

  it('restores only a still-authorized organization-local dashboard', () => {
    const point = { organizationId: 'northstar', dashboardId: 'one', scrollY: 400 };
    const items = [
      { id: 'one', organizationId: 'northstar' },
      { id: 'one', organizationId: 'isolated' },
    ];
    expect(canRestoreCatalogReturn(point, 'northstar', items)).toBe(true);
    expect(canRestoreCatalogReturn(point, 'isolated', items)).toBe(false);
    expect(canRestoreCatalogReturn(point, 'northstar', items.slice(1))).toBe(false);
    expect(canRestoreCatalogReturn(null, 'northstar', items)).toBe(false);
  });
});
