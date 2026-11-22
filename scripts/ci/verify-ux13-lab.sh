#!/usr/bin/env bash
# Pinned fictional UX-13 comparison lab: no customer data or production credentials.
set -euo pipefail
cd "$(dirname "$0")/../.."
cleanup() {
  if [[ -f lab/ux13/secrets.env ]]; then bash lab/ux13/lab.sh down; fi
}
trap cleanup EXIT
npm --prefix web ci --no-audit --no-fund
bash lab/ux13/lab.sh up
cd web
npx playwright install --with-deps chromium
set -a
source ../lab/ux13/secrets.env
set +a
node scripts/ux13/kibana-browser.mjs
