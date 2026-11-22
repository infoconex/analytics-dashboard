# UX-33 — Embedded viewport, scrolling, and reload continuity

Issue: [#105](https://github.com/infoconex/analytics-dashboard/issues/105)

## Problem found on UX-32 main

The Northstar sample host embedded one dashboard in a hard-coded 900px (760px mobile) iframe, which could introduce competing page/frame scrollbars on long dashboards, truncate the visible area for keyboard users, and waste space for short, loading, empty or denied states. Host-only per-dashboard filter snapshots were an in-memory Map and disappeared on a full host document reload. The HTML also immediately loaded a fixed dashboard before the host had verified its authorized dashboard list.

These are **same-origin demonstration** limitations. They do not authorize production iframe integration or an unaudited cross-origin communication protocol.

## Focused change

- **Host-owned scrolling and sizing.** The sample host observes the rendered `.embedded-shell` with a native `ResizeObserver`, measures its intrinsic height rather than the iframe viewport, and updates the iframe height. The iframe now has a small, stable initial footprint and an accessible loading presentation; short/empty/error dashboards shrink, while long dashboards expand into the host document's natural scroll. Window/visual viewport resizing triggers remeasurement. Chart data disclosures and responsive wraps are handled by the content observer. Independent horizontal scrolling in wide data tables remains available. The host provides CSS-only visible-window coordinates so a native share dialog in a tall iframe stays near the visible host viewport instead of centering thousands of pixels away; standalone dialog placement is unchanged.
- **Authorization before iframe navigation.** The sample iframe initially points at `about:blank` and is hidden. The host fetches its existing authenticated Northstar collection, then navigates to only an authorized dashboard. An authorization failure keeps the frame hidden and blank; retry rechecks the list. Deep-linked dashboard IDs not in that collection never become frame destinations. The embedded application independently checks membership and resource identity.
- **Reload-safe fictional filter context.** The child continues to own `period` and `channel`. Same-origin host observers read the child’s validated fragment after interactions, dashboard changes and `pagehide`; a same-tab `sessionStorage` entry stores at most 20 allowlisted resource/filter locators. Values are parsed through the existing strict `parseEmbedTarget` allowlist and re-formatted, and denied or no-longer-listed dashboards are discarded after a fresh authorized list. The host URL still controls dashboard/account history; child filter changes still replace their own fragment. Session storage is optional and failures fall back to defaults. Never put credentials, raw data, permissions, or PII in this snapshot.
- **No new protocol.** Reading the child document and observing events is intentionally restricted to the existing same-origin fictional portal. A customer deployment must separately review session propagation, CSP/frame ancestors, cross-origin sizing/messages, privacy and authorization. Do not transplant this demo mechanism into a production cross-origin environment.

## Verification scenarios

1. Open `/sample-host.html` with a 12-widget dashboard. At 1440, 768, 390 and 320 CSS pixels, confirm the iframe expands to actual content, the host owns vertical scrolling, and neither host nor child has unintended horizontal overflow. Expand and collapse a chart data table and confirm resizing in both directions. Scroll to the host's after-dashboard return navigation.
2. Choose a period and channel in the first dashboard. Reload the **host** document: selections remain. Choose a second authorized dashboard, change its channel, reload, and return to the first: each keeps only its own sample filters.
3. Go to Account and back; use browser Back and Forward. Host nav keeps keyboard focus on a visible heading or dashboard selector and does not expose child authoring controls.
4. With the host dashboard list returning 403, reload a previously viewed page: the iframe stays blank and hidden until authorization succeeds. Retry after restoring access. An unknown or now-disallowed dashboard ID remains unavailable, regardless of cached filter snapshots.
5. Review short/empty, recovery, mobile and forced-color states; run axe scanning and keyboard/focus checks. A direct `/embed.html#/organization/...` remains a standalone read-only route with safely validated filters after reload.

## Automated coverage and evidence

- `web/e2e/ux33EmbedContinuity.spec.ts`: real Chromium measurements of iframe content vs viewport, dynamic disclosures, full host scrolling, four responsive widths, per-dashboard reload, denial/retry, short states, forced-colors and screenshots; recorded `ux33-viewport-evidence.json`.
- Existing `web/e2e/embed.spec.ts` and `web/e2e/ux32EmbedNavigation.spec.ts` continue covering keyboard navigation, read-only controls, host/iframe separation, direct links and browser history.
- `scripts/ci/verify-compose-smoke.sh` verifies the sample host has an inert initial iframe as well as actual two-dashboard API and cross-tenant denial through Compose.
- Permanent CI workflow and script names stay capability-based.

**Evidence limits:** Browser assertions, screenshots, and axe do not constitute a screen-reader usability study or full WCAG compliance. Inspect actual screenshots and recorded browser measurements before merging. Do not mistake sample-data or same-origin success for production cross-origin readiness.
