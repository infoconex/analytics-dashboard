# SQLite restricted analytics query compiler (PROV-01)

This implementation is **offline infrastructure**. The customer API remains non-executable; deployed transport is permanently unavailable. The internal SQLite catalog used to store dashboard metadata is distinct from this analytics adapter.

- The compiler reuses the trusted binding, validated query shapes, native parameters, grouped aggregates and stable pagination; its SQL consists of restricted SELECT statements only.
- The command factory binds to a caller-supplied SQLite connection. It neither opens a file nor executes SQL.
- Substring and prefix operations use SQLite instr(), which treats wildcard characters literally. Cross-provider case/collation behavior is not assumed equivalent.
- Trusted dataset timestamp columns **MUST** be canonical fixed-width UTC ISO-8601 TEXT with binary ordering: yyyy-MM-ddTHH:mm:ss.fffffffZ. Mixed offsets, legacy date formats and epoch integers are unsupported; this is an operator schema obligation.
- SQLite has no native exact decimal storage type. Number filter parameters preserve invariant decimal text before NUMERIC affinity coercion; SQLite aggregates may use binary floating point, so exact currency arithmetic cannot be claimed without an explicit data-model policy.
- Normal backend tests exercise real in-memory SQLite SELECT execution, predicate-before-aggregate semantics, exact half-open UTC boundaries, literal text comparisons, pagination, provider mismatch, injection safety and read-only enforcement with PRAGMA query_only.

Customer file access policy, trusted production dataset registry, quotas, audit, network transport, materialization and production authorization remain independent prerequisites. No live customer execution endpoint is introduced.
