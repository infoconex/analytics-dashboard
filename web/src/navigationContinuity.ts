/** Browser-only navigation metadata. Never includes dashboard content or crosses organizations. */
export const navigationIndexKey = '__nexaNavigationIndex';

export function readNavigationIndex(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const index = (value as Record<string, unknown>)[navigationIndexKey];
  return typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 ? index : null;
}

export function withNavigationIndex(value: unknown, index: number): Record<string, unknown> {
  const previous = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { ...previous, [navigationIndexKey]: index };
}

/** A return point lives only in memory. Never share it between organization scopes. */
export interface CatalogReturnPoint {
  organizationId: string;
  dashboardId: string;
  scrollY: number;
}

export function canRestoreCatalogReturn(
  point: CatalogReturnPoint | null,
  organizationId: string,
  dashboards: ReadonlyArray<{ id: string; organizationId: string }>,
): point is CatalogReturnPoint {
  return Boolean(point && point.organizationId === organizationId
    && dashboards.some(item => item.organizationId === organizationId && item.id === point.dashboardId));
}
