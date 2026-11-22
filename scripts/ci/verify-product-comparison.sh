#!/usr/bin/env bash
# Reproduce the complete fictional Elastic/Kibana comparison lab locally or in CI.
# Preserves both independent fixture/security screenshot evidence and task-pair evidence.
set -euo pipefail
cd "$(dirname "$0")/../.."

vite_pid=''
cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n "$vite_pid" ]]; then
    kill "$vite_pid" >/dev/null 2>&1 || true
    wait "$vite_pid" >/dev/null 2>&1 || true
  fi
  if [[ -f lab/ux13/secrets.env ]]; then
    bash lab/ux13/lab.sh down || true
  fi
  exit "$status"
}
trap cleanup EXIT

# Both lab phases use the same pinned fixture and disposable credentials.
npm --prefix web ci --no-audit --no-fund
npm --prefix web run test:lab
bash lab/ux13/lab.sh up
bash lab/ux13/lab.sh verify
(cd web && npx playwright install --with-deps chromium)

# Evidence phase 1: pinned Elastic screenshot, fixture, and access boundary.
(
  cd web
  set -a
  source ../lab/ux13/secrets.env
  set +a
  node scripts/ux13/kibana-browser.mjs
)

# Evidence phase 2: matched task comparisons across the same fixed fixture.
npm --prefix web run dev -- --host 127.0.0.1 > "${RUNNER_TEMP:-/tmp}/comparison-vite.log" 2>&1 &
vite_pid=$!
ready=0
for attempt in $(seq 1 45); do
  if curl --silent --fail http://127.0.0.1:5173/ >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo 'Local fictional frontend did not become ready.' >&2
  exit 1
fi
(
  cd web
  set -a
  source ../lab/ux13/secrets.env
  set +a
  node scripts/ux14/browser-evidence.mjs
)

# Keep original source screenshots and the review derivative separately.
if [[ -f lab/ux14/evidence/manifest.json ]]; then
  (cd lab/ux14/evidence && zip -q -r ../ux14-review-package.zip .)
fi
echo 'External analytics evaluation passed. Resources are removed by the exit trap.'
