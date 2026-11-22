# CI-2 — Change-aware, script-driven verification

The GitHub workflows are **declarative orchestration**. Commands and fixture lifecycle belong in repository scripts under `scripts/ci/`, which can be invoked directly on supported machines. CI-1's parallel browser shards and separated per-shard SQLite catalogs are retained.

## Design

- **`CI | Verify`** always starts a lightweight `Plan | Test impact` job, including regression tests for the classification and verification-gate policies.
- The PR classifier compares the **merge base** of the PR base/head SHAs, including deletion and rename paths, to select `backend`, `frontend`, `lab`, `browser`, `providers`, and CodeQL languages. Unexpected paths, absent diffs or CI/script/shared-config edits require **all** suites.
- On `main` pushes and manual dispatches the classifier selects **all** suites even for documentation-only changes. CodeQL also runs both languages on weekly scheduled scans.
- A stable `Gate | Required verification` job uses `always()` to ensure each selected suite succeeded and no required suite was silently skipped or failed. This gate does not validate CodeQL; CodeQL checks remain separately visible and should also be required in branch rules.
- No `paths` or `paths-ignore` filters are placed on `CI | Verify`. Optional, historically expensive UX-13/14/16 labs retain their explicit path triggers and manual dispatch support.
- **Security:** The classifier is a test-routing optimization, not an authorization boundary; use main-branch full verification and trusted reviews on workflow/policy changes. The GitHub App connection cannot update branch rules or configured required checks.

### PR impact policy

| Change | Suites selected |
| --- | --- |
| `docs/**`, README, SECURITY only | Plan + stable gate; no application test suite |
| `web/src/**` | Frontend unit/build, browser, JS/TS CodeQL |
| `web/e2e/**` | Browser, JS/TS CodeQL |
| `web/package*.json`, `web/scripts/**` | Frontend, lab, browser, JS/TS CodeQL |
| `src/**` | Backend, browser, C# CodeQL |
| `src/AnalyticsDashboard.Infrastructure/**`, `tests/**` | Backend, browser, real DB providers, C# CodeQL |
| `lab/**` | Frontend, lab, browser, JS/TS CodeQL |
| `.github/**`, `scripts/**`, global config, unknown paths | All |

Multiple changed areas use the **union** of suites. We intentionally avoid test-name or grep-based selective browser execution until dependency coverage is proven.

### Cache ownership and dependencies

- GitHub-provided Node/npm cache remains per lockfile; `npm ci` still enforces lockfile integrity.
- NuGet and Chromium caches are restored read-only in all consuming jobs using `actions/cache/restore@v6` at an immutable action SHA.
- **Only Chromium browser shard 1 saves NuGet and Chromium caches** using `actions/cache/save@v6`. This avoids parallel write races. Other runners can consume the cache on subsequent runs, not immediately within the same run.
- Cache keys include platform and manifest hashes; browser binary installation still validates runtime/system dependencies.
- Native Actions (checkout/setup/cache/artifacts/CodeQL) remain in YAML because they are platform integration primitives, not executable test logic. Actions are pinned to verified immutable commit SHAs.

### Local commands

```powershell
./scripts/ci/verify-backend.ps1
./scripts/ci/verify-frontend.ps1
./scripts/ci/verify-lab.ps1
./scripts/verify-browser.ps1 -ShardIndex 1 -ShardTotal 4
./scripts/verify.ps1 -IncludeBrowserTests
```

```bash
bash scripts/ci/verify-providers.sh       # Docker, pwsh, local DB port availability
bash scripts/ci/verify-ux13-lab.sh        # Isolated fictional Elastic lab
bash scripts/ci/verify-ux14-lab.sh        # Isolated matched comparison lab
bash scripts/ci/verify-owner-compose.sh  # Isolated fictional Compose smoke
python3 -m unittest discover -s scripts/ci/tests -p 'test_*.py'
python3 scripts/ci/change-impact.py --files docs/example.md
python3 scripts/ci/change-impact.py --files web/src/App.tsx
```

Each lifecycle wrapper uses `trap` for disposable resource teardown. The existing `scripts/start-provider-fixtures.sh` exports masked ephemeral credentials; do not persist those values or point these scripts at production servers.

### Pipeline verification

Before merging, verify **all** impacted suites, both CodeQL languages and optional lab workflows triggered by CI changes. Confirm a docs-only PR suppresses expensive suites (plan and gate still succeed), and an unknown/shared path forces full validation. Validate the full test matrix and CodeQL on `main` after squash merge.

**Naming convention**: workflow `Domain | Purpose`; job `Area | Result`; step `Action | What is performed`. User-facing job names indicate which failure to investigate, without encoding historical UX increments in the general-purpose CI jobs.

### Stable CodeQL reporting

The CodeQL workflow generates a dynamic language matrix with **only impacted languages**, rather than reporting skipped per-step language analyses as green. An always-present `Gate | Security analysis` validates the matrix result (and confirms documentation-only skips). Require this stable security gate separately from the general verification gate when configuring branch rules.

The optional owner Compose script now validates complete HTTP responses before inspecting their contents, avoiding `curl | grep -q` broken pipes under `set -o pipefail`.

## Enduring workflow ownership (CI-3)

The standing PR pipeline validates capabilities, not historical UX increment numbers. `CI | Verify` owns backend, frontend, fictional lab guards, browser E2E, SQL Server/PostgreSQL and **same-origin sample-host Docker Compose integration**. The Compose smoke is change-aware on relevant application code and always runs on `main`; it is included in `Gate | Required verification`. `Security | CodeQL` retains language-selected PR checks and full main/scheduled scans. `Evaluation | External analytics comparison` provides **manual-only** historical Elastic/Kibana smoke or matched browser evidence and is intentionally not a permanent PR merge gate. The original comparison scripts and recorded documents remain available for reproducibility.
