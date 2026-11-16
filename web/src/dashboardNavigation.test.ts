import { describe, expect, it } from 'vitest';
import { resolveNavigationSelection } from './dashboardNavigation';

const widgets = [{ id: 'first' }, { id: 'twelfth' }];

describe('dense dashboard navigation selection', () => {
  it('accepts an existing widget selected by its stable identifier', () => {
    expect(resolveNavigationSelection(widgets, 'twelfth')).toBe('twelfth');
  });

  it('refuses empty and removed selections without navigating to the wrong widget', () => {
    expect(resolveNavigationSelection(widgets, '')).toBeNull();
    expect(resolveNavigationSelection(widgets, 'removed')).toBeNull();
  });
});
