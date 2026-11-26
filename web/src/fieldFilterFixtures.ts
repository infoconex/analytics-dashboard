import type { UtcRange } from './reportingCalendar';

export type FieldValueType = 'text' | 'number' | 'boolean' | 'timestamp';
export type FieldFilterOperator = 'Equal' | 'NotEqual' | 'GreaterThan' | 'GreaterThanOrEqual'
  | 'LessThan' | 'LessThanOrEqual' | 'In' | 'IsNull' | 'IsNotNull' | 'Contains' | 'StartsWith';

export interface FieldFilter {
  dimension: string;
  type: FieldValueType;
  operator: FieldFilterOperator;
  values: Array<string | number | boolean>;
}

interface DimensionField {
  dimension: string;
  label: string;
  type: FieldValueType;
  physicalField: string;
  filterable: boolean;
}

export interface QueryPreviewDefinition {
  dataset: string;
  visualization: 'bar';
  groupByDimension: string;
  aggregate: 'sum' | 'count';
  measureDimension?: string;
}

interface Fixture {
  id: string;
  title: string;
  provider: 'SQL Server' | 'PostgreSQL' | 'Elasticsearch' | 'SQLite';
  measureField: string;
  measureLabel: string;
  query: QueryPreviewDefinition;
  reportingTimeField?: string;
  fields: DimensionField[];
  rows: ReadonlyArray<Readonly<Record<string, string | number | boolean | null>>>;
}

const relationalOperators: FieldFilterOperator[] = [
  'Equal', 'NotEqual', 'GreaterThan', 'GreaterThanOrEqual', 'LessThan', 'LessThanOrEqual',
  'In', 'IsNull', 'IsNotNull', 'Contains', 'StartsWith',
];
const commonOperators: FieldFilterOperator[] = [
  'Equal', 'NotEqual', 'GreaterThan', 'GreaterThanOrEqual', 'LessThan', 'LessThanOrEqual',
  'In', 'IsNull', 'IsNotNull',
];

