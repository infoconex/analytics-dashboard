# Analytics Dashboard

An enterprise-oriented, multi-tenant analytics and visualization application inspired by Kibana, designed to connect to relational databases and Elasticsearch without requiring customers to adopt one storage engine.

> **Pre-alpha: not production-ready.** The application supports **development/demo dashboards using sample data**, tenant-scoped data-source registration, non-executing query validation, protected connection-configuration management, disconnected relational compiler conformance and a hard-disabled runtime session admission boundary. Live connectors, customer-managed sign-in, production provisioning, production KMS/egress controls and embedding are not yet implemented. Do not deploy this increment as a public or customer-facing service.

## Current capabilities

| Capability | Current state |
| --- | --- |
| Responsive dashboard overview and library | Working |
| Metric, line, area, bar, donut, and table visualizations | Working with labeled sample data |
| Create, edit, delete, and share dashboard links | Working in local development |
| Dashboard definitions, optimistic revisions, and persistence | SQLite metadata catalog |
| Register, rename, list and remove data-source definitions | SQLite metadata only, tenant-scoped and revision-protected; no connections |
| Restricted provider-neutral query contracts | Typed request/result schemas, tenant-scoped validation, trusted allowlists and prospective resource budgets; no execution |
| Connection security and credential protection | Owner-only configuration, authenticated-encryption envelope, rotation/revocation, host allowlists, SQLite file IDs and redacted audit; **no connections opened** |
| SQL Server and PostgreSQL compilation (roadmap 3a) | Trusted schema binding, typed parameterized SELECTs, native commands and real read-only provider conformance tests; **no production connections** |
| Runtime relational admission (roadmap 3b-1) | Internal authorization, fresh destination validation and secret-access ordering; deployed transport unconditionally refuses provider sockets |
| Tenant isolation and owner/editor/viewer authorization | Server-enforced and tested |
| OIDC/JWT bearer validation in the API | Configurable; production API fails closed without identity configuration |
| SQL Server, MySQL, PostgreSQL, SQLite, Elasticsearch | Provider identifiers available for metadata registration; SQL Server/PostgreSQL have disconnected compilers; no live connectivity |
| Customer identity federation and provisioning | Planned |
| Embed/white-label SDK and enterprise audit controls | Planned |

Shared links retain the organization identifier. Recipients must authenticate and belong to that organization; there are no anonymous public dashboards.

Data-source registration stores only a display name, provider identifier, tenant ownership, revision, creator and timestamps. It **still does not accept connection strings, endpoints, passwords, tokens or API keys**. Separate owner-only connection endpoints can store protected credentials when an external key and destination policy have been configured. Do not put connection details or secrets in a display name. Existing demo charts are not linked to registrations.

Query validation is deliberately non-executing. The `/api/organizations/{organizationId}/data-sources/{id}/queries/validate` POST route checks identity, registration ownership, typed query structure, limits and a trusted server allowlist. **The deployed catalog contains no datasets**, so requests presently fail closed. This is neither a connection test nor a data query API. See [query contracts](docs/query-contracts.md) for request/response shapes and operator, type and budget rules.

### Data-source registration API

All routes require an authenticated member of the specified organization. A viewer can list and retrieve; owners and editors can create, rename and delete.

| Method | Route | Input |
| --- | --- | --- |
| GET | `/api/organizations/{organizationId}/data-sources` | None |
| GET | `/api/organizations/{organizationId}/data-sources/{id}` | None |
| POST | `/api/organizations/{organizationId}/data-sources` | `{ "name": "Reporting", "provider": "postgreSql" }` |
| PUT | `/api/organizations/{organizationId}/data-sources/{id}` | `{ "name": "Reporting v2", "expectedRevision": 1 }` |
| DELETE | `/api/organizations/{organizationId}/data-sources/{id}?expectedRevision=2` | None |

Allowed provider strings: `sqlServer`, `mySql`, `postgreSql`, `sqlite`, `elasticsearch`. Provider and organization ownership cannot be changed after registration; renaming increments the revision. Both rename and removal reject stale expected revisions with HTTP 409. Unknown request fields, including connection details, are rejected with HTTP 400. The response contains only registration metadata. Rebooting the API preserves definitions in the SQLite catalog.

### Connection configuration API (owner only; no live connections)

