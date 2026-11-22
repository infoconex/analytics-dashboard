import type { Dashboard, SavedVisualization, WidgetKind } from './model';

export type DiscoveryOrder = 'recent' | 'name-asc' | 'name-desc';

/** A tolerant query for a small authorized organization catalog, not a cross-tenant search index. */
function terms(query: string): string[] {
  return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

function matchesQuery(values: readonly string[], query: readonly string[]): boolean {
  const text = values.join(' ').toLocaleLowerCase();
  return query.every(term => text.includes(term));
}

function dateValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
}

function ordered<T extends { id: string; updatedAt: string }>(
  items: readonly T[], order: DiscoveryOrder, name: (item: T) => string,
): T[] {
  return [...items].sort((left, right) => {
    const comparison = order === 'recent'
      ? dateValue(right.updatedAt) - dateValue(left.updatedAt)
      : order === 'name-asc' ? compareNames(name(left), name(right)) : compareNames(name(right), name(left));
    return comparison || compareNames(name(left), name(right)) || left.id.localeCompare(right.id);
  });
}

/** Never allow mismatched organization data into a discovery result, even if a stale response mixes scopes. */
export function discoverDashboards(
  items: readonly Dashboard[], organizationId: string, query: string, order: DiscoveryOrder,
): Dashboard[] {
  if (!organizationId) return [];
  const queryTerms = terms(query);
  return ordered(items.filter(item => item.organizationId === organizationId
    && matchesQuery([item.name, item.description], queryTerms)), order, item => item.name);
}

export function discoverVisualizations(
  items: readonly SavedVisualization[], organizationId: string, query: string,
  kind: WidgetKind | 'all', order: DiscoveryOrder,
): SavedVisualization[] {
  if (!organizationId) return [];
  const queryTerms = terms(query);
  return ordered(items.filter(item => item.organizationId === organizationId
    && (kind === 'all' || item.definition.kind === kind)
    && matchesQuery([item.definition.title, item.description], queryTerms)), order, item => item.definition.title);
}

/** Stable UTC label avoids server/client timezone differences around midnight. */
export function savedDateLabel(value: string): string {
  const date = dateValue(value);
  return date ? new Date(date).toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  }) : 'Unknown date';
}
