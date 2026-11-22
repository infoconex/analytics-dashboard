# CI-3 — Permanent validation responsibilities and retired issue workflows

## Naming rule

**Workflows are named for enduring capabilities, not issues or pull requests.** Historical UX numbers remain in archived evaluation scripts and evidence where they explain provenance; they are not standing workflow names.

## Disposition of the previous workflows

| Former workflow | Decision | Current role |
| --- | --- | --- |
| `verify.yml` — general verification | **Keep** | `CI | Verify`: impact plan, .NET, Vitest/build, fictional lab guards, 4 browser shards, real providers, sample-host Compose, stable required gate |
| `codeql.yml` — security analysis | **Keep** | `Security | CodeQL`: PR language impact, both languages on main/schedule, stable security gate |
| `ux16-owner-docker.yml` — sample-host Docker smoke | **Integrate and retire** | `Integration | Sample host Compose` job in `CI | Verify`. Trigger on impacted runtime code and on all main pushes. Gate its result. Original shell script stays runnable locally. |
| `ux13-lab.yml` — Elastic research smoke | **Retire standing PR workflow** | On-demand `Evaluation | External analytics comparison` with `elastic-smoke` selection. Preserve the original script/evidence, stop rerunning research on ordinary PRs. |
| `ux14-comparison.yml` — matched evaluation | **Retire standing PR workflow** | On-demand `Evaluation | External analytics comparison` with `matched-tasks` selection. Historical evaluation must not be silently treated as an app merge gate. |

## Validation mapping

- **Application backend** (`src/**`) requires .NET tests, browser coverage, runtime Compose and C# CodeQL. Real-provider conformance applies for infrastructure adapters or test changes.
- **Application frontend** (`web/**` other than browser-only `web/e2e/**`) requires frontend tests/build, browser coverage, runtime Compose and JS/TS CodeQL; lab fixture checks apply when needed.
- **Browser-only test changes** run browser tests and JS/TS CodeQL but do not start Compose unnecessarily.
- **Configuration, workflows, CI scripts, unknown paths, deleted/renamed sensitive files** conservatively select every suite.
- **Docs-only PRs** validate the change-impact policy and mandatory gates without expensive application checks. Every **main** push still runs complete standard verification, including Compose.
- Manual historical comparison research is intentionally not run on every PR or main push; the standard fictional fixture guard tests (`npm run test:lab`) remain in the normal pipeline.

## Reproducing locally

```bash
bash scripts/ci/verify-owner-compose.sh
bash scripts/ci/verify-ux13-lab.sh
bash scripts/ci/verify-ux14-lab.sh
```

PowerShell scripts `scripts/ci/verify-backend.ps1`, `verify-frontend.ps1` and `verify-lab.ps1` remain independently runnable; `scripts/verify.ps1 -IncludeBrowserTests` remains a local full suite. The three retained historical scripts keep their issue-era names as traceable research artifacts, **not workflows**.

## Administrative follow-up

The active `main` ruleset (ID `27303915`) requires pull requests and squash merges but currently does **not** declare mandatory status checks. An administrator must add `Gate | Required verification` and `Gate | Security analysis` as required status checks; the connected GitHub App lacks repository administration permissions. Do not claim that merge enforcement is enabled until an administrator confirms it.

### Step-level review

- Eliminated the unnecessary .NET SDK setup and NuGet restore from **JavaScript/TypeScript CodeQL**; both are conditional on the C# matrix entry. Native GitHub setup, cache, artifact and code-analysis actions remain YAML primitives, while local test execution and fixture lifecycle stay in runnable scripts.
- Preserved npm, NuGet and Chromium cache restoration as required per isolated job. Four Playwright shards intentionally duplicate service setup to prevent shared mutable test state; their successful independent execution is not the same as duplicate test coverage.
