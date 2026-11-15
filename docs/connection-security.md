# Connection security and credential protection — capability 2c

This increment is **configuration-only and pre-alpha**. It makes no customer
database connections, executes no SQL or Elasticsearch request, and does not
read a customer SQLite database. The deployed `UnconfiguredQueryDatasetCatalog`
continues to deny all datasets. Do not enter real customer credentials into a
publicly accessible or development/demo installation.

## Authority and lifecycle

`/api/organizations/{organizationId}/data-sources/{id}/connection` is a separate
resource attached to an existing tenant-scoped data-source registration. API
identity comes only from validated server authentication, not request-supplied
actor information. An authenticated organization **owner** is required for each
connection operation; editor/member access is deliberately denied. A missing
source returns 404 only after membership authorization. The registration and
query-validation endpoints retain their existing contracts and permissions.

| Method | Suffix | Request | Result |
| --- | --- | --- | --- |
| GET | `/connection` | None | Sanitized profile status, or 404 |
| PUT | `/connection` | Provider-matching configuration + required `expectedRevision` | Create (`0`) or replace (existing revision) |
| POST | `/connection/rotate` | `credential`, `expectedRevision` | Encrypt a new credential, revision + 1 |
| POST | `/connection/rewrap` | `expectedRevision` | Re-encrypt with the active key, revision + 1 |
| DELETE | `/connection?expectedRevision=N` | Positive expected revision | Remove the profile and encrypted credential |

Example relational PUT (illustrative *nonexistent* destination; never use a real
credential in examples, source control or a shared shell history):

```json
{
  "network": { "host": "db.example.com", "port": 5432, "database": "analytics", "username": "read_only" },
  "sqlite": null,
  "credential": "<supply-through-a-private-client>",
  "expectedRevision": 0
}
```

Example SQLite PUT: `{ "sqlite": { "fileId": "tenant-report" }, "network": null, "credential": null, "expectedRevision": 0 }`.

Network providers require `credential`, `network.host`, `network.port` and,
except for Elasticsearch, `network.database` and `network.username`.
Elasticsearch accepts only `host`, `port` and a token credential; no database
or username. SQL Server, PostgreSQL and MySQL require relational identifiers.
Every field not explicitly listed is rejected, including raw connection strings,
raw URLs, server-side path names, `trustServerCertificate`, certificate bypass,
and unencrypted-transport flags. Request bodies have size ceilings and a
credential length cap. Strings used for credentials must not contain control
characters. There is no server-side live connection-test endpoint.

GET and mutation responses only include `provider`, `hasCredential`, `revision`,
`configuredAt`, and `kind`. **Neither plaintext nor ciphertext, network host,
username, database, physical path, or logical file ID is echoed.** Secret
retrieval is available only to trusted server-side application adapters through
`IConnectionCredentialReader` and is never exposed in HTTP. Future adapters
will need an additional, explicit query-permission gate before invoking it.

## Cryptographic architecture and configuration

`IConnectionSecretProtector` is an application port, implemented in this slice by
`AesGcmConnectionSecretProtector`. Each mutation uses a cryptographically random
96-bit nonce, AES-256-GCM with 128-bit tag, and authenticated associated data
binding the organization ID, source UUID, provider and format version. The
SQLite catalog stores only key ID, nonce, ciphertext and tag for the secret.
Tampered or cross-context envelopes cannot be decrypted. Intermediate byte
buffers are cleared where practical; .NET managed strings and application
memory are not guaranteed to be scrubbed, so secret access must remain brief.

There are **no default, committed, generated-at-startup, or fallback keys**.
Credential operations fail with HTTP 503 when the selected key is missing,
malformed, or unavailable. Runtime configuration requires:

| Configuration name | Requirement |
| --- | --- |
| `ConnectionSecurity:ActiveKeyId` | Stable logical identifier of the active encryption key |
| `ConnectionSecurity:Keys:{keyId}` | Base64 of **32 random key bytes**, securely supplied by an external secret provider or process environment |

In ASP.NET Core environment variable notation the separators become `__`:
`ConnectionSecurity__ActiveKeyId` and
`ConnectionSecurity__Keys__{keyId}`. Populate the values outside the repo,
using a secrets manager or host-mounted secret. Restrict process environment,
memory dumps, application configuration dumps and key access. Do **not** put key
bytes in `appsettings*.json` or in any example committed to Git.

Key rollover procedure:

1. Back up encrypted metadata and associated key versions under separate access
   controls, retaining historical key IDs while ciphertext refers to them.
2. Supply a new key with a new ID, keep the previous key readable, and switch
   `ActiveKeyId` to the new ID. New writes use the new key.
3. Rewrap existing profiles through the owner-only revisioned endpoint. Check
   every old key has zero remaining references in storage and recoverable
   backups **before** retiring it.
4. Remove obsolete keys from the runtime only after retention policy permits.

