# UX-36 — Partial data availability and dashboard recovery (Issue #114)

## What the implementation can and cannot observe

Built-in fictional commerce and channel data is synchronous. Individual widgets do not issue remote queries. Thus live-widget loading, timeouts, failed network requests, stale rows and per-widget network retries **cannot honestly be represented** by the current source layer. Dashboard *definition* loading, refresh and authorization checks do use an API and can fail.

## Outcomes

- Sample cards classify available records, filtered no-matches, and unsupported/missing sources independently. No matching rows never become a displayed zero; invalid widgets remain in place while valid neighbors render normally.
- A compact dashboard availability overview is shown only for non-ready cards, and avoids suggesting an incomplete set of metrics can be aggregated.
- An empty channel match allows only a supported local filter clear action; no fake source retry.
- Embedded reloading is explicitly **dashboard-definition** reloading, not live metric refresh. Previously loaded content stays in place **while a recheck is in flight** for the same dashboard, preserving focus and filters. Any failed dashboard lookup (including 503) removes it: successful organization membership alone cannot re-establish *dashboard-level* permission. Unauthorized, missing-membership and changed-target paths likewise fail closed. Retry restores allowed sample URL filters, not cached authorization.
- No new data transports, storage, tenant authorization logic, or persistent schema; browser history, URL-scoped filter state and host navigation stay owned by existing components.

## Verification notes

Exercise a deterministic mixed dashboard, unmatched channel, unsupported metric/source, transient server error, permissions failure, keyboard focus and forced-colors mode at 1440/768/390/320 CSS px. CI browser screenshots and axe are automated evidence, not human screen-reader validation or user testing. Browser zoom must be separately validated with actual zoom rather than inferred from CSS viewport widths. Full source freshness and per-widget retry require a future real data lifecycle.
