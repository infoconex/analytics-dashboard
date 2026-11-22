# UX-9 — Trustworthy insight interpretation and data context

Issue [#44](https://github.com/infoconex/analytics-dashboard/issues/44). This is a **fictional sample-data UI evaluation**, not a live-data interpretation, statistical analysis or production trust certification.

## Product behavior

- A visualization names its metric/unit and the actual selected sample coverage by default. “At a glance” compares exact selected observations; it never asserts causation, statistical significance, a current reporting year or a previous-year trend.
- **What this means** expands a definition, unit, scope, independent filter applicability, fictional source/provenance, and the precise claims the sample cannot answer. **View data table** opens native row/column semantics with unrounded values. Both use the *same* selected rows as the chart and remain keyboard-operable.
- Channel samples have **no dates**; month filters affect only commerce. Commerce sample month labels are Jan–Dec with **no year**; “Final 3/6 sample months” does not mean the most recent calendar months.
- Additive amounts/counts are aggregated only where defined. The “customer observations” overview count is a sum of monthly occurrences, **not** a distinct-customer count. Channel conversion percentages are independent fictional examples, not calculated from displayed orders and sessions; a combined conversion rate is **unavailable**. Unrecognized metric/dimension/dataset values do not silently become zero.
- The overview's four figures are calculated from the same source arrays: commerce revenue, orders, customer-month observations and channel sessions. The fourth figure is not affected by month selection. No unsupported YoY growth badges or invented KPI figures remain. Fictional thumbnail bars are clearly illustrative.
- Dashboard save dates describe the **dashboard definition**, never the freshness of samples. Static sample data has no refresh timestamp. Empty, invalid and authorized request error states do not elevate privileges and retain existing recovery routes.
- Standalone viewers and the same-origin sample embed can use all interpretation and inspection features without authoring actions. A read-only UI is **not** a new server-enforced viewer identity or production embed contract.

## Architecture, boundaries and tradeoffs

- `web/src/sampleInterpretation.ts` is a pure, static presentation catalog for the two built-in sample datasets and their supported metrics/dimensions. It owns meanings, units, additive eligibility, coverage/limitations and exact aggregates. This deliberately does **not** introduce new persisted dashboard fields, a remotely configurable metrics service, query language, query endpoint or third-party library.
- `WidgetTile` shares existing filtered rows with the interpretation model, chart summaries and tables. `DashboardConsumer` owns ephemeral filters; `DashboardCanvas` keeps dense navigation and return focus. `App` uses the catalog for truthful overview figures. No existing domain/API application or infrastructure contract changes.
- Server membership checks, tenant-scoped repository access, revision-safe writes, and blocked production transports stay authoritative. Hash links never create entitlement. Organization/dashboard keys and request-generation guards remain intact; interpretation data has no cross-tenant cache.
- Avoiding computed blended rates and causal explanations means sometimes saying **unavailable**. This is intentional: raw individual percentages remain accessible, but the fictional source cannot support a defensible combined statistic.
- Filtering, definitions and expanded tables are not persisted or shared. Native `details` controls preserve predictable focus and affordances without an overlay or additional navigation mode.

## Verification traceability

| Scenario | Primary evidence |
| --- | --- |
| SC-UX9-01 — metric/unit/time/source | `sampleInterpretation.test.ts`, `interpretation.spec.ts` |
| SC-UX9-02 — chart summary and exact data | `chartInsights.test.ts`, `WidgetTile.test.ts`, `interpretation.spec.ts` |
| SC-UX9-03 — independent applied/removed filters | `consumerFilters.test.ts`, `interpretation.spec.ts`, existing consumer tests |
| SC-UX9-04 — unavailable/no evidence | `sampleInterpretation.test.ts`, `WidgetTile.test.ts`, `interpretation.spec.ts` |
| SC-UX9-05 — dense, keyboard, responsive, true zoom, forced colors | `interpretation.spec.ts`, browser artifact inspection |
| SC-UX9-06 — tenant switch and server denial | `interpretation.spec.ts`, `embed.spec.ts`, `DashboardApiTests.cs` |
| SC-UX9-07 — standalone/embedded read-only | `interpretation.spec.ts`, `embed.spec.ts` |
| SC-UX9-08 — truthful overview totals | `sampleInterpretation.test.ts`, `interpretation.spec.ts` |
| SC-UX9-09 — reproducible evidence and limitations | `ux9-interpretation-task.json`, `ux9-native-zoom.json`, screenshots and CI logs |

Local browser fixtures prove frontend flows only. Required CI runs the real .NET development API plus NUnit and SQL Server/PostgreSQL provider conformance. Screenshot artifacts must be inspected at original resolution, including inside the customer frame. Record actual browser/OS, viewport, zoom and focus measurements from completed runs, not planned ones.

**Separate unpassed gates:** genuine NVDA/JAWS/VoiceOver/TalkBack/Orca spoken experience, a full WCAG 2.2 AA audit, provisioned Kibana 9.5.6 / Elasticsearch 9.5.6 baseline, and counterbalanced 8–12-person user research. Automated scripted successes do not establish human comprehension, product superiority or WCAG conformance.
