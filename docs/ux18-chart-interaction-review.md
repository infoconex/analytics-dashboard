# UX-18 — Chart interaction and presentation owner review

Tracking: [Issue #66](https://github.com/infoconex/analytics-dashboard/issues/66).

## Scope and safety

One product-owner-authorized combined increment: keyboard-operable channel
bar/pie/donut charts, clockwise chronological pie/donut wedges with Jan at
12 o'clock, optional collision-limited leader-line labels, and readable scatter
axis titles. Built-in fictional sample data only. Category selection and
chart-label viewing state are transient; existing saved widget, API, role,
organization, read-only same-origin host, and data source contracts are unchanged.
No production integration, telemetry, permission model or cross-origin change.

## Manual walkthrough

Run `docker compose -f compose.ux16-owner.yml up -d` using the existing
fictional owner review environment. Open `http://localhost:5173` and select
**Business performance**. For the chart options not included in this saved
dashboard, use **Edit dashboard** → add a visualization, select Pie/Scatter,
and preview before saving if desired.

1. **Bar/Donut keyboard filtering:** Tab to the Orders by channel or Traffic
   sources chart region. Confirm an obvious focus outline, category instruction
   and selected category name. Use Right/Left, Home/End, Enter or Space to
   choose a channel; the global marketing-channel selector should update and
   the chart should filter. Enter/Space again on the only selected category
   clears it. Focus remains in the chart. Compare exact source table counts.
2. **Pie/Donut orientation:** Preview Revenue by month as Pie or Donut, without
   changing source order. Jan starts at the top and each next month proceeds
   clockwise. Color meanings remain tied to categories.
3. **Leader labels:** Select **Show slice labels**. Up to five sizeable
   categories receive outside leader lines and labels; others remain available
   by hover or exact data table. Select **Hide slice labels**. Toggle applies
   only to the current viewing session, not the saved widget definition.
4. **Scatter:** Preview Orders vs Revenue. Explicit **X-axis: Orders** and
   **Y-axis: Revenue (USD)** titles appear. Confirm interpretation at narrow
   widths, 200%/400% zoom, keyboard focus and forced colors.
5. **Read-only host:** Validate channel keyboard selection in supported
   same-origin fictional embedding. No edit controls, writes or new messaging.

Report success/friction, chart type, viewport/zoom, and exact steps. These are
product-owner observations, not an independently recruited human study or
WCAG conformance audit.

## Follow-up gates

The optional label toggle is view-only because persisting chart-specific
preferences would extend the current dashboard widget schema and contracts;
that expansion requires a separate approved design. Full assistive technology
testing and independent human task research remain outstanding. Enterprise
organization hierarchy, authorization, production embedding, integrations and
telemetry remain deferred.
