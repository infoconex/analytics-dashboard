# UX-34 — Long-dashboard wayfinding and narrow-screen data legibility

Issue: [#110](https://github.com/infoconex/analytics-dashboard/issues/110)

## Code audit — baseline UX-33 main

The existing direct finder and expandable full index supported 12 visualizations, focus jumps and exact return-to-index buttons, but the return button lived **after** each card's chart, interpretation, controls and potentially expanded data table. Long cards made returning to the index needlessly distant. The index did not offer a one-click return to the previously visited visualization. Saved tables had max-height (235/300px, with a saved-height override), and chart-data alternatives had max-height 300px; each used overflow:auto, introducing nested vertical scrolling. Narrow columns could compress labels/values without a clear horizontal-scroll cue. This is a code-level baseline finding, not a claim of user-study measurements.

## Changes

1. **Two-way navigation, no new global chrome.** Keep the 8+ card native finder and existing full index. Add a short *Index* button beside each read-only card's heading (including unavailable cards), preserve the existing end-of-card return, focus the exact index item, and reveal a *Return to [visualization]* action in the expanded index. Direct selection updates the native finder value. Removed widget IDs are ignored; 1–7-card dashboards and editing/undo flow are unchanged. All state remains in the dashboard React component; no host navigation, URL writes or saved edits.
2. **Horizontal-only tables.** Reuse a small scrollable table wrapper for native saved tables and expanded chart alternatives. Use a measured ResizeObserver scroll range to render a truthful cue when columns are hidden; update that cue when horizontally scrolling. The region has an accessible name, is keyboard focusable and uses aria-describedby only while the cue is relevant. A 380px minimum table width keeps labels and full numeric values legible at 320/390px, while horizontal scrolling is contained to the region. Remove table max-height constraints so **vertical** scrolling belongs to the document/host, including when data tables are expanded. Preserve semantic table captions, column/row headers, exact values, channel filtering and chart alternatives.
3. **Visual/accessibility styles.** Provide 44px navigation controls, visible focus, forced-color outlines/borders, and proportionate mobile table padding without hiding chart labels or replacing tables with unlabeled cards.

## Browser evaluation

The deterministic 18-widget fictional dashboard is served through a route-mocked, read-only Northstar sample host. The Playwright suite checks:
- Direct selection of widget 16 at 1440, 768, 640, 390 and 320 CSS pixels; keyboard heading focus, top-of-card index return, exact focused index button, return to the same visualization, filter persistence, host-owned vertical scrolling and no host/child horizontal overflow.
- Native horizontally scrollable channel table and expanded revenue data table at 390/320; column/row headings, exact "1,820" and "$18,400" values, arrow-key scrolling, visible/updated overflow hint, and no nested vertical table scrollbar.
- 320px forced colors with a focused navigation button and axe automated scan, no API writes and no cross-tenant requests.
- PNG captures at deep, table and expanded states, plus `ux34-wayfinding-geometry.json` and `ux34-table-geometry.json` attached to Playwright output; permanent CI retains browser evidence as artifacts.

### Zoom qualification

640px and 320px are **CSS reflow equivalents** of 200% and 400% zoom when a 1280px wide layout is magnified. These tests do not claim a genuine browser chrome zoom change. Existing separate zoom browser scenarios provide supplemental coverage; actual assistive technology speech and human usability sessions remain outside this increment.

## Security and architecture

Same-origin host geometry measurement from UX-33 remains a sample demonstration only; this increment does **not** add iframe messaging, production cross-origin coordination, tenant access decisions, server writes or changed API contracts. Backend authorization remains authoritative. Host history and dashboard navigation stay with the host; finding a chart and filter selections remain inside NEXA. CodeQL, full browser suite, backend tests, SQL Server/PostgreSQL conformance and Compose verification remain permanent CI gates.

## Evidence review checklist

Review actual 1440/768/640/390/320 PNGs, 320 forced-colors, expanded tables and JSON geometry for host-only vertical scroll and any clipping/overlap. Verify that the index return is discoverable, that long headings remain fully visible and that value columns never become illegible. Browser automation and axe are useful regression evidence, but do not certify WCAG conformance, user comprehension or production cross-origin embedding.
