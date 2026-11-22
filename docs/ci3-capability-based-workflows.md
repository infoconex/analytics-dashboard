# CI-3 — Durable, capability-named validation workflows

## Audit and decision

Historical issue identifiers describe **how a test was introduced**, not the permanent purpose of a CI stage. CI-3 reviewed all five active GitHub Actions workflow files and retired the three that had issue/UX number names:

| Previous workflow | Permanent capability | Disposition |
| --- | --- | --- |
| `ux13-lab.yml` (pinned lab / screenshots / isolation probes) | `comparison-lab.yml` | Consolidated |
| `ux14-comparison.yml` (paired task / browser evidence) | `comparison-lab.yml` | Consolidated |
| `ux16-owner-docker.yml` (local sample host / port boundaries) | `compose-smoke.yml` | Renamed |
| `verify.yml` (core tests, browser, provider, fixture guards) | `verify.yml` | Retained |
| `codeql.yml` (C# / JavaScript security analysis) | `codeql.yml` | Retained |

The two historical comparison jobs each provisioned the **same pinned Elastic/Kibana lab** and installed Node/Chromium. The new `scripts/ci/verify-comparison-lab.sh` executes both unique checks inside **one** disposable lab lifecycle, reusing the same unprivileged viewer, fixture hashes, source records and local-only credentials. The existing two original evidence directories (`lab/ux13/evidence/`, `lab/ux14/evidence/`) and review package are preserved separately inside one downloadable artifact. Unique synthetic authorization probes, cross-product task paths, screenshot conditions and immutable fixture assertions have not been removed.

## What runs when

- **Routine PRs:** `CI | Verify` and `Security | CodeQL` decide the affected suites, preserving their permanent gates.
- **Comparison fixture/harness edits:** `Lab | Product comparison` runs automatically (both historical evidence phases in one job). A **manual workflow_dispatch** is available for ad hoc research verification.
- **Local Compose configuration or smoke-script edits:** `Environment | Compose smoke` runs automatically on PR and matching pushes to main; manual dispatch also supported.
- **Documentation-only PRs:** No Elastic/Kibana or Docker smoke jobs triggered by document edits.
- **All main pushes:** full standard `CI | Verify` and both CodeQL language analyses. The expensive research comparison is PR-scoped/manual, not repeated on every main push.

`web/scripts/ux13`, `web/scripts/ux14`, `lab/ux13` and `lab/ux14` retain historical research IDs for provenance, fixture digests, and original evidence. The **long-lived workflow, job, and script entrypoint names** use capabilities instead.

## Independently runnable scripts

```bash
bash scripts/ci/verify-comparison-lab.sh     # Node 24, Docker, Chromium, pinned fictional Elastic lab
bash scripts/ci/verify-compose-smoke.sh      # Docker + Compose + curl + jq; runs sample host/port smoke
```

Each script owns setup, assertions and cleanup; workflow YAML owns only runner, permissions, action setup, trigger and artifact publication. A missing or failed prerequisite exits nonzero and does not make synthetic evidence appear to succeed.

## Branch-protection finding

The existing active `main` ruleset enforces pull requests and squash merges but **does not currently require status checks**. A repo administrator should add the stable check names `Gate | Required verification` and `Gate | Security analysis` (plus the comparison and Compose checks if desired for relevant changes) to ruleset required-status-check protections. The connected GitHub App cannot alter rulesets; workflow success is not currently an enforced merge prerequisite. Avoid making optional path-filtered workflows unconditional required checks, since a skipped workflow may leave required checks pending.

## Verification criteria

Confirm this PR executes full `CI | Verify`, CodeQL, the single comparison lab and the Compose smoke; verify sample artifacts, auth boundary probes, both task phases and cleanup. Confirm post-merge `main` full verification and C#/JS CodeQL. Record real outcomes before claiming completion.
