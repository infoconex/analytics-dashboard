# UX-10 — Context-preserving insight handoff and task completion

Tracking: [Issue #46](https://github.com/infoconex/analytics-dashboard/issues/46). **Fictional sample-data evaluation only.** This is not a production sharing system, collaboration permission, synchronized report, live-data export, or supported embedding interface.

## What a customer can do

1. Find a dashboard from the authorized organization catalog, an overview recent item, or its stable existing organization-scoped hash link. Follow a question to a supported visualization. Dense dashboards retain their native visualization finder, numbered index, precise heading focus and return-to-index action.
2. Choose **Share** on a dashboard or catalog card to review the destination before copying. The disclosure identifies the organization, saved dashboard, fictional source, and that the link opens with **default** filters. It does **not** claim to capture the current filters, the expanded table, the question, or the selected chart.
3. Optionally expand **Include your current viewing context** and copy a distinct plain-text note identifying the independent commerce and marketing-channel selections, fictional provenance, missing refresh timestamp, limitations and saved dashboard link. The note reflects the moment of copying; it is not saved or automatically updated.
4. For a particular chart, expand **What this means**, then choose **Share this insight’s context**. The separate note adds the visualization, UX-9 metric definition and unit, actual selected coverage, valid plain-language chart summary when available, every exact supporting sample value and limitations. Unsupported metrics do not receive a fabricated note.
5. A recipient follows the existing link subject to current server authorization. Temporary filters, expanded disclosures and visualization selection do **not** travel through that link. Reloading or changing dashboard/organization returns to defaults. Clipboard denial selects the field for manual copying, with an accessible status; dismissing the native modal restores invocation focus.
6. The same-origin sample host permits read-only insight-note copying inside its iframe. It still does not allow creation, editing, privileged host messages or a cross-origin integration protocol.

## Boundary and design decisions

- **No URL filter serialization.** Adding filter fragments or query parameters would change link semantics and increase disclosure and mistaken-persistence risk. The approved existing `#/organization/{id}/dashboard/{id}` grammar is unchanged, including on `/embed.html`. A copied link is a locator only, not authorization. A copied context note explicitly distinguishes a temporary snapshot from saved content.
- `web/src/insightHandoff.ts` is a pure formatter. It reuses `sampleMetricContext`, `chartInsight`, `selectConsumerRows`, `formatDetailedMetric` and `organizationHash`. It verifies widget membership in the loaded authorized dashboard before generating a note; unsupported metrics or empty records produce no inferred values. `ShareContextDialog` handles display/copy/fallback. No new packages, API routes, domain contracts, persistence or infrastructure adapters are involved.
- The current filter snapshot used by the standalone **Share** button is keyed by organization **and** dashboard. A catalog share always uses defaults. Navigation and hash changes drop snapshots and pending dialogs. A widget note receives the active consumer's filters directly. The embedded surface obtains authorized dashboard and membership details through existing GETs and never introduces editing callbacks.
- Membership and tenant-scoped dashboard retrieval remain server-side; a client route, text note, copied link, viewer-hidden authoring control or iframe cannot create rights. Organization names/identifiers and fictional examples are the only data placed into the copied note; no credentials, live results, personal data, authentication tokens or filter state are placed into the URL. The viewer should still treat copied organizational context as information shared with the recipient.
- Existing 401/403/404, missing dashboard, invalid organization, and retry/recovery behavior stay intact. The sample's dashboard definition save date is **not** a data freshness timestamp. There is no integration with production transports or provider-backed queries.

## Traceability and evidence

| Scenario | Verification |
| --- | --- |
| SC-UX10-01 — find and revisit | `handoff.spec.ts` catalog/dashboard/reload; existing discovery, navigation and organization suites |
| SC-UX10-02 — true link scope | `insightHandoff.test.ts`, dialog and clipboard-failure browser tests |
| SC-UX10-03 — exact contextual note | `insightHandoff.test.ts`, browser interpretation and independent filter tests |
| SC-UX10-04 — stale/missing/tenant context | Browser tenant-switch, invalid hash, missing dashboard recovery; existing .NET authorization cases |
| SC-UX10-05 — keyboard/focus | Native modal focus-return, dense index/heading/return; keyboard-only browser path |
| SC-UX10-06 — embedded consumer | Framed same-origin sample flow, no write attempts, existing embed authorization tests |
| SC-UX10-07 — responsive/accessibility | 1440×900, 390×844, 320×900, forced colors, actual Chromium 200%/400% extension zoom, axe in dialog, raw screenshots |

The local `playwright.handoff-ui.config.ts` runs fictional-API frontend fixtures without .NET, for quick visual iteration. CI's default Playwright configuration is API-backed and its existing NUnit and real SQL Server/PostgreSQL conformance gates remain mandatory. Capture OS, Chromium version, viewport, actual zoom/device pixel ratio, scripted steps, errors, focus and overflow for each completed run. Inspect the original screenshots rather than relying on DOM assertions alone. Automation cannot establish that human users understood the flow.

**Unpassed independent gates:** genuine NVDA/JAWS/VoiceOver/TalkBack/Orca spoken output; a full WCAG 2.2 AA audit; a provisioned equivalent Kibana 9.5.6 / Elasticsearch 9.5.6 environment; and a counterbalanced 8–12-person task study. Do not claim WCAG conformance or superiority over Kibana on these engineering artifacts.