const fixtures: Fixture[] = [
  {
    id: 'sales', title: 'Sales by account', provider: 'SQL Server', measureField: 'TotalAmount', measureLabel: 'revenue',
    query: { dataset: 'sales', visualization: 'bar', groupByDimension: 'order_status', aggregate: 'sum', measureDimension: 'amount' }, reportingTimeField: 'OrderedAt',
    fields: [
      { dimension: 'customer_id', label: 'Customer', type: 'text', physicalField: 'CustomerId', filterable: true },
      { dimension: 'order_status', label: 'Order status', type: 'text', physicalField: 'Status', filterable: true },
      { dimension: 'amount', label: 'Amount (USD)', type: 'number', physicalField: 'TotalAmount', filterable: true },
      { dimension: 'renewal_ready', label: 'Renewal ready', type: 'boolean', physicalField: 'RenewalReady', filterable: true },
      { dimension: 'ordered_at', label: 'Order time', type: 'timestamp', physicalField: 'OrderedAt', filterable: true },
      { dimension: 'service_tier', label: 'Service tier', type: 'text', physicalField: 'ServiceTier', filterable: true },
    ],
    rows: [
      { CustomerId: 'C-101', Status: 'Open', TotalAmount: 1200, RenewalReady: true, OrderedAt: '2026-11-02T10:00:00Z', ServiceTier: 'Gold' },
      { CustomerId: 'C-102', Status: 'Closed', TotalAmount: 800, RenewalReady: false, OrderedAt: '2026-11-10T12:30:00Z', ServiceTier: 'Silver' },
      { CustomerId: 'C-103', Status: 'Open', TotalAmount: 2400, RenewalReady: true, OrderedAt: '2026-11-18T08:15:00Z', ServiceTier: 'Gold' },
      { CustomerId: 'C-104', Status: 'Pending', TotalAmount: 500, RenewalReady: false, OrderedAt: '2026-11-22T16:00:00Z', ServiceTier: null },
    ],
  },
  {
    id: 'support', title: 'Support by account', provider: 'PostgreSQL', measureField: 'ticket_count', measureLabel: 'tickets',
    query: { dataset: 'support', visualization: 'bar', groupByDimension: 'order_status', aggregate: 'count' }, reportingTimeField: 'opened_at',
    fields: [
      { dimension: 'customer_id', label: 'Customer', type: 'text', physicalField: 'customer_id', filterable: true },
      { dimension: 'order_status', label: 'Ticket status', type: 'text', physicalField: 'ticket_status', filterable: true },
      { dimension: 'renewal_ready', label: 'Renewal ready', type: 'boolean', physicalField: 'renewal_ready', filterable: true },
      { dimension: 'ordered_at', label: 'Ticket opened', type: 'timestamp', physicalField: 'opened_at', filterable: true },
      { dimension: 'service_tier', label: 'Service tier', type: 'text', physicalField: 'service_tier', filterable: false },
    ],
    rows: [
      { customer_id: 'C-101', ticket_status: 'Open', ticket_count: 1, renewal_ready: true, opened_at: '2026-11-03T09:00:00Z', service_tier: 'Gold' },
      { customer_id: 'C-102', ticket_status: 'Resolved', ticket_count: 1, renewal_ready: false, opened_at: '2026-11-11T14:00:00Z', service_tier: 'Silver' },
      { customer_id: 'C-103', ticket_status: 'Open', ticket_count: 1, renewal_ready: true, opened_at: '2026-11-19T11:45:00Z', service_tier: 'Gold' },
      { customer_id: 'C-105', ticket_status: 'Pending', ticket_count: 1, renewal_ready: false, opened_at: '2026-11-23T13:10:00Z', service_tier: 'Bronze' },
    ],
  },
  {
    id: 'renewals', title: 'Renewals by account', provider: 'Elasticsearch', measureField: 'renewal.value', measureLabel: 'renewal value',
    query: { dataset: 'renewals', visualization: 'bar', groupByDimension: 'order_status', aggregate: 'sum', measureDimension: 'amount' }, reportingTimeField: 'renewal.date',
    fields: [
      // A deliberately incompatible typed mapping shows why semantic IDs alone are not enough.
      { dimension: 'customer_id', label: 'Customer', type: 'number', physicalField: 'customer.key', filterable: true },
      { dimension: 'order_status', label: 'Renewal status', type: 'text', physicalField: 'renewal.status', filterable: true },
      { dimension: 'amount', label: 'Amount (USD)', type: 'number', physicalField: 'renewal.value', filterable: true },
      { dimension: 'ordered_at', label: 'Renewal date', type: 'timestamp', physicalField: 'renewal.date', filterable: true },
    ],
    rows: [
      { 'customer.key': 101, 'renewal.status': 'Open', 'renewal.value': 1500, 'renewal.date': '2026-11-04T10:00:00Z' },
      { 'customer.key': 102, 'renewal.status': 'Closed', 'renewal.value': 700, 'renewal.date': '2026-11-12T10:00:00Z' },
      { 'customer.key': 103, 'renewal.status': 'Open', 'renewal.value': 1900, 'renewal.date': '2026-11-20T10:00:00Z' },
      { 'customer.key': 104, 'renewal.status': 'Pending', 'renewal.value': 400, 'renewal.date': '2026-11-24T10:00:00Z' },
    ],
  },
  {
    id: 'inventory', title: 'Inventory by category', provider: 'SQLite', measureField: 'stock_value', measureLabel: 'stock value',
    query: { dataset: 'inventory', visualization: 'bar', groupByDimension: 'category', aggregate: 'sum', measureDimension: 'stock_value' },
    fields: [
      { dimension: 'category', label: 'Product category', type: 'text', physicalField: 'category_name', filterable: true },
      { dimension: 'stock_value', label: 'Stock value', type: 'number', physicalField: 'stock_value', filterable: true },
    ],
    rows: [
      { category_name: 'Adapters', stock_value: 3200 },
      { category_name: 'Cables', stock_value: 900 },
      { category_name: 'Displays', stock_value: 5100 },
    ],
  },
];

