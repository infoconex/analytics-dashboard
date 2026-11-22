# UX-4e — Exact data tables and focus-safe filter recovery

Tracking: [Issue #30](https://github.com/infoconex/analytics-dashboard/issues/30). Continues [UX-4d](accessibility-ux4d.md). This is a **scoped WCAG 2.2 AA-oriented usability increment**, not a conformance assessment or a claim of screen-reader validation.

## Evidence-led choice

The UX-4d post-merge [Verify artifact](https://github.com/infoconex/analytics-dashboard/actions/runs/43804814455) was downloaded and its actual screenshots inspected. In `28-return-to-index-desktop`, the 12-widget dashboard is navigable through its visible numbered index, but the native **Channel details** table displays **1.8K** for 1,820 and **1.5K** for 1,530. In `29-filtered-chart-insight-and-table`, the disclosed bar-chart table correctly displays **1,530** while the neighboring native Channel details table displays **1.5K**. The discrepancy prevents trustworthy exact comparisons and is particularly harmful when visual charts are unavailable.

The existing filter controls also removed the currently focused **Remove filter** chip or **Reset filters** button during a React update. Without explicit recovery, keyboard focus could fall onto the document rather than a meaningful surviving control. These were code-observed risks and testable behaviors, **not** claims about what NVDA or other screen readers announced.

UX-4e makes these targeted changes:

1. Native dashboard table cells reuse the already established detailed formatter, matching chart data alternatives and keeping full sample counts. Only visual chart axes and headline metrics use compact notation. The native table explicitly labels the whole-number share column **Share (rounded)**; exact counts are authoritative. The selected row's filtering action includes the channel name and `aria-pressed`, so its identity and selected state remain available in the accessibility tree after filtering.
2. When a filter chip disappears, focus moves to its surviving named native select, which now reflects the updated value. Reset returns to the channel select if a channel filter was active, otherwise to the date select. A layout effect restores focus after React commits and before the paint. The existing persistent polite status region continues to report the filter scope.
3. Preserve the 12-widget index-to-heading and return-to-exact-entry route, sample-only API fixture, existing chart insights, saved widget order and responsive layout. No new dependency, server endpoint, tenant rule, credential transport or persistence change.

## Representative acceptance evidence

| Task | Reproducible check | Boundary |
| --- | --- | --- |
| Find widget 12 and return | Keyboard Enter/Tab traversal through index, chart controls and back action; exact matching index button focused | Scripted Chromium task, not user study |
| Read exact values | Native row/column headers and `1,820` / `1,530`; compare with filtered chart table `1,530` | Sample values, not production data |
| Apply/remove channel | Native select, focused remove chip + Enter, selected value and polite status, five restored native rows | DOM/focus assertion, not spoken feedback |
| Reset one/two filters | Focus a transient Reset button, activate with Enter, assert focus on surviving field and unfiltered status | No latency/speech measurements |
| Dense reflow and targets | 1440/768/390/320 CSS-pixel captures; no document overflow; representative index/return/table/filter targets at least 24×24 CSS pixels | Responsive width, not native 400% zoom; targeted inventory only |
| Forced colors and data | Screenshot of focused deep-widget return with forced-colors emulation, chart tables and legend | Simulation, not Windows High Contrast or human inspection |

Two native table unit tests first failed against abbreviated values, then passed with the detailed formatter. Playwright expands the scripted filter-focus and dense-table scenarios, and the visual suite saves new `35-exact-native-table-desktop` and `36-filter-removal-focus-desktop` captures alongside existing desktop/tablet/mobile/320/forced-colors PNGs, WebM, traces and zoom-attempt JSON. GitHub Verify is the authoritative browser runner where this environment cannot launch its own Playwright Chromium.

## WCAG 2.2 AA-oriented mapping

| Success criterion | Relevant evidence | Outstanding validation |
| --- | --- | --- |
| 1.1.1 Non-text content; 1.3.1 Info and relationships | Chart insight plus native caption, row/column headers and complete sample counts | Spoken table navigation with actual assistive technology; complex chart interpretation |
| 1.3.2 Meaningful sequence; 2.4.3 Focus order | DOM widget order, index → heading → card → exact index entry, and filter control recovery | Screen-reader virtual cursor and all-browser traversal |
| 1.4.3 Contrast; 1.4.11 Non-text contrast | Existing token/axe assertions and forced-color screenshots | Full custom-color, SVG mark, focus and state inventory |
| 1.4.4 Resize text; 1.4.10 Reflow | Responsive tests at 320–1440 CSS-pixel widths | **Genuine** 200%/400% browser zoom at supported desktops, including browser chrome and keyboard use |
| 2.1.1 Keyboard; 2.4.7 Focus visible; 2.4.11 Focus not obscured | Real browser Tab/Enter events in CI, focus-location assertions, screenshots | Visual/manual confirmation of all controls and sticky occlusion in actual browsers |
| 2.5.8 Target size (minimum) | Representative dense-dashboard controls measured against 24×24 CSS pixels | Complete controls/spatial exceptions and touch target inventory |
| 4.1.2 Name, role, value; 4.1.3 Status messages | Native named filter selects, status-region DOM updates, pressed row controls and exact table headers | Actual screen-reader announcement timing, interruption/repeat behavior and voice output |

WCAG **2.4.13 Focus Appearance is AAA**, not AA. Focus indication is improved/tested without claiming this AAA requirement is fulfilled.

## Actual environment and unsupported combinations

- This environment ran local Vitest/TypeScript/Vite checks. Its Playwright browser cannot start: native Chromium fails with `process_singleton_posix.cc: socket() failed: Operation not permitted`. Downloading the pinned Playwright Chromium also failed due to a truncated browser archive. GitHub Actions can run the independent browser suite.
- The available interactive Chromium desktop did not reach the local application port (`ERR_CONNECTION_REFUSED`), so there is **no hands-on application browser-zoom session** from this environment.
- In UX-4d headless CI, Chrome's `Control+Equal` shortcut did not change viewport dimensions or `devicePixelRatio`. It is an unsuccessful zoom attempt, not a passed 200% or 400% test. UX-4e preserves that explicit failed-attempt evidence. A CSS 320-pixel viewport is **not** genuine browser zoom.
- **No NVDA, JAWS, VoiceOver, TalkBack or Orca session was performed.** Accessibility trees, axe, keyboard automation and recordings do not contain screen-reader speech or establish live-region announcement timing. No real human participant or Kibana comparative usability measurements exist.

For a future manual gate, run the same 12-widget tasks on Windows/NVDA + Chrome/Edge, macOS/VoiceOver + Safari and Android/TalkBack or iOS/VoiceOver. At real desktop 200% and 400% zoom, record viewport/DPR alongside browser UI zoom level, exact keyboard focus, speech order, status announcement sequence, target and focus appearance, any horizontal scroll and task success/error/time. Record both failures and unsupported combinations, using only fictional sample data.

References: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [reflow understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), and [WAI screen-reader evaluation](https://www.w3.org/WAI/test-evaluate/).
