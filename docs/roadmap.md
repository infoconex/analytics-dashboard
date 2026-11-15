# Product delivery roadmap

The first milestone establishes a secure foundation; it is not yet a production-ready alternative to Kibana. Follow-on capabilities are divided into reviewable vertical increments.

| Sequence | Capability | Acceptance focus |
| --- | --- | --- |
| 1 | Foundation — [Issue #1](https://github.com/infoconex/analytics-dashboard/issues/1) | Dashboard CRUD, organization isolation, demo visuals, verification |
| 2a | Data-source registration metadata — [Issue #4](https://github.com/infoconex/analytics-dashboard/issues/4) | Tenant-scoped provider/name records, role enforcement, revision-safe CRUD; no connection configuration |
| 2b | Restricted provider-neutral query contracts — [Issue #8](https://github.com/infoconex/analytics-dashboard/issues/8) | Typed queries, trusted allowlist port, tenant-bound validation, provider capabilities, budgets and result schema; **no execution** |
| 2c | Connection security and credential protection — [Issue #10](https://github.com/infoconex/analytics-dashboard/issues/10) | Owner-authorized profiles, protected credentials, exact destination policy, SQLite mappings and redacted auditing; **no live connections** |
| 3a | Restricted SQL Server and PostgreSQL compilation — [Issue #12](https://github.com/infoconex/analytics-dashboard/issues/12) | Trusted physical bindings, native typed parameters and mandatory real-provider/read-only conformance; **no customer execution** |
| 3b-1 | Authorization-first runtime session admission — [Issue #14](https://github.com/infoconex/analytics-dashboard/issues/14) | Membership/source/profile checks, fresh DNS at attempt time, ordering before secret retrieval, revocation-race refusal; **deployed transport disabled** |
| 3b-2+ | Secure runtime connection/session transport — planned | Verifiable vetted-IP socket binding and original-hostname TLS/SNI, independent deny-by-default egress, production KMS/secret lifecycle, provider-boundary adversarial tests and bounded sessions; **required before live queries** |
| 3c | Tenant-bound live SQL Server/PostgreSQL query execution — planned | Trusted tenant datasets, restricted query plans, runtime quotas/cancellation, result budgets, audit and adversarial provider tests |
| 4 | MySQL and SQLite adapters | Real queries, provider compatibility and integration tests |
| 5 | Elasticsearch adapter | Structured search and aggregation mapped to common responses |
| 6 | Enterprise authentication and provisioning | Customer IdPs, invitations, membership and identity lifecycle |
| 7 | Dashboard composition and data interaction | Query-backed visualizations, filters and drill-downs |
| 8 | Enterprise embedding and white labeling | Scoped embedding, host integration, organization branding |
| 9 | Operational hardening and security | Encryption, audit, limits, observability, recovery, threat testing |
| 10 | Deployment and supported release | Container deployment, upgrade strategy, documentation, license |

Each implementation issue owns one PR. Split an increment further when necessary for coherent review. No feature is recorded as delivered until its scenarios have been verified against real implementations.

## UI/UX product experience workstream — current priority

**Principle:** simple by default, powerful when needed. The product is designed around dashboard consumers, creators, organization administrators, and embedding developers; avoid copying Kibana's complexity. Current React/Vite/Recharts shell, sample dashboards, role-aware CRUD and five Playwright scenarios are foundations, **not** evidence of validated usability. The present custom CSS lacks a mature token system, accessible dialogs, and theme variants.

| Increment | Experience | Outcome |
| --- | --- | --- |
| UX-1 — [Issue #16](https://github.com/infoconex/analytics-dashboard/issues/16) | Guided sample-data Explore → visualize → create dashboard | First meaningful creator journey with sample-only boundary and keyboard-friendly controls |
| UX-2 | Dashboard composition | Accessible layout, rearrangement, edit/undo and consistent empty/loading/error states |
| UX-3 | Consumer interaction | Cross-widget filters, date controls, drill-down and useful sharing states |
| UX-4 | Design system and accessibility | Tokens, light/dark, component states, focus/dialog semantics and WCAG 2.2 AA audits |
| UX-5 | Embedded customer experience | Scoped embedding, branding, host integration, security and developer onboarding |
| UX-6 | Organization experience | Permission clarity, data-source status and administration without overwhelming consumers |

Usability research targets (not yet measured): first visualization under 3 minutes; first useful dashboard under 10 minutes; filter adjustment under 15 seconds; share under 30 seconds. Recruit representative users, record task success/time/error rates and refine. SQL knowledge must not be required for standard workflows. Production connections and arbitrary query execution remain disabled until their independent security gates are verified. Sample datasets are not registered customer datasets.
