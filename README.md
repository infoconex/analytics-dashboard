# Analytics Dashboard

An enterprise-oriented, multi-tenant analytics and visualization application inspired by Kibana, designed to connect to relational databases and Elasticsearch without requiring customers to adopt one storage engine.

> **Pre-alpha: not production-ready.** The application supports **development/demo dashboards using sample data** and tenant-scoped data-source *registration metadata*. Live connectors, customer-managed sign-in, production provisioning, secure credential storage, and embedding are not yet implemented. Do not deploy this increment as a public or customer-facing service.

## Current capabilities

| Capability | Current state |
| --- | --- |
| Responsive dashboard overview and library | Working |
| Metric, line, area, bar, donut, and table visualizations | Working with labeled sample data |
| Create, edit, delete, and share dashboard links | Working in local development |
| Dashboard definitions, optimistic revisions, and persistence | SQLite metadata catalog |
| Register, rename, list and remove data-source definitions | SQLite metadata only, tenant-scoped and revision-protected; no connections |
| Tenant isolation and owner/editor/viewer authorization | Server-enforced and tested |
| OIDC/JWT bearer validation in the API | Configurable; production API fails closed without identity configuration |
| SQL Server, MySQL, PostgreSQL, SQLite, Elasticsearch | Provider identifiers available for metadata registration; no live connectivity |
| Customer identity federation and provisioning | Planned |
| Embed/white-label SDK and enterprise audit controls | Planned |

Shared links retain the organization identifier. Recipients must authenticate and belong to that organization; there are no anonymous public dashboards.

Data-source registration stores only a display name, provider identifier, tenant ownership, revision, creator and timestamps. It **does not accept or store connection strings, endpoints, passwords, tokens or API keys**. Do not put connection details or secrets in a display name. Existing demo charts are not linked to registrations.

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

## Technology

- **Backend:** ASP.NET Core on .NET 10 LTS, using Domain → Application → Infrastructure/HTTP adapters.
- **Frontend:** TypeScript, React, Vite, Recharts, and accessible browser controls.
- **Metadata catalog:** SQLite. This is separate from customer analytics data sources.
- **Tests:** NUnit integration and application tests; Vitest; Playwright browser scenarios.
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

## Production configuration (not a deployment guide)

The API has no production demo-user bypass. To start outside Development, configure a trusted OIDC issuer (`Authentication:Authority`) and expected access-token audience (`Authentication:Audience`). Authorized identities additionally require membership provisioning in the metadata catalog, which is not yet exposed as a production administration workflow.

Production readiness requires additional work: federation/login experience, organization provisioning, application/data-source authorization, encrypted secret handling, audited query execution, limits, hardening, operations, and deployment. See [architecture](docs/architecture.md), [security boundaries](docs/security.md), and the [roadmap](docs/roadmap.md).

## Engineering workflow

- GitHub issue ↔ implementation PR (one to one).
- Work on a dedicated branch; keep checkpoints small and commits reviewable.
- Follow Microsoft guidance by reference. Record only explicit deviations or decisions Microsoft leaves open.
- Favor TDD, SOLID, inward dependencies, one primary C# type per file, and reproducible checks.
- Use squash merges after verified engineering/security review and required checks; the repository owner has granted standing authorization to merge completed issues without additional approval.

## Licensing

No product distribution license has been selected. The public repository does not by itself grant rights to redistribute or embed the software. A commercial/OSS licensing decision is required before third-party distribution.
