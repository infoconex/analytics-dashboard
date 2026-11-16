# UX-4d — Orientation, chart comprehension and assistive-technology evidence

Tracking: [Issue #28](https://github.com/infoconex/analytics-dashboard/issues/28), [PR #29](https://github.com/infoconex/analytics-dashboard/pull/29). Continues [UX-4c](accessibility-ux4c.md). This is an incremental usability and WCAG 2.2 **AA-oriented** check, **not** an accessibility-conformance assessment.

## Observed baseline and resulting product choices

Downloaded and visually inspected UX-4c [Verify run #43785866435](https://github.com/infoconex/analytics-dashboard/actions/runs/43785866435) screenshot artifact: `21-dense-dashboard-desktop`, `22-dense-keyboard-focus` and `26-dense-data-table-320`. Desktop index buttons are visibly discoverable, the last widget's heading receives a distinct focus outline, and the 320px data table scrolls inside its own card. These snapshots also show two usability gaps:

1. Once focus jumps to the last chart or table, the person must reverse-traverse many controls to choose another visualization. On dashboards with **at least 8 widgets**, a small **Back to visualization list** action at the end of each consumer card now returns focus to that card's numbered entry in the expanded index. The next or previous entry is then one Tab or Shift+Tab away. This does not alter URLs, card order, edit controls or persisted data. Short dashboards do not get the extra action.
2. Visual trend direction and category leaders are not immediately available to someone who cannot see the chart. A visible **At a glance** line now describes the first and last data points and direction, or the largest channel with its **full, unrounded** value. Filtering updates this line because it consumes the exact rows used by the native data table. The table remains the authoritative complete-value alternative; a summary cannot represent all data points, distribution details, or uncertainty.

## Task-focused evaluation

The deterministic sample dashboard contains 12 widgets. Browser tests exercise the following tasks without activating a customer connection:

| Task | Mechanism and observable result |
| --- | --- |
| Find visualization 12 | Open native index with Enter; activate numbered button with Enter; actual focus moves to its `h2` |
| Recover orientation and compare | Activate the card's Back action; corresponding index button receives focus; Shift+Tab moves to adjacent item, not across the dashboard |
| Interpret channel chart | Read visible chart insight and the native table's row/column headers; channel leader and value agree |
| Apply/remove a channel | Use named native select or table row button; a polite status region reports the current scope; filtered summary changes and resets |
| Interpret time chart | Read first/last months and exact amounts, followed by complete table values; unchanged or one-row cases use non-misleading wording |
| Reflow and forced colors | Repeat with 1440/768/390/320 CSS-pixel viewports, document overflow checks and forced-color focus-state screenshots |

These are **scripted task completions**, not observed human participant successes, task times or comparative results versus Kibana. No study recruited customers or screen-reader users.

## WCAG 2.2 AA-oriented coverage and limitations

| Criterion | Evidence and remaining gap |
| --- | --- |
| 1.1.1 Non-text content; 1.3.1 Info and relationships | A chart has a named graphic, adjacent visible insight and native table with caption, column/row headers. Full AT speech behavior and complex-chart insight equivalence need human validation. |
| 1.3.2 Meaningful sequence; 2.4.3 Focus order | The layout preserves DOM widget order. Index-to-heading and return-to-same-index focus movements are asserted. Full real-keyboard traversal across browsers/OS combinations is still needed. |
| 1.4.3 Contrast; 1.4.11 Non-text contrast | Existing token assertions, axe and system forced-color styling cover key states. Manual measurement is still needed for all SVG marks, tooltips and custom colors. |
| 1.4.4 Resize text; 1.4.10 Reflow | Playwright uses 320px responsive width, distinct from browser zoom. A separate test **attempts** browser keyboard zoom at 200%/400% and only records success if viewport width and `devicePixelRatio` both change appropriately. Unsupported shortcut attempts must not be counted as real zoom verification. |
| 2.1.1 Keyboard; 2.4.7 Focus visible; 2.4.11 Focus not obscured | Native index/disclosure/select and keyboard return action are covered by scripted focus and narrow/forced-color captures. Visual focus and any sticky occlusion require final human judgment. |
| 2.4.6 Headings and labels; 2.5.8 Target size (minimum) | Named headings, filters and explicit return origin; 44 CSS-pixel minimum return target. A full 24px target and exception inventory is still required. |
| 3.2.2 On input; 4.1.2 Name, role, value; 4.1.3 Status messages | Client-only filter update retains focus on its native control, with an existing polite live status and pressed row alternatives. AT announcement timing/speech has not been manually checked. |

**Not applicable as an AA requirement:** WCAG 2.4.13 Focus Appearance is Level AAA. We aim for a strong visible focus indicator without misclassifying this criterion.

## Browser and assistive-technology evidence boundaries

- Local build/logic: `npm run check` passes 36 Vitest checks and a TypeScript/Vite production build. Independent CI runs full .NET, real-provider fixtures, Vitest, Playwright and CodeQL.
- Local Playwright Chromium cannot open a page due to `process_singleton_posix.cc: socket() failed: Operation not permitted`. A separate cloud-browser attempt could not connect to the local Vite port (`ERR_CONNECTION_REFUSED`). Neither result is evidence that the application fails in a functioning browser.
- Playwright browser accessibility-tree inspection (`ariaSnapshot`) is a structural inspection, **not** an NVDA, JAWS, VoiceOver or Orca session. No real screen-reader speech, reading-navigation, touch gesture or live-announcement usability observation was performed in this increment.
- Browser zoom is separately attempted in the CI Chromium runner using native keyboard shortcuts. Its JSON evidence records baseline CSS viewport and device scale, attempted targets and whether both measurements changed; screenshots carry `34-actual-browser-zoom-*` only if the test actually reached those targets. Reflow at 320 CSS pixels alone does **not** establish actual 400% browser zoom.
- CI screenshot, WebM and Playwright trace evidence is from fixed fictional sample API routes. Do not include customer identifiers, real connection credentials or external data.

## Next manual verification gate

Before any claim of WCAG conformance or customer superiority, perform a recorded but privacy-safe task study with representative users, including Windows/NVDA + Chrome/Edge, macOS/VoiceOver + Safari, mobile VoiceOver/TalkBack, and 200%/400% zoom in an interactive desktop browser. Check index speech, chart summaries/table headers, live filtering announcements, focus return, scrolling, chart-color meaning, touch targets and target-level contrast. Record task completion/error/time independently of automated success.

References: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [W3C reflow understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [Playwright accessibility guidance](https://playwright.dev/docs/accessibility-testing).
