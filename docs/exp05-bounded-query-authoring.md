# EXP-05 — Bounded fictional visualization query authoring

Issue #153. Target: `experiment/dashboard-filtering` only.

## Scope decision

Existing saved dashboard widgets and reusable visualizations store a sample dataset,
metric, dimension, visualization kind and appearance, not a structured query.
Their commerce/channels samples are already aggregated and lack the EXP-04
fixtures' raw-record metadata. Do not infer a mapping, join, or reporting time
between these unrelated samples. This increment validates a narrow authoring
interaction first, rather than changing the persisted visualization contract.

## Behavior

The four EXP-04 previews retain their original defaults. Edit preview exposes
the approved text grouping dimensions and count or the fixture's existing
approved numeric sum (where available). Changes apply immediately to that card
only. Reset preview definition restores the original definition without clearing
the shared selections. Clearing typed filters or calendar selections does not
reset authored definitions. Closing the editor retains the local definition;
reloading the dashboard restores defaults.

The evaluator validates each supplied definition against fixed metadata and
rejects unsupported or duplicate definitions. Compatible typed filters and the
inclusive-start/exclusive-end UTC reporting range apply to raw rows before
grouping and aggregation; missing mappings continue to be explained.

## Security boundary

These local definitions are not saved widgets or reusable visualization
templates. They use only fictional records and fixed approved semantic fields.
No new API, customer connection, provider call, arbitrary SQL/DSL, customer
data, query persistence, or tenant-state change is introduced. The existing
provider-neutral server-side planner and independent execution security gates
remain unchanged.

## Verification

Unit tests cover allowed options, sum/count changes, grouping, combined filter
and calendar evaluation, independent definitions, reset, and rejection of
unsupported shapes. Browser tests exercise the temporary editor and shared
selection recovery, saved metric/revision stability, reload, no unexpected API
requests, focus, responsive geometry, forced colors, accessibility and attached
screenshots. Existing regression coverage is retained.

Verification: pending exact-head PR CI and CodeQL and post-merge runs.
