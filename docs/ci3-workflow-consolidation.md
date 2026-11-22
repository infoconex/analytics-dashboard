# CI-3 — Permanent validation responsibilities and retired issue workflows

## Naming rule

**Workflows are named for enduring capabilities, not issues or pull requests.** Historical UX numbers remain in archived evaluation scripts and evidence where they explain provenance; they are not standing workflow names.

## Disposition of the previous workflows

| Former workflow | Decision | Current role |
| --- | --- | --- |
| `verify.yml` — general verification | **Keep** | `CI | Verify`: impact plan, .NET, Vitest/build, fictional lab guards, 4 browser shards, real providers, sample-host Compose, stable required gate |
| `codeql.yml` — security analysis | **Keep** | `Security | CodeQL`: PR language impact, both languages on main/schedule, stable security gate |
| `ux16-owner-docker.yml` — sample-host Docker smoke | **Integrate and retire** | `Integration | Sample host Compose` job in `CI | Verify`. Trigger on impacted runtime code and on all main pushes. Gate its result. Original shell script stays runnable locally. |
| `ux13-lab.yml` — Elastic research smoke | **Retire standing PR workflow** | On-demand `Evaluation | External analytics comparison` with one explicitly dispatched combined comparison. Preserve original source scripts/evidence, stop rerunning research on ordinary PRs. |
| `ux14-comparison.yml` — matched evaluation | **Retire standing PR workflow** | On-demand `Evaluation | External analytics comparison` using the same disposable fixture lifecycle. Historical evaluation must not be silently treated as an app merge gate. |

## Validation mapping

- **Application backend** (`src/**`) requires .NET tests, browser coverage, runtime Compose and C# CodeQL. Real-provider conformance applies for infrastructure adapters or test changes.
- **Application frontend** (`web/**` other than browser-only `web/e2e/**`) requires frontend tests/build, browser coverage, runtime Compose and JS/TS CodeQL; lab fixture checks apply when needed.
- **Browser-only test changes** run browser tests and JS/TS CodeQL but do not start Compose unnecessarily.
- **Configuration, workflows, CI scripts, unknown paths, deleted/renamed sensitive files** conservatively select every suite.
- **Docs-only PRs** validate the change-impact policy and mandatory gates without expensive application checks. Every **main** push still runs complete standard verification, including Compose.
- Manual historical comparison research is intentionally not run on every PR or main push; the standard fictional fixture guard tests (`npm run test:lab`) remain in the normal pipeline.

## Reproducing locally

```bash
bash scripts/ci/verify-compose-smoke.sh
bash scripts/ci/verify-product-comparison.sh
```

PowerShell scripts `scripts/ci/verify-backend.ps1`, `verify-frontend.ps1` and `verify-lab.ps1` remain independently runnable; `scripts/verify.ps1 -IncludeBrowserTests` remains a local full suite. The comparison's historical JavaScript evidence producers and fixture data retain their provenance while the runnable CI entrypoint uses a capability name.

## Administrative follow-up

The active `main` ruleset (ID `27303915`) requires pull requests and squash merges but currently does **not** declare mandatory status checks. An administrator must add `Gate | Required verification` and `Gate | Security analysis` as required status checks; the connected GitHub App lacks repository administration permissions. Do not claim that merge enforcement is enabled until an administrator confirms it.

In GitHub, open **Settings → Rules → Rulesets → main → Edit** (the ruleset at `https://github.com/infoconex/analytics-dashboard/rules/27303915`). Under **Branch rules**, enable **Require status checks to pass**; add exactly the two always-present check names above, selecting **GitHub Actions** as the source if offered. Save the active ruleset, then inspect its effective rules again and confirm a fresh PR cannot merge while either gate fails or is pending. Do not require any optional path-filtered evaluation workflow or individual matrix shard. Document the enforcement verification separately from successful workflow runs.

### Step-level review

- Eliminated the unnecessary .NET SDK setup and NuGet restore from **JavaScript/TypeScript CodeQL**; both are conditional on the C# matrix entry. Native GitHub setup, cache, artifact and code-analysis actions remain YAML primitives, while local test execution and fixture lifecycle stay in runnable scripts.
- Preserved npm, NuGet and Chromium cache restoration as required per isolated job. Four Playwright shards intentionally duplicate service setup to prevent shared mutable test state; their successful independent execution is not the same as duplicate test coverage.

### Consolidated evaluation script

A manually dispatched `Evaluation | External analytics comparison` runs `scripts/ci/verify-product-comparison.sh`, which performs both unique comparison phases using **one** fixture setup, one Chromium installation and unconditional cleanup, while preserving source PNGs, manifests and the matched-task review package. This avoids duplicating expensive research setup on every pull request. The historical workflow URLs are replaced with the single manual evaluation workflow in the original evidence documentation.