Under the same data-source resource ID, owners may `GET /connection`,
`PUT /connection`, `POST /connection/rotate`, `POST /connection/rewrap`, or
`DELETE /connection?expectedRevision=N`. Create uses `expectedRevision: 0`;
all other mutations require the current connection revision. Revocation clears
the active configuration and encrypted secret but retains a revision tombstone,
preventing replay of stale create requests. Each response
contains only the provider, configuration kind, `hasCredential`, revision and
timestamp. Nothing reveals a secret or encrypted envelope. Editors/viewers
cannot access these routes. Registration CRUD and query-validation contracts
are unchanged.

Network configuration requires a strict provider-specific shape and an explicit
operator-defined hostname/port allowlist; secrets require a separately supplied
32-byte encryption key. A SQLite configuration uses an operator-mapped logical
file ID, never a client-provided path. Missing keys, host allowances or file
mappings deny configuration. There are no built-in sample secrets or targets.
See [connection security and operations](docs/connection-security.md) for exact
contracts, key provisioning, rotation, encryption, DNS/SSRF limitations, TLS
gates and required production controls.

The internal runtime admission port is documented separately in
[runtime connection admission](docs/runtime-connection-admission.md). It cannot
open a customer session with the deployed adapter and exposes no query route.

## Technology

- **Backend:** ASP.NET Core on .NET 10 LTS, using Domain → Application → Infrastructure/HTTP adapters.
- **Frontend:** TypeScript, React, Vite, Recharts, and accessible browser controls.
- **Metadata catalog:** SQLite. This is separate from customer analytics data sources.
- **Tests:** NUnit integration and application tests, disposable real SQL Server/PostgreSQL conformance; Vitest; Playwright browser scenarios.
- **Automation:** one PowerShell verification script invoked locally and by GitHub Actions, plus CodeQL and grouped Dependabot updates.

## Run locally

Requires the .NET 10 SDK, Node.js 24, and npm.

Terminal 1, from the repository root:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project src/AnalyticsDashboard.Api --urls http://localhost:5055
```

Terminal 2:

```powershell
Set-Location web
npm ci
npm run dev
```

Open <http://localhost:5173>. The development identity is a fixed demo owner of *Northstar Commerce*. Its sample dashboard and data are intentionally fictional; no real database credentials are used.

### Verification

```powershell
./scripts/verify.ps1
```

For browser integration tests, install Chromium using Playwright, then run:

```powershell
./scripts/verify.ps1 -IncludeBrowserTests
```

Playwright browser startup needs a host that permits Chromium subprocess and socket creation. GitHub Actions runs the browser suite. Local environment restrictions may prevent Chromium from launching even when both applications build and all unit/integration tests pass.

To run the real SQL Server/PostgreSQL conformance suite locally on Linux with Docker and PowerShell, source `scripts/start-provider-fixtures.sh` in your shell, then run `pwsh ./scripts/verify-provider-adapters.ps1`. Remove the disposable `analytics-sqlserver-fixture` and `analytics-postgres-fixture` containers afterward. CI always runs these provider tests separately with runtime-generated fixture passwords; missing databases fail rather than silently skipping. See [provider test and security operations](docs/relational-adapters.md).

## Production configuration (not a deployment guide)

The API has no production demo-user bypass. To start outside Development, configure a trusted OIDC issuer (`Authentication:Authority`) and expected access-token audience (`Authentication:Audience`). Authorized identities additionally require membership provisioning in the metadata catalog, which is not yet exposed as a production administration workflow.

Production readiness requires additional work: federation/login experience, organization provisioning, production KMS, socket-level DNS rebinding/SSRF defenses and network egress, read-only connector execution, audited query limits, hardening, operations, and deployment. See [architecture](docs/architecture.md), [security boundaries](docs/security.md), and the [roadmap](docs/roadmap.md).

## Engineering workflow

- GitHub issue ↔ implementation PR (one to one).
- Work on a dedicated branch; keep checkpoints small and commits reviewable.
- Follow Microsoft guidance by reference. Record only explicit deviations or decisions Microsoft leaves open.
- Favor TDD, SOLID, inward dependencies, one primary C# type per file, and reproducible checks.
- Use squash merges after verified engineering/security review and required checks; the repository owner has granted standing authorization to merge completed issues without additional approval.

## Licensing

No product distribution license has been selected. The public repository does not by itself grant rights to redistribute or embed the software. A commercial/OSS licensing decision is required before third-party distribution.
