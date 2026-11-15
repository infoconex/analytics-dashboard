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
