# Roadmap 3b-1 — runtime connection admission (Issue #14)

**Status: internal admission boundary only; runtime transport permanently disabled.**
There is still no query-execution API, trusted production dataset, customer socket,
provider session, or production connection string. This work is intentionally a
first, bounded part of roadmap 3b rather than a claim that 3b is complete.

## Trust boundaries and acquisition sequence

`RuntimeConnectionService` is an internal application use case. There is no
route or UI for it. The API registers `UnavailableRuntimeRelationalTransport`,
which always refuses readiness and opens. No feature switch or configuration
value can change this adapter into a live SQL Server or PostgreSQL connector.

For a future independently verified transport implementation, one acquisition
attempt follows this order:

1. Honor cancellation and authorize membership against server-managed identity.
   An unauthorized organization cannot cause source, profile, DNS, secret or
   transport lookups. Membership allows query admission for the current roles;
   fine-grained dataset/role permissions are a separate 3c requirement.
2. Retrieve registration **within** the authorized organization. Only SQL
   Server and PostgreSQL are in scope. Retrieve the associated organization-
   and source-scoped profile. Deny missing, revoked, cross-context, mismatched,
   incomplete or other-provider profiles.
3. Ask the privileged transport to prove its deployment prerequisites are
   active. Any unavailable or failed check must stop before DNS/key access.
   Production always fails at this stage.
4. Revalidate the **exact operator allowlist** and freshly resolve the
   hostname on every attempt. Reject empty, mixed, private, special-purpose
   and unapproved address sets. This result is **not** a standalone connect
   token: only the privileged transport may establish the ensuing socket,
   and it must exclusively use the vetted IP set for this attempt.
5. Recheck tenant membership, registration and profile revision, then decrypt its authenticated secret using
   tenant/source/provider context. The plaintext is passed only to the
   privileged transport and never returned by the application use case.
6. The future transport must return an already-open, provider-authenticated
   `DbConnection`. Deny closed sessions. Recheck membership, source and profile after open;
   dispose the session if they were removed, revoked or replaced, or the token
   was cancelled. This checks the obvious open-time race, but **cannot** prevent
   revocation immediately after return; query execution will require its own
   authorization/lease and cancellation policy in 3c.

Transport-readiness, provider-state and cleanup exceptions are translated to a generic
security-unavailable error without inner exception details or credentials.
Cancellation propagates when the caller cancels. The *transport itself* must
guarantee cleanup of partially opened sockets and sessions on every failed or
cancelled attempt. Managed strings cannot be reliably zeroed; credentials
must be kept out of diagnostic contexts and any future connection pool.

The older server-side `IConnectionCredentialReader` port now also requires a
server-authenticated actor, verifies tenant membership and source/provider
ownership before decryption, and rechecks membership before returning the
secret. It is **not** a network authorization or execution port and remains
unreachable from HTTP.

## Provider API decision record (2026-11-15)

The supported provider interfaces were checked before designing the transport
port. They do **not** establish the socket+hostname property by themselves:

| Concern | Microsoft.Data.SqlClient | Npgsql |
| --- | --- | --- |
| Certificate checks | `Encrypt=Strict`, no certificate bypass; chain/name rules and `HostNameInCertificate` documented | `SSL Mode=VerifyFull`, `Trust Server Certificate=false`; original hostname required |
| DNS / socket pinning | Driver manages TCP destination and its DNS behavior; `HostNameInCertificate` is a certificate matching option, **not** proof that connection to an IP retains correct SNI | `Host` accepts DNS or IP; documented builder TLS callback customizes authentication, **not** transport socket selection or an independent DNS-free connect |
| Failover and pooling | Transparent multi-IP resolution, retry, failover and pooling behavior need explicit restriction and conformance | Multiple hosts, host recheck, reconnect and pool reuse must be disabled or verified within the security boundary |
| Transport readiness | No production connector or egress route exists | No production connector or egress route exists |

The future implementation may use a separately confined, authenticated L4
network broker/egress gateway to select and pin IPs while retaining the
approved DNS hostname for the actual end-to-end TLS handshake, or a verified
provider-specific socket path if one is supported. It must **demonstrate**
original-hostname SNI, full certificate chain/name validation, no secondary
unvetted resolution, no proxy bypass, no unapproved redirects/failover and no
cross-tenant pooled-session reuse. A broker that terminates or substitutes TLS
without end-to-end provider identity is not acceptable by default.

Use a deny-by-default external egress policy (host/container/cluster firewall,
segmented network, forced broker, or equivalent) independent of the application.
Allow customer database traffic only through independently verified approved
routes; block private/internal/link-local/metadata/host and unapproved DNS
routes. Application-side allowlists and fresh DNS are defense in depth, never
the sole enforcement mechanism. Public-only DNS admission is current policy;
private customer databases need a separately designed private-connectivity
trust boundary, not a relaxed IP filter.

Authoritative references consulted:

- [Microsoft.Data.SqlClient connection options](https://learn.microsoft.com/en-us/sql/connect/ado-net/connection-options)
- [SqlClient connection-string syntax and encryption](https://learn.microsoft.com/en-us/sql/connect/ado-net/connection-string-syntax)
- [Npgsql connection-string parameters](https://www.npgsql.org/doc/connection-string-parameters.html)
- [Npgsql TLS security](https://www.npgsql.org/doc/security.html)
- [Npgsql failover and load balancing](https://www.npgsql.org/doc/failover-and-load-balancing.html)
- [Npgsql data-source builder APIs](https://www.npgsql.org/doc/api/Npgsql.NpgsqlDataSourceBuilder.html)

## Test evidence, scope and remaining work

The new admission tests use real SQLite catalog persistence, encrypted credential
envelopes and a **test-only** in-memory fake provider session. They exercise
cross-tenant/unknown callers, missing and revoked profiles, malformed stored
principals, readiness fail-closed ordering, per-attempt DNS changes, blocked
destinations and mixed DNS answers, in-flight membership revocation,
missing historical keys, cancellation, provider errors and revocation races.
The existing mandatory SQL Server/PostgreSQL integration suite still tests
restricted *compiler* plans, native parameters and read-only fixture accounts.
Its test-only TLS shortcuts must remain isolated in the fixture class and
must never be copied into production.

Neither fake tests nor the existing provider-conformance suite demonstrate
runtime IP pinning, TLS identity or network egress. These remain **blocking**:

1. Verified driver/broker runtime socket and TLS/SNI design for **both**
   SQL Server and PostgreSQL, with genuine provider and adversarial DNS/TLS
   integration tests; disable or prove safe retries, proxies, failover and pools.
2. Independently operated deny-by-default egress, route attestation, DNS
   controls and monitoring; documented failure and rollback drills.
3. Production KMS/HSM-backed envelope/secret integration, restricted workload
   identity, rotation, recovery, escrow and audit; the current environment-
   supplied AES-GCM key adapter is a configuration-time prototype.
4. Runtime connection/concurrency/time/byte/row limits, cancellation of actual
   commands, read-only provider identity provisioning, privilege tests, denial
   and anomaly event export, rate limits and incident playbooks.
5. Trusted tenant dataset provisioning, query permission and session lease
   authorization, result budgeting and streamed safe materialization in 3c.

**Operational rule:** Keep the disabled transport registered in all production
environments until the independent production gates have evidence. No
configuration-only enable switch should be added. Do not onboard live customer
credentials or unblock a query endpoint based on this increment.
