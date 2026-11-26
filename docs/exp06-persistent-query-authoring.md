# EXP-06 — Persistent bounded fictional query authoring

Issue [#155](https://github.com/infoconex/analytics-dashboard/issues/155). Integration target: `experiment/dashboard-filtering` only. Baseline `ee2d1f7cdb5faaf70db9354ea8caa3995d846159` (CI #466, CodeQL #468).

## Decision and scope

Extend the existing DashboardWidget with an optional bounded queryDefinition. The reserved datasetKey fictionalQuery and metricKey/dimensionKey query identify the variant; these keys are not mappings to an aggregate sample. The actual semantic dataset, grouping, aggregation and approved measure are in the nested definition. Only the EXP-05 bar/count/sum shapes are allowed. Existing commerce/channels samples remain separate and retain their existing semantics. The legacy dataset tables have no query-variant sample rows or measures. The UX-13 fixture manifest records the changed source hash, not changed fixture records.

Both dashboard widgets and reusable templates already persist complete JSON; no schema migration is required. Null/absent query definitions preserve legacy serialization. The existing dashboard and library services retain authorization and optimistic revision checks. A library template remains an independent snapshot; copy, duplicate, undo, dirty detection, save review and conflict comparison include the query shape.

The existing visualization editor exposes an opt-in raw-record mode and approved options. Rendering uses the same fictional evaluator as EXP-05. Each saved card is evaluated independently, including multiple cards with different shapes over the same dataset. Typed filter selections and resolved UTC reporting range live in DashboardConsumer memory and are passed to both temporary previews and saved cards. Compatible selections apply before aggregation. Unmapped/incompatible filters and undated ranges are explained. Unsupported saved definitions render unavailable instead of falling back to legacy data. Editing and draft preview display unfiltered fictional shapes. Leaving saved-dashboard viewing resets both experimental selections when their controls unmount, preventing hidden stale filtering on return. Legacy month/channel controls remain separate.

## Security boundary

The server validates both write paths against a fixed semantic allowlist and translates the approved shape to the existing QueryRequest/QueryShapeValidator for validation only. No connection ID, physical fields, arbitrary query syntax, persisted consumer filters, customer catalog registration, query endpoint, execution or provider access is introduced. Existing customer execution gates are unchanged. The nested contract rejects unmapped JSON members. The fixture metadata is duplicated on server and client deliberately for this bounded experiment; a future trusted shared dataset metadata contract should eliminate that duplication before real dataset authoring.

## Deferred

Additional chart types, query complexity, real data, independently saved filter presets, live references, integration of experimental filter scope into shared-insight snapshots, and removal of temporary EXP-05 previews are outside this increment. Existing Explore authoring remains aggregate-sample-only.

## Verification

Pending exact-head and integrated CI/CodeQL, browser evidence review, and issue closure. Tests cover persistence, rejected shapes, authorization/revisions, query-only change detection, independent copies, shared context, and browser authoring/reload/filter behavior.
