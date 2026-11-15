# Security boundaries and unfinished controls

This document distinguishes **implemented** protections from production work still outstanding. The development version is not approved for customer data.

## Protected assets

- Customer identity and membership, access tokens, protected connector credentials.
- Dashboard and data-source registration definitions, and future cached query results.
- Tenant boundaries, audit trails and service availability.

## Threats and controls

| Threat | Current measure | Remaining work |
| --- | --- | --- |
| Cross-tenant access | Server membership checks and organization-scoped dashboard and data-source registration queries | Authorization conformance tests for each future query adapter and cache |
| Unauthorized mutation | Owner/editor role required; viewer read-only | Admin provisioning, invitations and policy management |
| Forged identity | Production requires trusted OIDC authority/audience; no dev identity outside Development | Browser OIDC session flow, lifecycle and rotation |
| Lost updates | Compare-and-swap revisions on dashboard updates and data-source renames/deletes | Client conflict resolution and auditing |
| SQL injection | No execution API; validation accepts typed operators and allowlisted fields, never SQL or DSL; catalog SQL uses parameters | Restricted provider compilers, read-only credentials and adapter security tests |
| SSRF and secret disclosure | Connection profiles owner-only; exact host:port allowlist, public DNS screening, authenticated encryption with externally supplied keys, sanitized responses and audit fields; no active sockets | Connect-time pinned IP and TLS identity enforcement, production secret/KMS, network egress controls, operational rotation |
| Expensive queries | Validation enforces shape, pagination and complexity ceilings; no execution | Runtime timeouts, result-byte limits, concurrency and rate budgets |
| Sensitive errors | API omits raw server exception details for credential operations; no secrets in connection status or successful-mutation audit | Centralized safe audit of denied attempts, log retention and monitoring |

## Production hardening blockers

1. End-to-end customer OIDC/SSO sign-in, provisioning and identity lifecycle.
2. Production key management, connect-time DNS/address validation and network egress controls.
3. Read-only, parameterized and bounded query adapters.
4. Auditing, rate limits, metrics, backups, recovery and operational safeguards.
5. Threat-model review, penetration testing and incident-response runbooks.

## Development identity

`DevelopmentAuthenticationHandler` is a fixed principal selected **only** when environment is Development **and** `DevelopmentIdentity:Enabled=true`. It cannot impersonate another user via request input. Outside Development the API refuses startup without configured trusted identity metadata.

The seeded second organization exists to test isolation and does not constitute production customer provisioning.

## Registration metadata boundary (Issue #4)

Data-source definitions persist only: ID, organization ID, name, provider enum, revision, creator, and created/updated timestamps. Requests have explicit allowlisted fields. Provider values must be one of five known string identifiers; payloads containing fields such as `password`, `connectionString`, `endpoint`, `token`, or `apiKey` are rejected. Neither registration nor the current UI attempts a network connection. Avoid placing secrets, connection strings, URLs or hostnames in display names; the system does not parse arbitrary names to classify sensitive information.

All collection and item operations enforce server-side organization membership. The persisted repository independently scopes every list, read, write and delete by organization ID. Viewers can inspect but cannot modify registrations. Renames and deletions require the last observed revision. Connection configuration now exists as a **separate owner-only resource**, not a field on registration. Registration never grants permission to access customer data.

## Contract-only query boundary (Issue #8)

`POST .../data-sources/{id}/queries/validate` checks authenticated membership and
tenant-scoped registration ownership **before** trusted schema lookup. The deployed
catalog returns no datasets, so customer queries cannot be validated successfully.
Malformed and nested unknown JSON fields, unsupported operators, invalid typed values,
disallowed fields, excess limits and complexity are rejected. Error details never
echo scalar values or reveal names of available datasets. Success would return only
a typed schema and prospective budgets with `executable: false`—never rows or query text.

Validation is **not** protection for a live connection. Read-only credentials, provider
compiler safety, network egress/SSRF defenses, runtime cancellation/quotas and audit
must be separately implemented and security-tested before enabling execution.
See [query contracts](query-contracts.md).

## Connection protection boundary (Issue #10)

Only authenticated tenant owners can read sanitized connection status, configure,
rotate, rewrap or revoke. Registration, renamed records and query validation remain
unchanged; connection routes do not execute network requests or customer queries.
Secrets are encrypted at rest using per-operation random AES-GCM nonces and an
external key with tenant/source/provider context. Missing keys refuse credential
operations; there are no development default keys. Only ciphertext is in SQLite.
Connection metadata includes allowed host and principal information: restrict
catalog backups and database-file access even though secret bytes are encrypted.

An exact operator-managed destination allowlist and public A/AAAA response filter
deny unapproved hosts, IP literals, loopback, RFC1918, metadata-service/link-local,
reserved and mixed DNS answers at submission and credential rotation. This is
**not** sufficient to defeat rebindings or socket redirection. No live connector
will be enabled until a future adapter enforces pinned IPs at every connect,
verifies the certificate against the original hostname, and executes behind
deny-by-default network egress controls. SQLite configuration uses a logical ID
mapped to an existing regular file under an operator root, rejects symlinks and
arbitrary user paths, but safe filesystem handle-opening is not yet available.

Successful configuration/rotation/rewrap/revocation audits include only actor,
tenant, source identifier, action, outcome and time, atomically with the mutation.
They never contain credential, hostname, database or username. Revocation keeps
a secret-free revision tombstone to prevent stale configuration replay. Denials and runtime
security telemetry need a separately hardened gateway/SIEM integration before
production. See [connection security operations](connection-security.md).

Editor deletion of a metadata-only registration remains supported. Deleting a
registration with a protected connection profile, including a revoked tombstone,
requires owner permission to prevent bypass of the credential lifecycle.
