# UX-32 — Embedded dashboard viewer and host navigation

Issue: [#103](https://github.com/infoconex/analytics-dashboard/issues/103)

## Scope and observation

The UX-6 sample host provided one hard-coded dashboard, while the embedded consumer preserved neither time range nor channel selection through a frame reload. The host had no dashboard discovery, host Back/Forward model or account-return state; embed links could only identify a resource.

UX-32 keeps the simple, **same-origin demonstration** rather than introducing an SDK, navigation framework or message broker:

- **Host owns navigation.** The fictional Northstar portal gets permitted dashboards from the existing authenticated Northstar GET collection, offers labeled links, and uses its own fragment routes: `#account-summary`, `#analytics-section`, `#insights/{dashboard-guid}`. Browser history is host history, with iframe navigations replaced instead of pushed.
- **NEXA owns dashboard content and filters.** It accepts a validated `#/organization/{org}/dashboard/{guid}` locator with optional `period=3m|6m|12m` and one recognized fictional channel name. Filter changes update the embedded fragment with `history.replaceState`, avoiding history noise; the same-origin sample host snapshots validated child locators per dashboard before switching.
- **No privilege in URLs.** The host only lists server-authorized Northstar dashboards. Embed continues to GET both dashboard and membership and verify IDs. 401, 403 and 404 show distinct guidance; 503/network errors show Retry. Unknown host IDs are not navigable and leave the previous embedded view hidden.
- **No extra NEXA administration.** Frame keeps only read-only dashboard viewing, visualizations, tables and sample share context. Account and dashboard navigation stay visibly outside the frame.
- **Development-only realism.** A second `Channel performance` dashboard is seeded only when Development identity is enabled, also for existing development databases. It uses fictional sample visualizations; no production seeds or connection runtime enabled.

## Manual product review scenarios

1. Enter `/sample-host.html`, change Business performance period to 3 months and channel to Direct. Choose Channel performance; choose Organic search. Return to Business performance: the prior period and channel remain. Return to Account and back without losing context.
2. Use browser Back and Forward through dashboard selections and account context. The host owns page history; select changes inside NEXA do not add entries.
3. Open `/sample-host.html#insights/c730b8e2-4990-42b7-80cc-71b47290aec4` directly. Open `/embed.html#/organization/northstar/dashboard/a8bb1bc7-a1d5-4ea5-9268-6b1b7c0a3441?period=6m&channel=Direct`, reload and confirm filters.
4. Try an unknown dashboard GUID: no stale frame content appears. Deny a dashboard via API: the embed offers permission guidance, not a role-escalation link. Retry server outages without injecting host permissions.
5. Keyboard-tab through host navigation, dashboard selection, frame and return link at 1440, 768, 390 and 320 CSS px. Inspect the host *and iframe* for horizontal overflow and clear focus. Review screenshot evidence from `web/e2e/ux32EmbedNavigation.spec.ts`.

## Automated coverage

- `web/src/embedRoute.test.ts`: route allowlist, filter round-trip, duplicate/unknown/malicious query rejection.
- `web/src/sampleHostRoute.test.ts`: account and dashboard host routes, scoped list item validation.
- `web/e2e/ux32EmbedNavigation.spec.ts`: state continuity, back/forward, deep-link and reload, host API failures, denied/missing dashboard states, axe and four widths, actual development-seeded second dashboard and cross-tenant denial.
- `web/e2e/embed.spec.ts`: established embedded keyboard and accessibility tests adjusted for host selection.
- `scripts/ci/verify-compose-smoke.sh`: both development dashboards, direct secondary API retrieval, cross-tenant 403 and host HTML.

**Evidence boundary:** Browser assertions and axe cannot establish actual screen-reader behavior, human task success or WCAG conformance. Inspect stored CI screenshots and test results rather than claiming a manual usability study occurred. Production cross-origin framing, SSO/session handoff, origin-bound messages, iframe sizing, CSP, customer data and server-side embed role remain separate unapproved security gates. No passwords, personal data or authorization tokens belong in either URL fragment.