Revoke deletes the active encrypted profile, but **does not invalidate an
already issued database password or API token at the provider**. Operators must
also revoke the upstream credential and account for WAL, replicas and backups.
Key loss makes stored ciphertext unrecoverable; restore must include the
matching key versions. Integrate a production KMS/HSM-backed envelope provider
with rotation, access auditing and HA before real customers are onboarded.

## Network controls and anti-SSRF boundary

`ConnectionSecurity:AllowedDestinations:{Provider}` contains an array of
exact lowercase ASCII `fqdn:port` entries, per enum provider (`SqlServer`,
`MySql`, `PostgreSql`, `Elasticsearch`). No entry means **deny all**. There is
no wildcard, suffix, URL, CIDR, IP literal, localhost alias or arbitrary port
support. Network hosts must be unambiguous canonical DNS hostnames, and each
allowed host is looked up for A/AAAA responses *after* the allowlist check.
Empty, overly large, mixed public/private or special-purpose results fail.
DNS resolution failure also fails closed. Credential rotation rechecks the
destination, but persisted validation is **not** a durable connect permit.

Crucially, these checks do not protect a future adapter that resolves the name
again at socket connect, uses a proxy, follows a redirect, or trusts an
unvalidated certificate. Before live adapters can ship:

- Re-run allowlist and DNS checks **at each connection**, and bind the socket to
  the vetted IP address(es) without a second untrusted DNS lookup; enforce
  address restrictions through connection establishment and proxy/redirect
  behavior. Fail on DNS rebinding or any endpoint address change to blocked
  space; do not accept previously persisted addresses as authority.
- Preserve the original approved hostname for TLS SNI and chain/hostname
  validation. SQL providers require encrypted certificate-verified connections;
  Elasticsearch requires HTTPS and verified certificates. No bypass flags.
- Enforce outbound network policy at host/container/firewall level, denying
  metadata services, private/internal destinations, host network, and DNS
  proxy bypass except explicitly approved routes. Application validation alone
  is not an egress boundary. Apply timeouts, retries, socket accounting and
  connection budgets. Production DNS policy also needs explicit vetted handling
  of delegated aliases, DNSSEC where applicable, and load balancer/IP changes.

No outbound customer connection, TLS handshake, HTTP redirect or SQL session
occurs in this increment. The only potential network operation on configuration
is DNS lookup of an already approved hostname.

## SQLite path containment

`ConnectionSecurity:SqliteRoot` is an **absolute** operator-managed directory.
`ConnectionSecurity:SqliteFiles:{logicalId}` maps an allowlisted logical ID to
an **absolute** existing file under that directory. The client can supply only
the logical ID (ASCII alphanumeric, dash or underscore); it cannot supply a
path, filename, file URL or glob. The policy rejects roots or mapped files
outside the configured boundary, absent paths, directories, symlinks/reparse
points and the metadata catalog file. No default root or file mappings exist.

This validation happens at configuration time and never opens the database.
Future SQLite adapters must open a safe, read-only file handle without following
symlinks (`openat2`/equivalent platform policy where available), validate the
final handle identity and filesystem mount permissions, and address TOCTOU,
hardlinks, WAL/shm paths, locking and multi-tenant filesystem isolation before
calling the database provider. Customer files must not share the metadata
catalog. OS access rights and confined mounts are authoritative safeguards.

## Security events, retention and operations

Successful changes and their audit records commit atomically in SQLite.
`connection_security_events` contains only event UUID, tenant ID, data-source
ID, actor ID, action (`configured`, `reconfigured`, `credential-rotated`,
`key-rewrapped`, `revoked`), `succeeded` outcome and UTC timestamp. No secret,
host, username, database or raw request content may enter an event. Failed
validation returns sanitized errors; authorization failures are not silently
promoted to success. For production, integrate a rate-limited, tamper-resistant
security event stream for denied attempts and authentication anomalies at the
API edge without logging untrusted payloads, plus retention and alert policies.

Restrict SQLite catalog access and backups, avoid HTTP body logging for these
routes, exclude secrets from traces, telemetry and crash reports, use HTTPS to
the API under deployment termination, rotate operator and provider credentials,
and test recovery and key escrow in an isolated environment. Apply rate limits
and body-size limits at the ingress proxy as well as the application. Deleting
registration metadata cascades removal of the active encrypted profile, while
historical audit records remain.

## Open production gates

This feature is **not a license to connect**. Remaining hard requirements:

1. KMS/HSM-backed key lifecycle, backup/restore, operations and incident response.
2. Network egress restrictions plus verified socket-level IP pinning, DNS
   rebinding defense and full TLS enforcement for each concrete adapter.
3. Safe read-only SQLite file opening and OS-level tenant isolation.
4. Read-only provider accounts, restricted compilers, query budgets and audited
   execution with integration and conformance tests.
5. Production tenant provisioning/SSO, anti-abuse rate limiting, denial-event
   telemetry, security tests and threat-model validation.
