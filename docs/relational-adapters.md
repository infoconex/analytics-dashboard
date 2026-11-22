# Roadmap 3a — SQL Server/PostgreSQL restricted compilation and provider conformance

**Status: pre-alpha, disconnected from the API.** Issue #12 does not enable customer
queries. The existing `UnconfiguredQueryDatasetCatalog` remains empty, every API
`/queries/validate` response is non-executable, and there is no execution route.

## Architecture and security properties

1. `QueryService` performs server-identity membership and tenant-owned source
   checks *before* retrieving trusted dataset metadata. It then calls the shared
   pure `QueryShapeValidator`. These checks preserve the existing API behavior.
2. An infrastructure-only `RelationalDatasetBinding` identifies trusted dataset
   metadata, physical schema/table names and an operator-declared unique stable
   ordering field. HTTP callers cannot submit physical names or a binding.
3. `SqlServerQueryCompiler` and `PostgreSqlQueryCompiler` independently call
   `QueryShapeValidator` and validate the physical binding before constructing a
   SELECT. Identifier names must be ASCII identifier tokens and are quoted in the
   provider dialect. Only strongly enumerated operators and aggregates contribute
   SQL syntax; values become separately bound, typed `@pN` parameters. No free
   SQL, connection strings, comments, wildcards, schema inspection or DDL are
   accepted from the query request.
4. For raw rows, ORDER BY includes the trusted unique key as a tie breaker. For
   groups it includes all group keys; a single ungrouped aggregate needs no
   ordering and rejects nonzero offsets. The binding's unique-key property is an
   **operator obligation**, not presently checked against database constraints.
5. Native `SqlServerCommandFactory` / `PostgreSqlCommandFactory` require plans
   created by the compilers and do not accept arbitrary SQL strings. They bind
   parameter types using Microsoft.Data.SqlClient and Npgsql respectively and
   set the prospective 10-second command timeout. They do not open sockets,
   manage credentials or perform execution.

This compiler boundary has **no** active application execution port. A future
issue must introduce an authorized, tenant-scoped application execution use case
and an infrastructure connection-opening port once its security prerequisites
are implemented. A successfully compiled SELECT is *not* an execution permit.

### Supported shapes and semantics

| Query feature | SQL Server | PostgreSQL |
| --- | --- | --- |
| Identifiers | Vetted `[schema].[table]` and `[column]` | Vetted `"schema"."table"` and `"column"` |
| Scalar values | Native parameters (nvarchar, decimal, bit, datetimeoffset) | Native parameters (text, numeric, boolean, timestamptz) |
| Comparisons / IN / NULL | Typed parameters; flat AND predicates | Same |
| Contains / starts-with | `CHARINDEX` with literal parameter | `strpos` with literal parameter |
| Grouping/aggregates | GROUP BY, COUNT/SUM/AVG/MIN/MAX | Same |
| Pagination | ORDER BY plus OFFSET/FETCH | ORDER BY plus LIMIT/OFFSET |

Wildcard characters `%`, `_`, `[` and `]` are treated as **literal text**
in substring/prefix operations, not `LIKE` patterns. Database collation and
case sensitivity remain provider/database dependent; future product policy may
need explicit portable collation semantics. Timestamp parameters normalize to
UTC before native binding. Decimal precision/scale and aggregate return types
must be included in any eventual materializer conformance suite.

## Real-provider verification

CI runs the normal verification workflow and a **required separate provider
conformance job**. The provider job uses Docker images
`mcr.microsoft.com/mssql/server:2022-latest` and `postgres:17`, starts both
containers bound to host loopback, generates fresh admin and read-only passwords
at runtime and masks them in GitHub Actions. Test setup waits for DBMS readiness,
creates isolated `analytics_fixture` databases and the dedicated
`analytics_reader` principals, seeds a fixed table and grants SELECT but no
write permissions. Integration tests issue genuine native provider commands and
verify literal matching, injection payloads, deterministic pagination,
aggregations, timestamp conversion and that DELETE is denied by the DBMS.

On Linux with Docker, OpenSSL, .NET 10, and PowerShell:

```bash
source ./scripts/start-provider-fixtures.sh
pwsh ./scripts/verify-provider-adapters.ps1
docker rm -f analytics-sqlserver-fixture analytics-postgres-fixture
```

The normal `./scripts/verify.ps1` deliberately excludes the
`ProviderIntegration` test category, so it remains usable without containers.
The provider-specific verification script demands all four fixture credential
environment variables and runs **only** that category; missing configuration
or unavailable DBMS instances fail the CI job. Run both verification paths to
reproduce complete CI locally. Containers are disposable and their data must
not be treated as persistent. Host ports 1433 and 5432 must be free.

**Test-only transport exception:** SQL Server's localhost container uses a
self-signed certificate accepted by the fixture client, and the PostgreSQL
localhost container has TLS disabled. These settings are confined to the
test class and must never be copied to a production connector. Real customer
sessions must verify the full certificate chain and original DNS hostname.

## Explicit blockers before live customer connections

- A trusted tenant/source-scoped dataset binding registry, with physical
  identifier authorization and a verified unique pagination key.
- Connect-time hostname/port approval, fresh DNS validation, approved-IP socket
  pinning and rebinding protection for **each driver**. Never let a provider
  silently resolve an untrusted address after approval. Account for proxies,
  failovers, pooling, redirects, dual-stack and driver limitations.
- Verified TLS chain/hostname checks against the originally approved hostname
  (with proper SNI) even when connecting to a pinned IP; no certificate bypass.
- External deny-by-default network egress with explicit approved destinations;
  application-side DNS checks alone are not an egress boundary.
- Production KMS/HSM-backed key and secret lifecycle, rotation, recovery and
  restricted secret access; tenant-scoped authorization before decrypting.
- Least-privilege, dedicated read-only provider identities, database-level
  permission verification and isolation from administration credentials.
- Runtime cancellation/timeout enforcement beyond a command timeout; bounded
  connections, concurrency, memory, result bytes/rows, parameter count,
  streaming and safe backpressure; verified adversarial exhaustion scenarios.
- Auditable success/denial/security events, redacted exceptions, retention and
  operational monitoring, plus production federation/provisioning gates.

None of these is implied by the passing fixture tests. Do not enable a query
endpoint or add provider connection strings to the deployed API until these
prerequisites are fully implemented and reviewed.
