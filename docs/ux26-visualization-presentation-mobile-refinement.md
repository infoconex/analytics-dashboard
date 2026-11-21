# UX-26 — Visualization presentation consistency and mobile dashboard interaction refinement

Tracking [issue #83](https://github.com/infoconex/analytics-dashboard/issues/83). Implementation branch `ux26/visualization-presentation-mobile`, baseline `main` `f3b72128655bece64308cc90cda72d96c2e2e7df` (UX-25 #81 / PR #82).

> Verification evidence is tracked in [PR #84](https://github.com/infoconex/analytics-dashboard/pull/84), with mandatory fresh-head Verify and CodeQL checks and follow-up main-branch validation. Recorded partial runs below are historical diagnostics, not permission to merge without a completely green latest head.

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

## Actual Chromium screenshot inspection

Reviewed real PNGs from [Verify run #44945579385](https://github.com/infoconex/analytics-dashboard/actions/runs/44945579385), sample-only artifact `ux-visual-evidence`, with additional 390px editor images from the same run. This is **direct visual review**, not just screenshot filenames or automated geometry assertions.

| Width | Donut/pie | Mixed dashboard / widget types | Authoring/editor |
| --- | --- | --- | --- |
| 320px | Outside labels omitted; full legend and five-record alternative still available | Metric, line and table readable in their own single-column cards; tables wrap long category values without page-wide overflow | Existing UX-25 editor and toolbar captures retained; new size buttons use in-flow 44px targets |
| 390px | Outside labels omitted, chart intact; exact category names available without ellipses | Metric and table legible; categories and actions wrap intentionally | Inspected `ux26-mobile-touch-sizing` and `ux26-mobile-pie-editor`: no overlapping size buttons, chart, editor gallery or modal actions |
| 720px | Five label lines can fit without clipping, including categories on both sides | Single-column dashboard, readable small chart; no unexpected page-wide horizontal scrolling | Responsive single-column controls stay available |
| 768px | Sidebar consumes space; outside labels omitted for a narrower chart, as expected from **widget** size | Sidebar/navigation and chart cards remain separate; line/table text readable | Existing dashboard authoring controls and editor are retained |
| 1440px | Multiple circular types displayed side-by-side with their assigned layout and contextual labels | Nine kinds appear in the mixed-dashboard captures; metrics, lines and tables respect their intended card widths | Existing desktop pointer/keyboard resize and editing remain available |

The mixed-dashboard capture series includes top (metric/line), middle (pie/donut), and bottom (table) at **all five** target widths. Visual differences in intrinsic card height are intentional; text/data alternatives extend vertically instead of being clipped. At 768px the available **widget width**, not the nominal viewport width, is appropriately the determining factor for label omission.

The E2E label bounding-rectangle check was originally prone to a timeout if `ResizeObserver` rebuilt the SVG labels between multiple awaited DOM calls; it was corrected to read the label/frame geometry atomically in a single browser evaluation. No browser assertion or label boundary was disabled.

## Accessibility findings and corrections

A full mobile dashboard authoring axe audit at 390px identified three normal-text color-contrast defects (not screenshot guesses). The instruction text on the dashboard canvas was measured at **4.49:1** against the canvas (minimum 4.5:1), while the descriptions under the two Add visualization tiles were **2.55:1**. UX-26 overrides those inherited hard-coded gray colors with the accessible semantic `--color-muted` and increases the tile-description size to the shared caption token. The axe audit remains a required assertion; no violations are ignored or excluded. The precise-node failure output stays in the test to make future regressions actionable.

## CI and test results

- [First browser CI #44944674506](https://github.com/infoconex/analytics-dashboard/actions/runs/44944674506): 145 NUnit, 121 Vitest, 20 evaluation-lab tests, production build and real-provider conformance passed; 125/132 Playwright passed, seven responsive-assumption or test-locator failures diagnosed.
- [Second browser CI #44945579385](https://github.com/infoconex/analytics-dashboard/actions/runs/44945579385): 131/133 Playwright passed; two remaining issues were an SVG resize timing race in the **test** and an actual color-contrast defect.
- [Third browser CI #44946427429](https://github.com/infoconex/analytics-dashboard/actions/runs/44946427429): 132/133 Playwright passed; the sole remaining failure was the three normal-text contrast nodes above, diagnosed without suppressions. Unit/lab/build, SQL Server/PostgreSQL and CodeQL language checks passed.
- Final required proof: [PR #84 latest-head checks](https://github.com/infoconex/analytics-dashboard/pull/84/checks), plus independent Verify and CodeQL after squash merge to main. All tests must pass on the commit being merged; any failed latest-head check is a merge blocker. Screenshot files and their actual review are retained in GitHub Actions artifacts (14-day retention).

## Security and architectural review

All proposed changes are to the **presentation-only frontend** and its tests/docs. No endpoint, database model, auth flow, authorization role, organization identifier, server-side tenant filter, data source, public embed contract or sharing policy is altered. Reusable templates remain organization-owned and inserted as independent copies. Existing expected-revision checks and explicit stale-save recovery remain server-authoritative. Undo remains bounded and ephemeral. All charts still rely solely on fictional sample data and expose accessible exact data tables.

Review the PR diff for unexpected contract changes before merge. CodeQL and mandatory CI results are independent release gates; a clean source review alone cannot substitute for them.

## Known limitations and follow-up candidates

- Outside labels are deliberately optional and may not all appear even when requested; the native data table is authoritative at every size.
- Long legends and native tables can create vertical growth or **contained** scrolling, which is preferable to truncating facts or creating document-wide horizontal overflow.
- Narrow widths intentionally use full-width cards; resizing their saved desktop column span does not change how many mobile columns render.
- Further mobile usability and mixed-widget visual review must be based on actual browser screenshots and task evidence, not assumptions.
- Recommended UX-27: evidence-driven dashboard authoring task-path polish, emphasizing end-to-end mobile navigation and preview/editor transitions rather than new visualization types. Continue testing 320px axis tick density and intentionally contained long-table scrolling with realistic sample fixtures; only ship fixes supported by browser evidence.

## Deferred product-owner review

Comprehensive manual review remains deferred. Future realistic tasks: create/configure/insert saved visualizations; resize/reorder/duplicate/remove; Undo/Redo; save/reopen; manage reusable visualization templates and independent-copy semantics, across desktop and mobile.
