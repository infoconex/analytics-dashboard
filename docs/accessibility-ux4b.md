# UX-4b — Accessible typography and responsive readability

Tracking: [Issue #24](https://github.com/infoconex/analytics-dashboard/issues/24).

## Customer-experience intent

Keep dashboard metrics immediately understandable while making detail easy to discover, without forcing a person to interpret color or a tiny chart label. The application is still a deterministic **sample-data** evaluation environment; no customer database queries or connection transports are activated by this increment.

## Typography and contrast

- `--type-body: 1rem` (16px at the browser default), `--type-label: .875rem` (14px) and `--type-caption: .75rem` (12px) establish a semantic light-theme hierarchy. Prominent data values and headings remain larger.
- Legacy shell, navigation, charts, consumer filters, editor controls and dashboard metadata use those tokens for informational labels. Some decorative numeric or graphics sizing still lives in legacy styles, which will be migrated when the related components are revisited.
- Reuse `--color-text`, `--color-muted`, `--color-primary`, `--color-focus` and surface tokens for visible content. Token-pair tests protect representative combinations; `@axe-core/playwright` tests assess rendered primary workflows for machine-detectable WCAG A/AA failures. Both are necessary; neither alone validates every visual state or every non-text boundary.
- The multicolor donut palette uses darker hues with more distinct light-background edges; legends combine color and text with a larger key. Contrast and information equivalence must also be reviewed in high-contrast themes.

## Chart data alternatives

Every chart that is not already a table has a native `<details>/<summary>` disclosure **View data table**, including metric sparklines. The data table uses the same current sample rows and filters as the chart, a meaningful caption, column headers and row headers. Consumers using a keyboard can read exact displayed sample values and use channel rows as selection buttons where filtering is supported. Native disclosure behavior is intentionally used instead of a new JavaScript widget or dependency.

Charts remain visual summaries, not substitutes for tables or full screen-reader exploration. `role="img"` provides a description of the chart and directs assistive-technology users to the table. Native charts may contain additional decorative SVG content; screen readers should be tested directly to confirm the optimal reading experience.

## Responsive and keyboard behavior

- Mobile navigation has an accessible expanded state, focuses its first navigation choice upon opening, supports Escape to close, returns focus to the menu trigger and keeps hidden sidebar items out of the normal tab sequence. The main region is inert while the modal-style mobile sidebar is open.
- A skip-to-content link, named workspace navigation, labeled forms and filter status announcements reduce repetitive traversal.
- The layout uses single-column controls and charts at mobile widths; at 320 CSS pixels summary metrics stack, panels reflow, and chart tables scroll within their region rather than widening the whole page.
- Forced-colors overrides retain system-color borders, interactive selection and focus indication. Reduced-motion preferences disable nonessential CSS motion.

## Verification and visual evidence

Run `npm ci`, `npm run check` and `npm run test:e2e` from `web/` (the last requires .NET 10 and Playwright Chromium). The new Playwright readability suite tests rendered A/AA rule violations via the established `@axe-core/playwright` integration, 320–1440 CSS-pixel reflow, key text sizes, chart table disclosure, mobile Escape/focus and forced colors.

Use `npm run visual:evidence` to capture the deterministic desktop/mobile journey plus tablet, 320px reflow, open chart table and forced-colors states. It records PNG screenshots, browser WebM recordings and Playwright traces as CI artifact **ux4-visual-evidence** (14-day retention).

If the machine has no .NET SDK but can launch Playwright Chromium, `npm run visual:ui-only` starts Vite and runs **only** the deterministic visual scenarios; all their demo API routes are intercepted. This is not a substitute for the application API, authorization or full suite. Compare CI UX-4a Issue #22 evidence with UX-4b Issue #24 evidence at native resolution for before/after review.

## Explicit limitations — no WCAG conformance claim

- Automated axe checks and token assertions detect only subsets of WCAG criteria. Human evaluation of text/non-text contrast in every state, focus order, visible targets, chart encodings and error recovery remains necessary.
- 320 CSS-pixel viewport reflow approximates the effective layout width at 400% zoom from a 1280 CSS-pixel starting width. It is **not** actual 400% browser zoom. Manual browser zoom at both 200% and 400%, with text scaling and browser UI, is still required on supported operating systems.
- NVDA/JAWS/VoiceOver screen-reader sessions, touch-screen screen-reader gestures, keyboard traversal of every page and browser/OS forced-color combinations have not been exhaustively verified. Test with representative assistive-technology users before making conformance claims.
- Comprehensive dark theme, dense-dashboard navigation, broader data-visualization encodings, interactive chart keyboard equivalence (beyond filters and tables), 24×24 WCAG 2.2 target inventory and user-research task metrics remain follow-on work.

Reference: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/), [W3C reflow understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Playwright accessibility-testing guidance](https://playwright.dev/docs/accessibility-testing).
