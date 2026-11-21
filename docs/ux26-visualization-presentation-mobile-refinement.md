# UX-26 — Visualization presentation consistency and mobile dashboard interaction refinement

Tracking [issue #83](https://github.com/infoconex/analytics-dashboard/issues/83). Implementation branch `ux26/visualization-presentation-mobile`, baseline `main` `f3b72128655bece64308cc90cda72d96c2e2e7df` (UX-25 #81 / PR #82).

> Verification status: this file records implementation decisions and test intent. CI outcomes and actual screenshot inspection must be updated **after** they are available. No passing result is implied until recorded.

## Investigation and code evidence

1. `WidgetTile.tsx`: Recharts SVG leader-line labels were positioned using the slice midpoint, plus a fixed 13px line and 9px text inset. Neither available widget width nor category string length nor same-side label collisions was taken into account. The prior UX-25 Chromium inspection observed clipped donut labels at 390px. A widget can be narrow at a 1440px viewport, so viewport-only CSS switching would not solve the general problem.
2. `styles.css` and `composition.ts`: persisted widget widths are 3/6/9/12 columns (metric can be 3, charts minimum 6), heights 220–640px with kind-specific minima. At <=950px the dashboard switches to one readable column; stored desktop width is deliberately unchanged. Content can extend a **minimum** card height (explanations, legends, tables); this is not itself a persisted-layout defect.
3. `DashboardCanvas.tsx`: drag, move-earlier/later, and keyboard-resize controls already existed. The 32px corner grip was difficult to discover and use on a narrow touch screen. The existing Move earlier/later buttons are retained rather than inventing gesture-only ordering.
4. Existing exact-value data tables and optional legends are the complete accessible source of category information; the SVG leader lines are a supplemental, intentionally optional display.

## Implementation decisions

### Outside pie and donut labels

- `chartPresentation.ts` contains a pure layout-selection helper, `fitOutsidePieLabels`. It takes the **measured chart area**, candidate labels and source rows, preserves source values and selected-label priority, and omits individual SVG labels that risk horizontal truncation, vertical clipping or a near-collision on the same side.
- At widths below 480px no outside SVG labels are drawn. No shortened or misleading category text is generated. Category identity, exact values and native table access remain available, even when the saved visualization has its legend hidden.
- `WidgetTile.tsx` uses `ResizeObserver` on its own chart container. A small widget on a large desktop receives the same protection as a phone. This is an in-memory display calculation only, not a persisted visualization option.
- When label fitting suppresses requested labels, the chart still draws normally and explanatory text directs readers to the legend or exact data table. The selected max count remains a **ceiling**, not a guarantee of visible labels.
- No input values, aggregation, categorical sort, sector colors, keyboard selection, data-table output or tooltip meanings change.

### Mobile authoring and visual consistency

- At <=950px each editable card now has an explicit `Adjust size` disclosure with four min-44px buttons: Narrower, Wider (saved **desktop** width), Shorter and Taller. Controls honor the existing 3/6/9/12-column and 220–640px rules and announce mutations through the canvas's existing live status.
- The disclosure explains that small screens always use a single column and that width changes take effect on desktop. Each change passes through existing dashboard `onChange`, participating in the 20-step unsaved Widget Undo/Redo; no new persistence or history semantics.
- The small corner drag handle is hidden only when the clear touch alternative is offered. Larger screens keep pointer drag, arrow-key resize and move buttons.
- At <=480px widget headings can wrap and edit/duplicate/save-to-library/remove controls have min-44px touch targets. Mobile controls remain in normal document flow, not over the chart or the Save/Cancel bar.
- Existing separate sizing/formatting for metrics, charts, tables and legends is retained rather than forcing identical cards, chart sizes or new configuration fields.

## Test strategy and evidence

- **Vitest:** `chartPresentation.test.ts` now covers 320/390px omission, long category labels, narrow widget widths independent of viewport, insufficient chart height, and dense twelve-slice label selection. Existing chart-value, tooltip and palette invariants remain.
- **Chromium Playwright:** `visualizationReuse.spec.ts` now captures donut rendering at 320, 390, 720, 768 and 1440px; checks chart label bounding rectangles and table alternatives; exercises touch-friendly size changes, Undo/Redo, pie live preview, save/reload persistence, original template workflow and axe accessibility.
- **Full suite:** Verify (NUnit, Vitest, Chromium, evaluation lab, production build) and real SQL Server/PostgreSQL conformance; CodeQL must pass on the final PR head and again on post-merge `main`.
- **Screenshots:** CI screenshot artifacts are a collection step, not proof of visual inspection. Directly inspect available PNGs, especially edge labels, control overlap, page overflow, long text, chart padding, blank space, preview and Save/Cancel at all requested widths. Record specific outcomes and any uncovered gaps here.

## Security and architectural review

All proposed changes are to the **presentation-only frontend** and its tests/docs. No endpoint, database model, auth flow, authorization role, organization identifier, server-side tenant filter, data source, public embed contract or sharing policy is altered. Reusable templates remain organization-owned and inserted as independent copies. Existing expected-revision checks and explicit stale-save recovery remain server-authoritative. Undo remains bounded and ephemeral. All charts still rely solely on fictional sample data and expose accessible exact data tables.

Review the PR diff for unexpected contract changes before merge. CodeQL and mandatory CI results are independent release gates; a clean source review alone cannot substitute for them.

## Known limitations and follow-up candidates

- Outside labels are deliberately optional and may not all appear even when requested; the native data table is authoritative at every size.
- Long legends and native tables can create vertical growth or **contained** scrolling, which is preferable to truncating facts or creating document-wide horizontal overflow.
- Narrow widths intentionally use full-width cards; resizing their saved desktop column span does not change how many mobile columns render.
- Further mobile usability and mixed-widget visual review must be based on actual browser screenshots and task evidence, not assumptions.
- UX-27 recommendation to be finalized after UX-26 verification and any remaining responsive defects are assessed; avoid expanding feature scope without evidence.

## Deferred product-owner review

Comprehensive manual review remains deferred. Future realistic tasks: create/configure/insert saved visualizations; resize/reorder/duplicate/remove; Undo/Redo; save/reopen; manage reusable visualization templates and independent-copy semantics, across desktop and mobile.
