# EXP-04 — Typed and calendar filters in authored query previews

Issue #151. Experimental integration target: `experiment/dashboard-filtering`.
Do not promote this experiment to `main` without owner acceptance.

## Preview behavior

The dashboard's experimental typed-filter builder and reporting calendar now
feed one in-memory context into the authored query preview cards. The preview
definitions use a bounded dataset, visualization kind, semantic grouping
dimension, aggregate, and the fixed fictional provider fixtures already used by
EXP-03. Compatible typed predicates and the resolved UTC reporting interval are
applied to raw rows before grouping and aggregation. The interval includes its
start and excludes its end.

Each preview reports its provider, query shape using semantic dimension names,
grouped fictional results, and typed-filter and calendar applicability. A
missing reporting-time mapping leaves that preview unchanged and is explained.
The existing typed-filter outcome panel remains available for cross-provider
applicability feedback.

The selection remains in page memory. Applying, editing, removing, clearing, or
canceling does not change the saved dashboard, its revision, or the saved
visualization library. Invalid calendar input preserves the previous applied
range. Existing calendar sample summaries and EXP-03 typed-filter outcomes are
retained.

## Data and execution boundary

The query shapes and records are fixed fictional fixtures evaluated in the
browser. This is a preview of how shared selections compose with a bounded
query-shaped visualization definition; it does not read a saved customer query,
call a registered data source, invoke a provider, or access customer data. The
browser receives no execution endpoint, SQL, or customer connection capability.

The server-side EXP-01 planner remains the provider-neutral contract for
tenant-authorized query planning. A preview result does not prove that a real
provider query ran or that providers return equivalent results. Live query
execution remains blocked on its independent security gates.

## Verification

The EXP-04 browser scenario combines a customer filter with an applied calendar
range and checks the sales, support, renewals, and undated inventory fixtures.
It also checks removal and reset recovery, saved visualization and revision
stability, no API writes, keyboard focus, responsive geometry at 1440, 768, 390,
and 320 pixels, forced-colors behavior, accessibility scans, and attached
screenshots. Existing EXP-01/02/03 and visualization authoring coverage remains
required.

CI and CodeQL status: pending exact-head PR and post-merge verification.