const dimensionOrder = ['customer_id', 'order_status', 'amount', 'renewal_ready', 'ordered_at', 'service_tier', 'category', 'stock_value'];

export const fieldFilterDimensions = dimensionOrder.flatMap(dimension => {
  const fields = fixtures.flatMap(fixture => fixture.fields.filter(field => field.dimension === dimension && field.filterable));
  const first = fields[0];
  return first ? [{ id: dimension, label: first.label, type: first.type }] : [];
});

export const fieldFilterOperators: Record<FieldValueType, FieldFilterOperator[]> = {
  text: ['Equal', 'NotEqual', 'In', 'IsNull', 'IsNotNull', 'Contains', 'StartsWith'],
  number: ['Equal', 'NotEqual', 'GreaterThan', 'GreaterThanOrEqual', 'LessThan', 'LessThanOrEqual', 'In', 'IsNull', 'IsNotNull'],
  boolean: ['Equal', 'NotEqual', 'In', 'IsNull', 'IsNotNull'],
  timestamp: ['Equal', 'NotEqual', 'GreaterThan', 'GreaterThanOrEqual', 'LessThan', 'LessThanOrEqual', 'In', 'IsNull', 'IsNotNull'],
};

export const fieldFilterOperatorLabels: Record<FieldFilterOperator, string> = {
  Equal: 'is', NotEqual: 'is not', GreaterThan: 'is greater than', GreaterThanOrEqual: 'is at least',
  LessThan: 'is less than', LessThanOrEqual: 'is at most', In: 'is one of', IsNull: 'has no value',
  IsNotNull: 'has a value', Contains: 'contains', StartsWith: 'starts with',
};

export function parseFieldFilterValues(raw: string, type: FieldValueType, operator: FieldFilterOperator): Array<string | number | boolean> {
  if (operator === 'IsNull' || operator === 'IsNotNull') return [];
  const entries = operator === 'In' ? raw.split(/\r?\n/).map(value => value.trim()).filter(Boolean) : [raw.trim()];
  switch (type) {
    case 'number': return entries.map(value => value === '' ? Number.NaN : Number(value));
    case 'boolean': return entries.map(value => value === 'true');
    case 'timestamp': return entries.map(value => `${value}Z`);
    default: return entries;
  }
}

export interface FixtureOutcome {
  id: string;
  title: string;
  provider: Fixture['provider'];
  count: number;
  total: number;
  measureLabel: string;
  applied: string[];
  unapplied: Array<{ dimension: string; reason: 'NoApprovedMapping' | 'FieldNotFilterable' | 'IncompatibleType' | 'UnsupportedOperator' }>;
}

export interface QueryPreviewOutcome {
  id: string;
  title: string;
  provider: Fixture['provider'];
  query: Fixture['query'];
  count: number;
  groups: Array<{ label: string; value: number }>;
  applied: string[];
  unapplied: FixtureOutcome['unapplied'];
  calendar: 'Applied' | 'All time' | 'No approved reporting time';
}

function supportsOperator(provider: Fixture['provider'], operator: FieldFilterOperator) {
  return (provider === 'Elasticsearch' ? commonOperators : relationalOperators).includes(operator);
}

function matches(actual: string | number | boolean | null | undefined, filter: FieldFilter) {
  if (filter.operator === 'IsNull') return actual === null || actual === undefined;
  if (filter.operator === 'IsNotNull') return actual !== null && actual !== undefined;
  const expected = filter.values;
  if (actual === null || actual === undefined || expected.length === 0) return false;
  if (filter.operator === 'In') return expected.some(value => actual === value);
  const value = expected[0];
  if (value === undefined) return false;
  if (typeof actual !== typeof value) return false;
  switch (filter.operator) {
    case 'Equal': return actual === value;
    case 'NotEqual': return actual !== value;
    case 'GreaterThan': return typeof actual !== 'boolean' && typeof value !== 'boolean' && actual > value;
    case 'GreaterThanOrEqual': return typeof actual !== 'boolean' && typeof value !== 'boolean' && actual >= value;
    case 'LessThan': return typeof actual !== 'boolean' && typeof value !== 'boolean' && actual < value;
    case 'LessThanOrEqual': return typeof actual !== 'boolean' && typeof value !== 'boolean' && actual <= value;
    case 'Contains': return typeof actual === 'string' && typeof value === 'string' && actual.includes(value);
    case 'StartsWith': return typeof actual === 'string' && typeof value === 'string' && actual.startsWith(value);
    default: return false;
  }
}

