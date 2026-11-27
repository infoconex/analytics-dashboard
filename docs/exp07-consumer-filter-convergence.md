# EXP-07 — Consumer filter experience convergence

Issue [#157](https://github.com/infoconex/analytics-dashboard/issues/157). Target: `experiment/dashboard-filtering` only. Baseline: `630b04c3afc8532ca66eb9a65984e4d28e2e6a82`.

## Decision

EXP-06 made bounded query-backed visualizations persistent and reusable. Keeping the earlier EXP-04/05 preview cards and temporary query-shape editor in the consumer filter panel duplicated the saved dashboard and obscured which actual dashboard widgets were affected. EXP-07 makes filters part of the normal saved-dashboard viewing experience and removes that preview layer.

## Consumer behavior

- Saved-dashboard viewers see one collapsed **Dashboard filters** panel containing a reporting period and typed business filters. Selections remain temporary and scoped to the open saved dashboard.
- Each persistent query-backed card reports which typed filters and reporting period were applied before aggregation, which selections could not be applied, or that no records matched.
- Legacy aggregate sample widgets retain month/channel controls. They explain that raw-field business filters and reporting periods have no approved mapping to their aggregate sample model.
- Filter controls do not change saved dashboard or library definitions, revisions, or server state. They are cleared when the saved viewer context ends.
- Temporary EXP-04/05 fixture preview cards and query-shape editing are retired. Authors use persistent visualization creation/editing and its existing local editor preview.

## Architecture and security boundary

All evaluation remains over the approved fictional fixture records in the browser. No customer query endpoint, connection access, provider execution, arbitrary query syntax, new physical identifiers, or persistence of consumer selections is introduced. Existing tenant authorization, dashboard/library revision checks, and independent live-execution security gates remain unchanged.

The persisted server validator and client-side fixture evaluator still mirror fixed semantic metadata. Consolidating that metadata is deferred until semantic datasets or query authoring expand; it must not be mistaken for a customer catalog or execution authorization.

## Acceptance and verification

The acceptance contract is tracked on issue #157. The mixed-dashboard experience must distinguish actual legacy and saved-query filter scope, preserve pre-aggregation filtering, and cover standalone and embedded views at desktop, tablet, mobile, and 320 px, including keyboard and forced colors. Exact-head PR checks, reviewed and integrity-checked browser evidence, post-merge checks, documentation verification, and issue closure are required before marking this increment complete.
