# UX-35 — Filter scope and cross-visualization feedback (Issue #112)

## Audited baseline

Based on UX-34 main `97c04b919baf8fc1f8a6c0ad053fea1e02548a14`. Existing fictional datasets are independent: Commerce has month/revenue/orders/customer-month observations; marketing channels have channel/orders/sessions/conversion with no timestamps. No authorized join exists. Shared filter changes propagate to the same filtered sample rows used by charts, metrics, summaries and native tables.

The original bar counted only selected channels, leaving narrowed reporting periods absent from active-count summaries and without one-click date recovery. Card-level context showed channel selection and the commerce no-attribution limitation but did not show active date scope or the marketing no-date limitation. On an 18-card mixed dashboard, users could not tell aggregate scope without inspecting many cards.

## Focused treatment

- Count known compatible Commerce and Marketing visualizations from dashboard widget definitions (18-card fixture: 9 of each); never treat source count as observed data changes or an inferred relationship. Unknown future dataset types are explicitly unclassified.
- Only show aggregate scope summary while at least one filter is selected. The summary distinguishes each selection's compatible visualization count from the independent unaffected dataset, and states the reason.
- Compact per-widget context identifies one relevant active selection and any incompatible active selection; no extra notifications, persisted state, data joins, or advanced filter-management controls.
- Active selection count includes both period and channel. One global restore action, per-selection chips, and in-place card actions restore focus predictably. The restored period does not clear an independent channel and vice versa.
- Empty channel matches display **No matching sample data**; unavailable metric/source metadata displays **Insight unavailable**. This sample view makes no promises about production loading or live transport.
- Embedded sample filters continue to use the existing strictly parsed per-dashboard URL, server-authorized dashboard API and host-owned navigation and scrolling. No client-side authorization or iframe messaging.

## Deterministic validation and remaining limits

The `ux35FilterScope.spec.ts` Playwright tests exercise 18 fictional mixed visualizations at 1440, 768, 390 and 320 CSS px; consistent revenue ($128.3K for final Oct–Dec) and Direct channel orders (1,530); date-only, channel-only and both; unchanged data; global and card reset, keyboard focus, reload; forced colors, axe, no overflow. Screenshots and structured interaction JSON use the existing Playwright output artifacts. The 640/320 reflow equivalence and earlier genuine native zoom tests remain separate: CSS width alone is **not** evidence of browser zoom. Human usability observation and real screen-reader speech remain untested unless separately performed.

## Verification gates

Frontend unit/production build, NUnit, SQL Server/PostgreSQL conformance, Compose, Playwright, C#/JS CodeQL on the final PR head, actual screenshot and JSON inspection, squash merge, post-merge CI and CodeQL. No UX or WCAG conformance claim is justified solely by automated passing checks.