export function evaluateFieldFilters(filters: readonly FieldFilter[]): FixtureOutcome[] {
  return fixtures.map(fixture => {
    const applicable: Array<{ filter: FieldFilter; field: DimensionField }> = [];
    const unapplied: FixtureOutcome['unapplied'] = [];
    for (const filter of filters) {
      const field = fixture.fields.find(candidate => candidate.dimension === filter.dimension);
      if (!field) unapplied.push({ dimension: filter.dimension, reason: 'NoApprovedMapping' });
      else if (!field.filterable) unapplied.push({ dimension: filter.dimension, reason: 'FieldNotFilterable' });
      else if (field.type !== filter.type) unapplied.push({ dimension: filter.dimension, reason: 'IncompatibleType' });
      else if (!supportsOperator(fixture.provider, filter.operator)) unapplied.push({ dimension: filter.dimension, reason: 'UnsupportedOperator' });
      else applicable.push({ filter, field });
    }
    const rows = fixture.rows.filter(row => applicable.every(({ filter, field }) => matches(row[field.physicalField], filter)));
    const metric = rows.reduce((sum, row) => sum + Number(row[fixture.measureField] ?? 0), 0);
    return {
      id: fixture.id, title: fixture.title, provider: fixture.provider, count: rows.length, total: metric, measureLabel: fixture.measureLabel,
      applied: applicable.map(({ filter }) => filter.dimension), unapplied,
    };
  });
}

/** Authoring options are derived from trusted fictional fixture metadata, never user identifiers. */
export function getQueryPreviewAuthoringOptions(dataset: string) {
  const fixture = fixtures.find(item => item.id === dataset);
  if (!fixture) return null;
  const groups = fixture.fields.filter(field => field.type === 'text' && field.filterable)
    .map(field => ({ id: field.dimension, label: field.label }));
  const measure = fixture.fields.find(field => field.dimension === fixture.query.measureDimension && field.type === 'number');
  return {
    groups,
    sumMeasure: measure ? { id: measure.dimension, label: measure.label } : null,
    defaultDefinition: { ...fixture.query },
  };
}

/** Reject unsupported shapes before evaluating any rows; never fall back to a different definition. */
function validatePreviewDefinition(definition: QueryPreviewDefinition) {
  const options = getQueryPreviewAuthoringOptions(definition.dataset);
  if (!options || definition.visualization !== 'bar'
    || !options.groups.some(group => group.id === definition.groupByDimension)
    || (definition.aggregate === 'count' ? definition.measureDimension !== undefined
      : definition.aggregate !== 'sum' || !options.sumMeasure || definition.measureDimension !== options.sumMeasure.id)) {
    throw new Error('Unsupported fictional query preview definition.');
  }
}

/**
 * In-memory execution of a small authored-query preview against the fixed
 * fictional provider fixtures. This mirrors filter planning order only; it is
 * neither a provider adapter nor a customer query execution path.
 */
