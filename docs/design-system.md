# UX-4a — Design system, accessible dialogs and visual evaluation

Issue: [#22](https://github.com/infoconex/analytics-dashboard/issues/22).

The goal is a coherent, approachable **light theme** and repeatable visual evidence, not a claim that the application already satisfies WCAG 2.2 AA. The product principle remains *simple by default, powerful when needed*.

## Foundations

- `web/src/design-tokens.css` owns semantic colors and surfaces, light-theme typography, spacing, radii and shadows. Prefer semantic references such as `--color-muted` and `--color-primary` over hard-coded values in new components. The existing CSS still contains many legacy literals, to be migrated gradually.
- `web/src/ui/Button.tsx` owns primary, secondary (`light`) and quiet variants while retaining native button semantics and standard HTML props. Default type is `button`, avoiding accidental form submissions.
- `web/src/ui/ModalDialog.tsx` uses native `showModal()` for an inert background and semantic title/description. A small explicit focus boundary wraps Tab/Shift+Tab, and Escape dismisses unless `busy`. Initial focus is supplied by the caller; dismissal returns focus to its still-connected trigger. Avoid embedding application permissions or persistence in this primitive.
- Shared control styling establishes a 44px primary action target, stronger foreground colors, consistent focus indicators, explicit status announcements and reduced-motion support. The key color token pairs have guarded 4.5:1 text contrast, and focus-color tokens 3:1 against base surfaces. These token tests do **not** measure every rendered foreground/background combination.
- Chart axes use compact labels and more legible text, rather than allowing large raw numbers to clip at dashboard-card edges.

## Repeatable visual captures

Playwright is the recording mechanism; no extra recorder library or runtime dependency is needed. Install .NET 10 SDK, Node 24, npm and Playwright Chromium, then from `web/`:

```bash
npm ci
npx playwright install chromium
npm run visual:evidence
```

The existing Playwright configuration starts the development API and Vite, with a disposable local SQLite catalog. The visual scenarios additionally intercept their three demo API endpoints using **fixed, fictional sample contracts**, so test order and other local dashboards cannot change the evidence. No credentials, customer data, external connectors or private URLs are captured. These scenarios never activate production database transports.

The `desktop` journey runs at **1440×900** and captures:

1. Workspace overview and dashboard library.
2. Guided exploration.
3. Dashboard consumption and active filters.
4. Composition and visualization configuration modal.
5. Empty dashboard and API-error states.

The `mobile` journey runs at **390×844**, capturing the workspace, exploration, library, consumption, active filtering, composition and visualization configuration. Screenshots are full-page PNG attachments. The two journeys also produce Playwright WebM video and trace recordings. Browser/video/screenshot files appear under `web/test-results/` and are uploaded by the `Verify` CI workflow as the **ux4-visual-evidence** artifact, retained for 14 days. Use `npx playwright show-report` only if a local HTML report has been generated; the PNGs and recordings are directly viewable from extracted artifacts.

Run the full regression suite with `npm run test:e2e`. The evidence scenarios are included so UI regressions block CI. On environments where headless Chromium is restricted, CI is authoritative for the browser suite; report local limitations explicitly.

## Human review checklist

Evaluate the screenshots at native size, especially on mobile: meaningful hierarchy, spacing consistency, legibility at default zoom, obvious primary actions, empty/error affordances, filter state, chart labels and table density. In a real browser, navigate without a pointer, open/close each modal, move focus through all controls, inspect landmarks and names in the accessibility tree, and test at 200% zoom and with a screen reader. Log observations against user impact before claiming accessibility improvement.

## Current boundaries and next audits

- **Not a comprehensive WCAG audit:** further automated accessibility scans, high-contrast/forced-colors checks, full keyboard traversal, screen-reader testing with NVDA/VoiceOver, 200%/400% zoom and contrast review of every chart/data indicator remain necessary.
- **Typography migration:** many older 10–11px secondary labels, chart legends and decorative cards remain small; a fuller typographic hierarchy and contrast audit is next.
- **Theme support:** dark theme is deferred, pending a complete semantic-token migration and contrast validation.
- **Product behavior:** dashboard thumbnails and overview metrics remain fixed demo presentations; meaningful real-data connection, user testing and accessibility claims are out of scope.
- **Real user evaluation:** task times and usability targets in [the roadmap](roadmap.md) have not been measured with representative enterprise users.

Do not treat screenshot generation or passing automated tests as accessibility certification or evidence that customers prefer this experience over Kibana.

## First visual review findings (1440px desktop and 390px mobile)

The initial deterministic captures were reviewed at native size; browser keyboard paths and mobile overflow were also exercised. These observations informed the fixes within UX-4a:

| Priority | Observed issue | UX-4a response |
| --- | --- | --- |
| High | New, empty dashboards exposed no obvious first action; filtering controls appeared even without data | Provide **Add first visualization** for editors and omit irrelevant filters |
| High | Organization-loading failure could look like an empty organization assignment; a retry did not reload identity | Distinguish service failure and add a functioning workspace retry |
| High | The first version of the native-dialog migration allowed reverse Tab to escape its logical first control in one browser | Explicit boundary wrap; test both Tab directions and trigger restoration |
| Medium | Large chart values were truncated or difficult to interpret at card edges | Compact Y-axis labels with more axis space and stronger text contrast |
| Medium | The mobile visualization picker puts multiple inputs below the first viewport | Keep its primary action accessible as a sticky dialog footer; preserve scroll for the settings |

Remaining prioritized observations:

1. **High:** Secondary text, dates, chart legends and guidance still have a number of sub-12px presentations. Consolidate a larger minimum readable type scale and verify contrast in rendered contexts.
2. **High:** Full screen-reader journeys, WCAG 2.2 AA success-criterion mapping, high zoom, touch-target inventory and forced-colors behaviors are unmeasured. Test and correct with assistive technologies before claiming conformance.
3. **Medium:** Overview metrics are fixed demo-only presentations; make their eventual real-data purpose clearer and reevaluate card affordances through usability sessions. The inert overflow icons were removed in this increment.
4. **Medium:** Very long desktop composition views and vertically stacked mobile charts require substantial scrolling; examine dashboard-density controls and navigation landmarks after observing users.
