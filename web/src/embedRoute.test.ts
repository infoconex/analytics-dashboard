import { describe, expect, it } from 'vitest';
import { parseEmbedTarget } from './embedRoute';

const dashboard = 'a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441';

describe('embedded dashboard locator', () => {
  it('accepts only a single organization and GUID resource locator', () => {
    expect(parseEmbedTarget(`#/organization/northstar/dashboard/${dashboard}`))
      .toEqual({ organizationId: 'northstar', dashboardId: dashboard });
  });

  it.each([
    '', '#/explore', '#/settings', '#/organization/northstar/dashboard',
    `#/organization/northstar/dashboard/${dashboard}/edit`,
    `#/organization/northstar%2Fisolated/dashboard/${dashboard}`,
    `#/organization/%2e%2e/dashboard/${dashboard}`,
    `#/organization/%E0%A4%A/dashboard/${dashboard}`,
    `#/organization/northstar/dashboard/${dashboard}?token=secret`,
    `#/organization/northstar/dashboard/${dashboard}#another`,
    `#/organization/northstar/dashboard/${dashboard.replace('a8bb1bc7', '<script>')}`,
  ])('rejects unrecognized or unsafe locator %s', hash => {
    expect(parseEmbedTarget(hash)).toBeNull();
  });
});
