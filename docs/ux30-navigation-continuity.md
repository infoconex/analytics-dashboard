# UX-30 — Dashboard navigation and authoring context continuity

Issue [#91](https://github.com/infoconex/analytics-dashboard/issues/91). Branch `ux30/dashboard-navigation-continuity`. Baseline UX-29 squash SHA `e32f13131e9e4f887bc3869c1fcaf30b0761c988`; post-merge Verify and CodeQL both succeeded.

## Inspected friction and changes

| Existing behavior | Targeted UX-30 change |
| --- | --- |
| UX-29 kept catalog query/question/sort state in React while visiting a dashboard, but returning focused the catalog title and did not restore the item/scroll position. | Record the organization, opened dashboard ID and scroll position **in memory only**. Both the visible return control and browser Back restore focus to that authorized card's View dashboard action and the previous scroll position when the card is still present; otherwise focus falls back to the catalog heading. |
| Detail header offered an icon-only return button and `DASHBOARD · OVERVIEW`, which could be confused with the workspace Overview. | Show a compact visible **Dashboards** return label and **VIEWING SAVED** / **EDITING DRAFT** context, retaining the existing action toolbar and authoring persistence explanation. |
| Editing a reusable visualization unmounted the library picker, losing the user's search, type filter, sort and preview selection on return. | Keep the authorized library picker context in parent component state only through template authoring. Reset when opening a fresh picker or switching organizations; preserve on editor cancel/save and library retry. |
| Declining unsaved-change confirmation after browser Back/Forward rewrote the attempted history entry using `replaceState`. | Stamp in-tab hash history entries with a small monotonically increasing ordinal in `history.state`. Reverse a rejected known Back/Forward traversal using `history.go`, including multi-entry jumps; retain the original authoring draft. Preserve unrelated history state values. |

The return point contains no business data, no sensitive identifiers from another organization, and does not survive reload. It is cleared on organization switches; restoration is further gated by current authorized organization-scoped dashboard data. Query, sort and business-question filters remain session-local existing React state, not a server preference or URL disclosure.

History metadata is internal browser state, **not** authorization. A manually entered or external unmarked fragment still uses conservative URL replacement on a canceled draft navigation, because its direction is not reliably established. The server remains authoritative for all permissions and saved dashboard revisions.

## Automated regression coverage

- Vitest `navigationContinuity.test.ts`: safe history ordinal, preserving unrelated state, valid organization-local return point, foreign dashboard rejection.
- Playwright `ux30Navigation.spec.ts`: library search/sort survives template edit and return; dense catalog search and sort at 320/390/720/768/1440px; opened dashboard focus/scroll restoration and screenshot capture; dirty draft declined Back and accepted Back followed by Forward; refresh and direct scoped link; viewer read-only actions; sample business-question preservation and cross-organization reset; targeted automated axe audit.
- Existing dashboard creation, save, cancel, concurrency, undo, reusable template and visualization suites must continue to pass. Do not confuse automated accessibility checks with manual WCAG/human usability certification.

Capture and inspect actual PNGs for all five widths: back-label visibility, edited/viewing state prominence, toolbar wrapping, card action focus, no horizontal overflow, native scrolling and dialog transitions. `Verify` publishes sample-only PNGs and traces as `ux-visual-evidence` (14 days). Never include live customer data.

## Boundaries

Frontend routing and semantics only: no backend, schemas, data providers, enterprise embedding, production authentication, new storage or preferences. Independent saved-visualization copies, explicit dashboard Save, server revision checks, sample-only renderers and existing organization scopes remain unchanged.

## Verification log

To fill after PR checks: NUnit/.NET build, Vitest/frontend build, evaluation lab, Playwright, real SQL Server/PostgreSQL, CodeQL, five-width screenshots, squash-merge SHA, post-merge Verify and CodeQL.

## Candidate UX-31

Review dashboard/library navigation with representative users in longer tasks, especially whether editing a reusable template should expose an explicit return-to-dashboard action after library save. Keep it observation-led, not another navigation layer.