export function evaluateAuthoredQueryPreviews(
  filters: readonly FieldFilter[], range: UtcRange | null,
  definitions: readonly QueryPreviewDefinition[] = [],
): QueryPreviewOutcome[] {
  const overrides = new Map<string, QueryPreviewDefinition>();
  for (const definition of definitions) {
    validatePreviewDefinition(definition);
    if (overrides.has(definition.dataset)) throw new Error('Duplicate fictional query preview definition.');
    overrides.set(definition.dataset, definition);
  }
  return fixtures.map(fixture => {
    const query = overrides.get(fixture.id) ?? fixture.query;
    const applicable: Array<{ filter: FieldFilter; field: DimensionField }> = [];
    const unapplied: FixtureOutcome['unapplied'] = [];
    for (const filter of filters) {
      const field = fixture.fields.find(candidate => candidate.dimension === filter.dimension);
      if (!field) unapplied.push({ dimension: filter.dimension, reason: 'NoApprovedMapping' });
      else if (!field.filterable) unapplied.push({ dimension: filter.dimension, reason: 'FieldNotFilterable' });
      else if (field.type !== filter.type) unapplied.push({ dimension: filter.dimension, reason: 'IncompatibleType' });
      else if (!supportsOperator(fixture.provider, filter.operator)) unapplied.push({ dimension: filter.dimension, reason: 'UnsupportedOperator' });
      else applicable.push({ filter, field });
    }

    const calendar = range === null ? 'All time' : fixture.reportingTimeField ? 'Applied' : 'No approved reporting time';
    const rows = fixture.rows.filter(row => {
      if (!applicable.every(({ filter, field }) => matches(row[field.physicalField], filter))) return false;
      if (!range || !fixture.reportingTimeField) return true;
      const timestamp = Date.parse(String(row[fixture.reportingTimeField] ?? ''));
      return Number.isFinite(timestamp) && timestamp >= Date.parse(range.start) && timestamp < Date.parse(range.end);
    });
    const groups = new Map<string, number>();
    const groupField = fixture.fields.find(field => field.dimension === query.groupByDimension);
    const measureField = query.measureDimension
      ? fixture.fields.find(field => field.dimension === query.measureDimension) : undefined;
    for (const row of rows) {
      const label = String(groupField ? row[groupField.physicalField] ?? '(no value)' : '(no approved group mapping)');
      const value = query.aggregate === 'count' ? 1 : Number(measureField ? row[measureField.physicalField] ?? 0 : 0);
      groups.set(label, (groups.get(label) ?? 0) + value);
    }
    return { id: fixture.id, title: fixture.title, provider: fixture.provider, query: { ...query },
      count: rows.length, groups: [...groups].map(([label, value]) => ({ label, value })),
      applied: applicable.map(({ filter }) => filter.dimension), unapplied, calendar };
  });
}

export function fieldFilterValueError(filter: FieldFilter) {
  if (!fieldFilterOperators[filter.type]?.includes(filter.operator)) return 'This comparison is not supported for the selected value type.';
  if (filter.operator === 'IsNull' || filter.operator === 'IsNotNull') return null;
  if (filter.values.length === 0) return 'Enter at least one value.';
  if (filter.values.length > 100) return 'Use at most 100 values.';
  if (filter.operator !== 'In' && filter.values.length !== 1) return 'This operator accepts one value.';
  for (const value of filter.values) {
    if (filter.type === 'text' && (typeof value !== 'string' || value.trim().length === 0 || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value))) return 'Enter valid text up to 256 characters.';
    if (filter.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) return 'Enter a finite number.';
    if (filter.type === 'boolean' && typeof value !== 'boolean') return 'Choose true or false.';
    if (filter.type === 'timestamp' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,7})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) return 'Enter a valid timestamp with an explicit UTC offset, such as 2026-11-16T12:30Z.';
  }
  return null;
}

export function getFieldFilterCapabilities(dimension: string) {
  const typed = fieldFilterDimensions.find(item => item.id === dimension);
  if (!typed) return { type: null, operators: [] as FieldFilterOperator[] };
  const mapped = fixtures.flatMap(fixture => fixture.fields
    .filter(field => field.dimension === dimension && field.filterable && field.type === typed.type)
    .map(field => ({ fixture, field })));
  const supported = new Set(mapped.flatMap(({ fixture, field }) => fieldFilterOperators[field.type]
    .filter(operator => supportsOperator(fixture.provider, operator))));
  return { type: typed.type, operators: fieldFilterOperators[typed.type].filter(operator => supported.has(operator)) };
}
