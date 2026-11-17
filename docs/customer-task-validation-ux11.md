# UX-11 — End-to-end customer task validation and friction reduction

Tracking: [Issue #48](https://github.com/infoconex/analytics-dashboard/issues/48). Baseline `f32a52fc43faace3faeca9c3f428b6ee10e998ae` (UX-10). **Fictional sample-only evaluation, not human usability validation or production access testing.** The customer-facing product principle remains **simple by default, powerful when needed**.

## Engineering kickoff and pre-change evidence

The existing UX-1–UX-10 paths supply question-based discovery, data-derived summaries and exact tables, independent filters, indexed dense-dashboard navigation, scoped organization routing, saved-resource sharing, and read-only same-origin embedding. Reviews of `App.tsx`, `DashboardConsumer`, `DashboardCanvas`, `WidgetTile`, `DashboardFiltersBar`, `ShareContextDialog`, `EmbeddedDashboard` and the discovery, interpretation, handoff, organization and embed Playwright suites exposed three specific gaps:

1. `loadDashboards` previously left the dashboard list intact when a subsequent refresh failed. An initial failed request also rendered the empty-question discovery UI, making service unavailability look like a genuine absence of dashboards. Neither is supported by the response. **Change:** suppress stale fetched definitions and show a named failure state with Retry; do not invent zero matches or expose stale rendered content after a possible permission revocation. The API remains authoritative for membership and authorization.
2. SPA navigation from a rendered button to a new dashboard, catalog or recovery view previously unmounted that button without an explicit focus destination. **Change:** focus the new heading after view transitions and loading, except for the UX-8 question guide, which already focuses the exact question heading. Never steal focus on ordinary filter changes or dialog closing.
   New focused headings have a visible high-contrast outline, including in forced-colors mode.
3. An unsupported standalone hash previously silently displayed Overview. **Change:** retain all accepted standalone and scoped hash forms, show a concise invalid-destination notice, and replace the URL with an authorized organization overview without reflecting the malformed fragment. Existing unknown-organization fallback remains.

The question-to-widget flow deliberately retains two actions: select a question, then confirm the guide's matching visualization. Its contextual explanation prevents an unanticipated jump into a lower chart. A direct auto-jump might reduce one scripted click but lacks genuine customer evidence of improved comprehension. Similarly, avoid extra progress bars, badges, persistent task state and redundant controls without an observed task barrier.

## Acceptance scenarios and scripted paths

| Scenario | Customer task and verifiable endpoint | Coverage |
| --- | --- | --- |
| SC-UX11-01 | Arrive at a named authorized organization, identify fictional data, choose revenue question, land on the relevant heading | `customerTasks.spec.ts`, `discovery.spec.ts` |
| SC-UX11-02 | Read metric, units, provenance, limitations and exact supporting table values | `customerTasks.spec.ts`, `interpretation.spec.ts` |
| SC-UX11-03 | Apply independent final-three-month and Direct filters; reset without altering the saved dashboard; return focus to a surviving select | `customerTasks.spec.ts`, `consumer.spec.ts` |
| SC-UX11-04 | Find visualization 12 with keyboard-friendly selector and return to its exact numbered index entry | `customerTasks.spec.ts`, `accessibility.spec.ts`, native tab zoom |
| SC-UX11-05 | Review/copy insight context, distinguish saved link from ephemeral filters, revisit defaults | `customerTasks.spec.ts`, `handoff.spec.ts` |
| SC-UX11-06 | Recover from initial/refresh failure, missing dashboard, invalid hash and unauthorized location without false emptiness or leaked state | `customerTasks.spec.ts`, `organization.spec.ts`, real .NET authorization tests |
| SC-UX11-07 | Switch organization and clear previous dashboard, search, interpretation and filter context | `customerTasks.spec.ts`, `organization.spec.ts` |
| SC-UX11-08 | Repeat read-only exact-value, filter, share and focus paths in the existing same-origin sample host without write requests | `customerTasks.spec.ts`, `embed.spec.ts` |

The automated script records discrete intended actions, observed values, focus destinations, OS, Chromium version, errors and screenshots. Step counts are **script actions**, not participant time, task success rate, ease ratings or measured reductions in real user effort. Tests may use intercepting fictional fixtures for deterministic view behavior, while the existing API-backed suite separately verifies service and tenant contracts. Do not infer human superiority from automated completion.

## Boundaries and architecture review

- Changes stay in presentation-state handling, a pure existing-hash grammar check, browser regression tests and documentation; no new backend routes, public protocol, persistence, dependencies, runtime query capability, or transport behavior.
- `dashboardLoadFailed` is a transient presentation state and never a security determination. Failed list retrieval clears prior UI definitions; server-side membership and per-resource enforcement remain mandatory. Retrying uses the existing authorized GET. No unauthorized status is turned into a default dashboard or alternate tenant read.
- Organization changes still key consumer state on organization and dashboard and drop temporary search/question/share state. Share links contain existing organization and dashboard identifiers only; current filters and interpretations are neither serialized nor persisted.
- Browser back/forward or pasted hash navigation clears the previous ephemeral question guide, and failure to reauthorize dashboard retrieval clears pending share dialogs and transient snapshots before the next successful GET.
- The existing same-origin iframe remains a viewer-only sample. No cross-origin messages, auth changes, production data activation, credential logging or host embedding expansion.
- The validation intentionally checks stale/invalid/no-access outcomes without injecting raw untrusted hash segments into visible error text or logs.

## Verification and independent gates

Local verification: Vitest, TypeScript compilation and Vite production build. CI must run NUnit, SQL Server/PostgreSQL real-provider integration, all Playwright scenarios, and C#/JavaScript/TypeScript CodeQL. Inspect the **actual** attached desktop 1440×900, mobile 390×844, narrow 320×900, forced-color and genuine 200%/400% Chromium tab-zoom screenshots; record effective viewport, device-pixel ratio and zoom factor. Check names, reading order, keyboard focus, error and filter recovery, native disclosures, overflow and embedded/standalone behavior. A screenshot or axe pass cannot establish real screen-reader speech or WCAG 2.2 AA conformance.

The independent 8–12-person counterbalanced Analytics Dashboard versus pinned Kibana 9.5.6 / Elasticsearch 9.5.6 task study, real assistive-technology testing and full WCAG audit remain **unpassed**. No claims of improved human task timing, market superiority or production readiness are supported until those gates complete.
