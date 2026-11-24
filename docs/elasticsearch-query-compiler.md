# Restricted Elasticsearch Query DSL planner (PROV-03)

**Status: offline-only infrastructure with real disposable-cluster conformance.** The API still has no execution endpoint or authorized live dataset registry. No production Elasticsearch connections are established by the application.

The planner accepts only validated provider-neutral QueryRequest objects and operator-approved ElasticsearchDatasetBinding metadata. It serializes strongly typed, bounded Query DSL; never accepts raw DSL, arbitrary index patterns, a query string, scripts, customer URLs, or user-chosen physical fields. The output is an inert plan.

## Trusted schema obligations

- An exact, fixed index identifier (not an alias pattern with wildcards).
- Trusted logical-to-physical query and source field paths; text filters/sorts/grouping require an operator-declared exact keyword mapping. The planner cannot independently verify the live Elasticsearch mappings.
- A non-null unique stable sort key whose mapping supports exact sorting; COUNT(*) is represented by value_count on this guaranteed-present key.
- Timestamp fields use date_nanos mappings to preserve exact 100-nanosecond boundaries. The planner normalizes typed offsets to UTC ISO-8601.

## Supported restricted semantics

- Equality, inequality, IN, null/existence checks and numeric/time comparisons become bool.filter predicates. Not-equal additionally requires field existence, so missing values do not become false SQL-style non-null comparisons.
- Predicates are placed in the outer query, before aggregation. They do not post-filter already computed metrics.
- Raw rows have bounded from/size and a stable-key tie breaker; projections use trusted _source paths.
- Aggregate-only metrics use sum, avg, min, max and count over the stable non-null key.
- Grouped results use bounded composite buckets with optional metrics and stable key ordering. Offset paging and ordering grouped buckets by metric values are explicitly rejected, not silently approximated. A production paging/materialization contract remains a follow-on.
- Text substring/prefix and free-form boolean expressions remain unsupported for Elasticsearch; this is consistent with the conservative provider-neutral capability matrix.

## Verification and limits

CI executes the generated DSL against a disposable, digest-pinned Elasticsearch 9.5.6 container on Docker 28+ loopback only. Tests verify pre-aggregation date and category predicates, exclusive UTC bounds, composite grouped results, missing-field inequality, and harmless literal injection strings. Test-only security disabling is never permitted in production. Tests do not establish production TLS, RBAC, egress policy, credential lifecycle, read-only authorization, or tenant filtering.

Production-safe adapter transport, tenant-owned physical mappings and runtime constraints remain separate security prerequisites before enabling any customer query execution.
