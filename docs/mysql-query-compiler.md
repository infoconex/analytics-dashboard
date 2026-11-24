# MySQL restricted analytics compiler (PROV-02)

**Status: offline provider infrastructure; no customer execution.** The deployed API uses an empty trusted dataset catalog and a permanently unavailable runtime transport.

The MySQL compiler reuses the shared trusted binding and query-shape validator, native typed parameters, grouped aggregation and stable-key pagination. It creates only restricted SELECT plans, never a connection or query execution grant. The command factory requires an already-compiled MySQL plan and a caller-supplied native connection.

- Identifiers are quoted in the MySQL dialect from trusted metadata; user-controlled text never becomes SQL syntax.
- Contains/prefix use INSTR with bound strings. SQL LIKE wildcard symbols have no special meaning in these operators. Database collation controls case sensitivity.
- Native parameters cover text, decimal, boolean and timestamp. Approved MySQL datasets must store UTC instants in DATETIME(6) columns (no implicit server-timezone conversions). Timestamps with finer-than-microsecond precision are rejected rather than silently moved across a half-open boundary.
- A disposable MySQL 8.4 fixture validates real provider behavior: pre-aggregation date and field filters, half-open UTC intervals, exact decimal aggregates, literal text, injection safety, deterministic pagination and SELECT-only reader authorization.
- Test-only loopback connections with disabled TLS must never be used in production.

Production dataset registration, pinned-IP/hostname-validated TLS, independent egress controls, credential management, result materialization, rate limits, cancellation, audit and customer query admission remain separate security gates.
