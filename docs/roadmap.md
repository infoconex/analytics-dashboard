# Product delivery roadmap

The first milestone establishes a secure foundation; it is not yet a production-ready alternative to Kibana. Follow-on capabilities are divided into reviewable vertical increments.

| Sequence | Capability | Acceptance focus |
| --- | --- | --- |
| 1 | Foundation — [Issue #1](https://github.com/infoconex/analytics-dashboard/issues/1) | Dashboard CRUD, organization isolation, demo visuals, verification |
| 2a | Data-source registration metadata — [Issue #4](https://github.com/infoconex/analytics-dashboard/issues/4) | Tenant-scoped provider/name records, role enforcement, revision-safe CRUD; no connection configuration |
| 2b | Restricted provider-neutral query contracts — [Issue #8](https://github.com/infoconex/analytics-dashboard/issues/8) | Typed queries, trusted allowlist port, tenant-bound validation, provider capabilities, budgets and result schema; **no execution** |
| 2c | Connection security and credential protection | Tenant-bound secret storage, destination controls and secure connection lifecycle before live adapter activation |
| 3 | SQL Server and PostgreSQL adapters | Real queries, provider compatibility and integration tests |
| 4 | MySQL and SQLite adapters | Real queries, provider compatibility and integration tests |
| 5 | Elasticsearch adapter | Structured search and aggregation mapped to common responses |
| 6 | Enterprise authentication and provisioning | Customer IdPs, invitations, membership and identity lifecycle |
| 7 | Dashboard composition and data interaction | Query-backed visualizations, filters and drill-downs |
| 8 | Enterprise embedding and white labeling | Scoped embedding, host integration, organization branding |
| 9 | Operational hardening and security | Encryption, audit, limits, observability, recovery, threat testing |
| 10 | Deployment and supported release | Container deployment, upgrade strategy, documentation, license |

Each implementation issue owns one PR. Split an increment further when necessary for coherent review. No feature is recorded as delivered until its scenarios have been verified against real implementations.
