# UX-3 — interactive dashboard consumption

Issue #20 adds immediate, coordinated filtering for **deterministic built-in samples** in the consumer view. The dashboard filter panel offers 12/6/3-month commerce ranges and a single marketing-channel choice, each scoped visibly to its own dataset. The two independent samples cannot be cross-joined: channel values have no dates, so changing a month range never changes channel totals. A filter applies consistently to every applicable saved visualization, including metric, line, area, bar, donut and table tiles.

Consumer interactions are ephemeral and client-side. Active filter chips allow individual removal; **Reset filters** returns both controls to their defaults. Clicking a channel bar or donut slice toggles that category; the native channel selector, clickable donut legend and table category buttons provide keyboard and mobile alternatives. A polite live status announces changes. The feature is equally available to viewers and editors, while editing/saving still obeys existing roles and revision checks. Filters reset when opening a different dashboard or organization, are not stored in the dashboard JSON, and are not part of the share-link contract.

Unsupported future dataset references keep a safe, informative empty state. The existing authenticated tenant API still loads dashboard **definitions only**. No new data endpoint, connector transport, credential access, query execution, or server authorization bypass is introduced. This is not a production query feature.

## Verification

- Vitest validates default, date-only, channel-only, combined and missing-data selection without sample mutation or cross-dataset interference.
- Playwright validates coordinated widget changes, accessible filter removal/reset and category selection, responsive mobile layout, viewer parity, dashboard navigation reset, and existing creator behavior.
- Required CI includes NUnit, real provider compiler-conformance fixtures, TypeScript/Vite build, Playwright browser flows and CodeQL; results are reported in the PR.

## Deferred follow-ons

Absolute dates, timezones, multi-select, advanced filter builders, persisted or URL-shareable filter state, deep drill-down paths, query-backed filters, async query loading/error/retry for production datasets, and a full WCAG 2.2 AA audit. UX-4 addresses design system and broad accessibility hardening. Backend production connector gates remain prerequisites to real customer data.
