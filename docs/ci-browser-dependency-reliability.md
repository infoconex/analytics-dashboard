# Hosted Linux browser dependency reliability (#145)

## Evidence and scope

PR verification run [45754520274, shard 6](https://github.com/infoconex/analytics-dashboard/actions/runs/45754520274/job/139690096532) stopped logging APT index retrieval at 04:21:35 UTC on 2026-11-26, after Azure Ubuntu mirror failures and fallback to archive.ubuntu.com. The job was canceled at 04:45:46 UTC (24m 11s without logged progress). Browser tests never started and the required gate failed. Thirteen cached package archives were restored on each of the other five shards. An archive cache does not replace a fresh index update. The logs do not establish the underlying network fault.

Healthy dependency phases in the five other shards of that run took 11.528–31.174s; all six in [45776802757](https://github.com/infoconex/analytics-dashboard/actions/runs/45776802757) took 11.835–33.456s. The latter full workflow took 218s, aggregate job time 1,254s, aggregate browser job time 992s, and aggregate Playwright execution including server startup 560.876s (observed baseline, not a guarantee).

## Policy

- The existing temporary root-owned APT configuration adds 30s HTTP and HTTPS connection/data timeouts, one acquisition retry, and `APT::Update::Error-Mode "any"` (fail an unsuccessful index refresh rather than fall back to stale indexes).
- Connection/data timeouts are not total download deadlines; multiple transfers, DNS, mirror fallback and package processing can accumulate. The complete Playwright Linux dependency phase has a 180s runtime limit (over five times the slowest observed healthy phase), a 15s service startup limit and a 15s graceful termination interval before forced termination.
- The helper starts a transient systemd service with the CI runner UID/GID and working directory. The locked Playwright CLI still invokes its normal privileged APT installer; the service control group contains privileged descendants too, unlike a timeout applied only to an unprivileged parent. Original output and systemd result/exit diagnostics remain visible. Any unsuccessful result fails the measured phase and the browser job, and the existing required gate rejects failure. A hard limit may interrupt dpkg; a failed disposable hosted runner is not reused or cached as successful.
- No repository/mirror rewrite, authentication bypass, unsigned packages, browser retries, shard changes, cache key changes, or job timeout changes. Only completed .deb archives are cached, not indexes or installed state. The wrapper's EXIT trap removes its temporary configuration and archive directory on normal completion and ordinary failure. Job-level hard cancellation can still prevent traps from running; hosted runners are disposable.
- Applies to the existing hosted Linux CI path. Other verification paths are unchanged. The policy assumes the Ubuntu GitHub-hosted runner supports systemd and passwordless sudo; absence of these prerequisites fails rather than skips installation.

## References

- [APT HTTP transport timeout](https://manpages.ubuntu.com/manpages/noble/man1/apt-transport-http.1.html)
- [APT configuration and acquisition retries](https://manpages.ubuntu.com/manpages/noble/man5/apt.conf.5.html)
- [APT update error handling](https://manpages.ubuntu.com/manpages/noble/man8/apt-get.8.html)
- [systemd-run](https://www.freedesktop.org/software/systemd/man/255/systemd-run.html)
- [systemd service runtime and stop controls](https://www.freedesktop.org/software/systemd/man/255/systemd.service.html)
- [GitHub runner image mirror stall report](https://github.com/actions/runner-images/issues/14594)

## Verification

The CI orchestration tests inspect the actual generated APT configuration using a temporary-directory fixture, test admission and cleanup on installer failure, and exercise the existing required verification gate. On hosted Linux, a short-duration transient-service fixture tests success, nonzero exit propagation and termination of a stalled privileged child without touching package sources or relying on a public mirror outage. The fixture validates the same runtime-control mechanism with shorter deadlines; it does not reproduce the actual Ubuntu mirror fault. Healthy six-shard and full post-merge measurements are recorded in issue #145 after verification.
