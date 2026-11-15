# Restricted query contracts (Issue #8)

**Validation only; no queries run.** The API does not compile SQL or Elasticsearch DSL,
contact customer systems, inspect schemas, or return rows. Registrations remain
metadata-only. The production dataset allowlist is intentionally empty; even a valid
query shape returns 400 until trusted dataset metadata is provisioned in a future issue.
The `executable` response property is always `false`.

## API contract

`POST /api/organizations/{organizationId}/data-sources/{id}/queries/validate`

The server checks the authenticated caller's membership **before** the tenant-owned
registration and **before** consulting the trusted dataset allowlist. An authorized
member (including viewer) receives 404 for a nonexistent registration; a nonmember
receives 403 even if a guessed registration exists. Unknown datasets/fields receive 400.

Illustrative request (not currently executable or accepted by the empty catalog):

```json
{
  "dataset": "sales",
  "projection": ["region"],
  "filters": [{ "field": "amount", "operator": "greaterThan", "values": [
    { "type": "number", "number": 100 }
  ] }],
  "groupBy": ["region"],
  "aggregates": [{ "alias": "total", "function": "sum", "field": "amount" }],
  "sort": [{ "field": "total", "direction": "descending" }],
  "limit": 100,
  "offset": 0
}
```

Given a synthetic trusted `sales` schema, validation returns an envelope like:

```json
{
  "dataset": "sales",
  "provider": "sqlite",
  "columns": [
    { "name": "region", "type": "text" },
    { "name": "total", "type": "number" }
  ],
  "limit": 100,
  "offset": 0,
  "complexity": 13,
  "budget": {
    "defaultRows": 100,
    "maximumRows": 500,
    "maximumOffset": 5000,
    "maximumProjectedFields": 16,
    "maximumFilters": 12,
    "maximumInValues": 10,
    "maximumGroupFields": 6,
    "maximumAggregates": 6,
    "maximumSortFields": 4,
    "maximumComplexity": 100,
    "timeoutMilliseconds": 10000,
    "maximumResultBytes": 1048576,
    "maximumConcurrentQueries": 2
  },
  "executable": false
}
```

## Trusted allowlists and types

- `IQueryDatasetCatalog` resolves a dataset by organization ID, tenant-owned source ID
  and key. Only trusted server code may supply datasets/fields. Query requests cannot
  create metadata. The deployed `UnconfiguredQueryDatasetCatalog` always returns none.
- Field names are case-sensitive ASCII identifiers (letter/underscore first, then
  letters/digits/underscores), maximum length 128. Fields have independent flags
  determining filter, group, sort and aggregate permissions.
- Values are discriminated by `type`: `text`, `number` (decimal), `boolean`, or
  `timestamp` (ISO-8601 with an explicit `Z` or ±HH:MM offset). Exactly one
  matching payload property is non-null.
  Text is at most 512 characters with no control characters.
- Unknown JSON properties (even nested), unknown/numeric enums, and malformed typed
  values are rejected. Never submit secrets, endpoints or credentials in any field.

| Operator | Field types | Number of values |
| --- | --- | --- |
| `equal`, `notEqual` | Any | One |
| `in` | Any | 1–10 |
| `isNull`, `isNotNull` | Any | Zero |
| `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual` | Number, timestamp | One |
| `contains`, `startsWith` | Text, relational providers only | One non-empty text value |

Filters are flat and combined with AND; no free-form predicate trees exist. The five
provider declarations share the common operators and aggregates, but Elasticsearch
excludes text substring/prefix operators until adapter conformance is established.
Capability declarations are provisional and do **not** imply live provider support.

Aggregates: `count` has no input field and yields number; `sum` and `average` require
a numeric field; `minimum` and `maximum` accept number or timestamp. Aggregate
aliases must be distinct and must not collide with dataset field names. Grouped
projections contain exactly the group keys; aggregate-only queries project no raw
fields. Sort fields must be present in the result schema, unique, and (for raw
fields) allowed to be sorted. A projection or an aggregate is mandatory.

## Limits and future runtime obligations

`QueryBudget` contains the fixed defaults and ceilings returned in the response.
Complexity equals projected fields + 4×group keys + 4×aggregates + sorts +
sum(2 + scalar count) for filters, capped at 100. Individual count limits are checked
first. Default row limit 100, maximum 500; offset maximum 5000.

The timeout (10 seconds), total result bytes (1 MiB), and concurrency (2 requests)
are **prospective execution requirements only**. They are not enforced by this
non-executing validation route. Future adapters must independently enforce server-side
read-only permissions, parameterization, timeout/cancellation, deterministic ordering,
byte limits, concurrency, network policy and execution authorization.

The future `QueryResult` contract declares ordered typed columns, nullable typed
row values, offset, limit, `hasMore`, and `truncated`. No route exposes that result
contract yet. Connection security (roadmap 2c) and real-provider conformance testing
must precede any live execution.

The validation endpoint additionally limits raw request bodies to 64 KiB, to keep
JSON deserialization bounded before application-level shape checks.
