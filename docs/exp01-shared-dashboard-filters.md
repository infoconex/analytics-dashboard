# EXP-01 — Shared dashboard filter planning (experimental)
 
Integration target: experiment/dashboard-filtering. Issue #135. No promotion to main without product acceptance.

## Existing behavior and boundary

UX-3 introduced ephemeral sample filters; UX-16 clarified independent dataset scope; UX-17 refined reporting context; UX-35 coordinated per-card scope and reset. Those client-side fictional monthly/channel selectors remain unchanged. No real customer catalog, API route, connection, execution, dashboard persistence, designer override, or UI is added here. The production catalog remains empty. The authorized QueryService resolves organization membership before source and dataset lookup; the pure planner consumes only trusted metadata. Neither plan nor validation is an execution permit.

## Contract

A trusted QueryField can optionally declare a case-sensitive BusinessDimension identifier, unique within its dataset. For instance, SalesTerritory and CustomerRegion can both map to customer_region, while OrderDate and OpenedAt can both map to reporting_time. Administrators must approve semantic meaning, compatible values, timestamp storage and field type; equal names alone prove nothing. The experiment supports one mapping per dimension per dataset. Malformed or ambiguous mappings fail planning. Unmapped fields never match by name.

SharedDashboardFilters has an optional resolved date interval and zero or more typed shared field predicates. DateRange accepts explicit-offset instants only when serialized, requires both endpoints and start < end, and normalizes both to UTC. It expands to >= start AND < end on the approved reporting_time timestamp field. Future calendar UI resolves relative presets and ambiguous/nonexistent local times in the chosen zone before planning, once per dashboard snapshot. Elapsed relative days and calendar days must be explicitly distinguished in EXP-02. The context is not a persisted dashboard schema or an HTTP endpoint.

SharedFieldFilter has semantic dimension, value type, existing QueryOperator and QueryScalar values. The existing scalar and predicate validator enforces cardinality, types, length and control-character restrictions. All predicates are ANDed (In is the bounded multi-value operator); no expression trees or query strings. The context is bounded by the existing filter budget, with two slots reserved for a date range. Base query predicates are never replaced or weakened; combined query validation rejects overflow or invalid requests rather than silently dropping applicable filters. Clear is an empty context, preserving base filters.

Each active selection returns an outcome: Applied (planned, not measured), NoApprovedMapping, FieldNotFilterable, IncompatibleType, or UnsupportedOperator. The date range is one outcome; field outcomes retain input index. These are internal planning contracts; future consumer UI should explain scope without exposing confidential field metadata. Designer exposure/participation policy, dashboard/tenant state ownership and authorized persistence are EXP-05 work, not implied by this contract.

## Verification and limits

Existing provider compilers consume the resulting QueryRequest. SQL compilers bind values separately in WHERE prior to GROUP BY; Elasticsearch creates structured bool.filter clauses before aggregation. Tests cover mapping, boundaries, invalid inputs, authorization, all five inert compilers and a disposable in-memory SQLite aggregate. Existing real-provider conformance suites continue to run. Timestamp precision, UTC storage, collations, exact keyword mapping and Elasticsearch metric limitations are provider-specific; see provider compiler docs. Do not claim cross-provider equivalence without representative conformance. Full cross-provider integrated evaluation remains EXP-06. No browser UI change in this increment; existing browser regression suite remains required.

Verify and CodeQL push triggers include the experimental integration branch, so post-squash verification uses the existing full-suite push policy. PR gate policy and main triggers are unchanged.
