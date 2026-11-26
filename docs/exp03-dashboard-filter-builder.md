# EXP-03 — UI-based typed dashboard filter builder

Issue #148. Experimental integration target: `experiment/dashboard-filtering`.
Do not promote the experiment to `main` without owner acceptance.

## What is available

In a read-only dashboard view, expand **Experimental business filters** to add
typed filters using a business dimension, comparison, and value. Filters can be
edited, removed one at a time, or cleared. Active values and per-visualization
applicability are shown. A visualization can remain unchanged, be partially
filtered, or have no matching records; each state has an explanation.

The panel is collapsed by default and its values exist only in component
memory. Existing calendar and sample controls remain separate. Saved dashboard
cards are not modified by this field-filter experiment.

Fictional examples map one semantic dimension to different physical fields:
`CustomerId`, `customer_id`, and `customer.key`. Other examples cover text,
numeric, Boolean, timestamp, categorical, non-filterable, incompatible, and
unmapped fields. Elasticsearch omits the relational-only `Contains` and
`StartsWith` operators; other provider examples retain their own applicability
results. Predicates on a compatible fixture are combined with AND and evaluated
against raw sample records before the fixture summary is calculated.

## Provider and execution boundary

The UI is an offline product experiment. Its fictional records are local sample
fixtures; no registered data source, customer record, database connection, or
query endpoint is used. The UI therefore does **not** establish that a live
provider query executed.

The existing EXP-01 backend planner remains authoritative for provider-neutral
query planning. It maps approved business dimensions to trusted physical fields,
keeps typed predicates in the query plan before aggregation, preserves base
predicates and budgets, and reports provider-specific applicability. SQLite,
SQL Server, PostgreSQL, MySQL, and restricted Elasticsearch planning/compiler
coverage was implemented and reviewed under [#135](https://github.com/infoconex/analytics-dashboard/issues/135).
Real customer query execution remains disabled and outside this increment.

The sample evaluator mirrors only the planner concepts needed for this UI
walkthrough. It is not a provider adapter, authorization boundary, or substitute
for backend planning. Timestamp strings are normalized to UTC for these fixed
fictional records. Provider collation, indexed fields, and real schema mappings
remain provider-specific.

## Owner evaluation

From a checkout of `experiment/dashboard-filtering`, start the existing
development-only Compose environment with a Linux Docker engine:

```powershell
docker compose -f compose.ux16-owner.yml config --quiet
docker compose -f compose.ux16-owner.yml up -d
```

Open `http://localhost:5173/sample-host.html`, choose the Northstar sample
dashboard, then expand **Experimental business filters**. Suggested review:

1. Filter Customer `is` `C-101`. Sales and Support should each show one record;
   Renewals should explain its incompatible numeric mapping; Inventory should
   say it has no approved customer mapping.
2. Edit the filter to `C-999`. Affected samples should show no matching records.
   Remove it and confirm that sample results recover.
3. Filter Order status `contains` `ing`. SQL Server and PostgreSQL examples
   should narrow; Elasticsearch should say the operator is unsupported.
4. Combine two filters and confirm the AND result. Clear all and confirm the
   original sample summaries return.
5. Repeat at 320px and use only the keyboard to open the section, choose
   controls, apply, edit, remove, and clear filters. Confirm the existing saved
   revenue card and the dashboard revision remain unchanged.

Record confusing labels, unclear applicability, or keyboard/responsive problems
separately from the automated verification results. This owner walkthrough does
not establish general customer usability, actual assistive-technology output,
WCAG conformance, or production provider execution.
