#!/usr/bin/env bash
# Pinned fictional UX-14 matched UI comparison lab with guaranteed cleanup.
set -euo pipefail
cd "$(dirname "$0")/../.."
vite_pid=''
cleanup() {
  if [[ -n "$vite_pid" ]]; then kill "$vite_pid" >/dev/null 2>&1 || true; fi
  if [[ -f lab/ux13/secrets.env ]]; then bash lab/ux13/lab.sh down; fi
}
trap cleanup EXIT
npm --prefix web ci --no-audit --no-fund
npm --prefix web run test:lab
bash lab/ux13/lab.sh up
bash lab/ux13/lab.sh verify
(cd web && npx playwright install --with-deps chromium)
npm --prefix web run dev -- --host 127.0.0.1 > "${RUNNER_TEMP:-/tmp}/ux14-vite.log" 2>&1 &
vite_pid=$!
ready=0
for attempt in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:5173/ >/dev/null; then ready=1; break; fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo 'Local fictional presentation did not become ready.' >&2
  exit 1
fi
(
  cd web
  set -a
  source ../lab/ux13/secrets.env
  set +a
  node scripts/ux14/browser-evidence.mjs
)
if [[ -f lab/ux14/evidence/manifest.json ]]; then
  (cd lab/ux14/evidence && zip -q -r ../ux14-review-package.zip .)
fi
