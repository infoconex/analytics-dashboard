# UX-16 — Local product-owner Docker review

Tracking: [Issue #58](https://github.com/infoconex/analytics-dashboard/issues/58). This is a **fictional-data-only development setup**, not a production deployment or a human usability study.

## Prerequisites and safety

- Check out the intended main commit in a separate, clean workspace. The UX-15 review baseline is `1562af1a979cdc61aeacb04befaaaf7c2a52ea47`.
- Docker Desktop must be running **Linux containers**. Switching from Windows containers stops the Windows-container workload; coordinate that separately.
- Docker Compose V2 and Linux image pull/registry access are required. Neither .NET nor Node needs to be installed on the Windows host.
- **Do not** attach real data, production credentials, active connectors, or customer identity. The API deliberately runs in `Development` and uses the Northstar Commerce **demo owner**, so this environment is unsafe to expose beyond the workstation.
- Port `5173` must be free. The Compose configuration publishes the Vite UI only to host `127.0.0.1`; the .NET API is **not** published to the host.

## Start and check

Run from the repository root in PowerShell:

```powershell
docker compose -f compose.ux16-owner.yml config --quiet
docker compose -f compose.ux16-owner.yml up -d
docker compose -f compose.ux16-owner.yml ps
```

The first start pulls `mcr.microsoft.com/dotnet/sdk:10.0` and `node:24.22.3-bookworm-slim`, restores .NET dependencies and runs `npm ci`. This takes longer than a restart. The .NET image is the current 10.0 SDK tag, not a digest-pinned release artifact; the configured `global.json` requires the 10.0.400 SDK feature band or a later patch. Stop if the image does not satisfy it rather than silently changing the project's SDK pin.

Check startup output without exposing any real secrets:

```powershell
docker compose -f compose.ux16-owner.yml logs --tail 80 api web
```

Expect the API to listen on `0.0.0.0:5055` **inside the container namespace** and Vite on `0.0.0.0:5173` inside the same namespace. Open:

- [Standalone authoring](http://localhost:5173) — fixed Northstar Commerce demonstration; create and edit sample dashboards.
- [Same-origin sample host](http://localhost:5173/sample-host.html) — read-only interface to the existing fictional sample dashboard. The interface does not revoke underlying API privileges or establish a production embedding contract.

The frontend shares the API container's network namespace using Compose `network_mode: service:api`. This preserves the existing checked-in Vite proxy `/api → http://localhost:5055` without changing application code. Browser traffic goes to Vite on host loopback and then to the API inside the containers. The API itself has no host-published port.

## Owner smoke checks

1. Verify the **DEMO DATA** indicator, **Northstar Commerce**, and a fictional sample dashboard.
2. Create `UX16 Owner Review — Fictional`, add a chart, save changes, reload and revisit. Confirm the saved definition persists.
3. Exercise all nine gallery choices: metric, line, area, bar, donut, table, pie, histogram and scatter. Confirm live preview and exact original fictional rows. A pie/donut of independent channel conversion percentages must be rejected.
4. Inspect Edit, Add/Update, Cancel, reorder controls, Save and reload; record where behavior feels unclear.
5. Open the same-origin sample host and inspect only supported read-only consumption.
6. Separately test browser-native 200%/400% zoom, narrow viewports, keyboard focus and forced colors. Automated screenshots and axe checks do not prove WCAG conformance or human task success.

Capture owner observations using the durable UX-16 Product-Owner Review Kit. Never create participant records or persistent analytics telemetry.

## Persistence, stop and recovery

Compose defines two project-specific named volumes:

- `ux16-catalog`: SQLite **dashboard-definition metadata** and seeded fictional organization membership.
- `ux16-node-modules`: container-local npm dependency installation.

The source is bind-mounted into `/workspace`; .NET may write ignored `bin/` and `obj/` folders in the disposable checkout. The sample analytics arrays in `web/src/demoData.ts` are not persisted or replaced.

Stop without destroying saved definitions:

```powershell
docker compose -f compose.ux16-owner.yml down
```

**Do not use `down -v`** for normal review; that would delete named volumes and stored dashboard definitions. Re-running `up -d` should retain previously saved dashboards. For a broken service, inspect `ps` and the last 80 lines of `logs` before deciding on a fix. Do not expose port 5173 on `0.0.0.0` or change development authentication to make a failure disappear.

If returning to Windows containers later, shut down this Linux Compose project first and switch modes deliberately. That transition is a workstation operation, not part of automated review setup.

## Non-goals and verification status

This Compose setup changes no API routes, production identity, tenant isolation, data-source runtime transport, chart contracts, cross-origin messaging, host integration contracts, or deployment policy. It has no production secrets. The UI exposes fictional records only. Live SQL Server/PostgreSQL acceptance and CodeQL remain the repository's independently verified CI responsibilities, not proof obtained by starting this Compose environment.

The operator must run `docker compose config`, inspect the actual UI and report results; the configuration alone does not establish successful launch, owner task completion, human usability validation or accessible screen-reader interaction.
