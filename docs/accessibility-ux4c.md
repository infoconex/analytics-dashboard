# UX-4c — Compact dashboards and assistive navigation

Tracking: [Issue #26](https://github.com/infoconex/analytics-dashboard/issues/26). Continues [UX-4b](accessibility-ux4b.md).

## Customer-experience choice

Keep the saved widget order and existing two-column canvas. Metric cards no longer grow merely to fill a neighboring chart's height, chart heights are bounded, and table/card heights follow their content. This removes conspicuous blank *inside* cards and reduces reading distance without introducing visual-order/keyboard-order mismatches from masonry or CSS `grid-auto-flow: dense`. A grid row can still have unused space beneath its shorter card; full row-packing and user-configurable sizes are intentionally deferred.

For eight or more widgets, **Jump to visualization** expands a numbered, keyboard-operable index. Its links are buttons so activating a destination moves actual browser focus onto the card's named heading without changing the dashboard route or URL fragment. A shorter dashboard has no extra navigation surface. Each dashboard card announces its title as an `h2` in a labeled article, displays a small position count in consumption mode, and preserves its existing data-table disclosure. Channel charts explain the keyboard-accessible filtering alternatives rather than promising that their SVG itself is keyboard-interactive. These decisions are client-only: they do not change tenant authorization, revision checks, or persistence.

## WCAG 2.2 AA-oriented verification

| Criteria / topic | UX-4c evidence and limitations |
| --- | --- |
| 1.1.1 Non-text content; 1.3.1 Info/relationships | Charts have named summaries and native data tables with captions and headers. Each card has a heading and named article; a screen-reader user can traverse headings and tables. A real reader must still validate speech order. |
| 1.3.2 Meaningful sequence; 2.4.3 Focus order | DOM and grid stay in saved widget order. Jump activation programmatically focuses the destination heading. Keyboard tests cover index activation and channel filter interaction; complete page-by-page traversal is not claimed. |
| 1.4.3 Contrast; 1.4.11 Non-text contrast | Existing token tests and axe automated checks remain. New index links use semantic colors and system colors in forced-colors mode. Color contrast still needs manual checks for all dynamic states, SVG chart segments and custom themes. |
| 1.4.4 Resize text; 1.4.10 Reflow | Test desktop 1440, tablet 768, mobile 390 and narrow 320 CSS-pixel widths. Width tests simulate effective 400%-zoom reflow from a 1280 CSS-pixel viewport but **are not** actual browser zoom. |
| 2.1.1 Keyboard; 2.4.7 Focus visible; 2.4.11 Focus not obscured | Native disclosure/controls, index buttons, focused headings and high-contrast focus outlines have scripted checks. Check native zoom, sticky headers and AT focus in representative browsers before any conformance claim. |
| 2.5.8 Target size (minimum) | Index targets have at least 44 CSS pixels of height. No exhaustive inventory of every control, pointer spacing exception or touch-screen target has been completed. |
| 4.1.2 Name/role/value; 4.1.3 Status messages | Named jump navigation, headings, chart summaries, named filter buttons with pressed state, and an existing polite filter-status region support interpretation. Screen-reader speech, live-announcement timing and application/OS combinations remain to be verified manually. |

The axe checks select WCAG 2/2.1 A and AA and WCAG 2.2 AA rule groups. Automated passing tests cannot establish conformance.

## Evidence and test matrix

- Baseline: [UX-4b post-merge Verify run #43781566337](https://github.com/infoconex/analytics-dashboard/actions/runs/43781566337), artifact `ux4-visual-evidence`, especially `04-consumption-desktop.png`, `13-consumption-mobile.png`, and `17-consumption-tablet.png`. In the desktop capture, the short revenue metric occupied the full neighboring chart's height; the blank lower third was visually dominant. Some tables also stretched beyond their data because of a legacy minimum table height.
- Implemented branch: `npm run check` runs Vitest/TypeScript/Vite; `npm run test:e2e` runs full Playwright against the disposable sample environment. `npm run visual:evidence` and `npm run visual:ui-only` include deterministic desktop/mobile/320px and **12-card** screenshots; the latter only exercises intercepted UI routes.
- New screenshots `21-dense-dashboard-desktop`, `22-dense-keyboard-focus`, `23-dense-dashboard-tablet`, `24-dense-dashboard-mobile`, `25-dense-reflow-320`, `26-dense-data-table-320`, `27-dense-forced-colors-320` are attached to the CI **ux4-visual-evidence** artifact with WebM and Playwright traces. The after-state must be reviewed from the successful branch CI run; a successful build is not itself visual approval.
- The native Chromium build in the initial cloud execution environment aborts with `process_singleton_posix.cc: socket() failed: Operation not permitted` before loading a page. Browser screenshot review and full Playwright regression therefore rely on the independent GitHub Actions Linux browser, and this local limitation must not be confused with a product failure.
- Actual 200% and 400% browser UI zoom was **not** executed in that restricted cloud browser. CSS viewport simulation must never be reported as actual browser zoom. A later headed browser session with a working zoom accelerator and readable device scale must verify each level; check physical and keyboard reflow, focus not obscured, overflow and forms.
- NVDA/JAWS/VoiceOver and a full Orca session have not been exercised here. An automated accessibility tree, DOM assertions and axe are **not equivalent** to a real assistive-technology test. Arrange a manual Windows/NVDA, macOS/VoiceOver and mobile touch reader spot-check of widget headings, nav index, live filter change and native data table.

## Remaining gaps

Research-based usability timings and enterprise customer preference versus Kibana remain unmeasured. Pointer chart slices remain visual shortcuts with keyboard equivalents in filters and data tables, rather than individually focusable SVG shapes. Dense dashboards still scroll vertically; advanced size presets and full masonry/flexible layout were deferred to prevent reading-order regressions. Night/dark variants, user-configurable dashboard densities, and comprehensive WCAG audits await distinct increments.

Sources: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), and [W3C complex-image alternatives](https://www.w3.org/WAI/tutorials/images/complex/).
