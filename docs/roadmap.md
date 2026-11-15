# Product delivery roadmap

The first milestone establishes a secure foundation; it is not yet a production-ready alternative to Kibana. Follow-on capabilities are divided into reviewable vertical increments.

| Sequence | Capability | Acceptance focus |
| --- | --- | --- |
| 1 | Foundation — [Issue #1](https://github.com/infoconex/analytics-dashboard/issues/1) | Dashboard CRUD, organization isolation, demo visuals, verification |
| 2 | Data-source connection model and restricted query contract | Connection metadata, authorization, query planning and limits |
| 3 | SQL Server and PostgreSQL adapters | Real queries, provider compatibility and integration tests |
| 4 | MySQL and SQLite adapters | Real queries, provider compatibility and integration tests |
| 5 | Elasticsearch adapter | Structured search and aggregation mapped to common responses |
| 6 | Enterprise authentication and provisioning | Customer IdPs, invitations, membership and identity lifecycle |
| 7 | Dashboard composition and data interaction | Query-backed visualizations, filters and drill-downs |
| 8 | Enterprise embedding and white labeling | Scoped embedding, host integration, organization branding |
| 9 | Operational hardening and security | Encryption, audit, limits, observability, recovery, threat testing |
| 10 | Deployment and supported release | Container deployment, upgrade strategy, documentation, license |

Each implementation issue owns one PR. Split an increment further when necessary for coherent review. No feature is recorded as delivered until its scenarios have been verified against real implementations.
