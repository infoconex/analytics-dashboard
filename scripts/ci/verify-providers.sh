#!/usr/bin/env bash
# Isolated disposable DBMS fixture lifecycle; executable locally with Docker and pwsh.
set -euo pipefail
cd "$(dirname "$0")/../.."
cleanup() {
  docker rm -f analytics-sqlserver-fixture analytics-postgres-fixture analytics-mysql-fixture >/dev/null 2>&1 || true
}
trap cleanup EXIT
source ./scripts/start-provider-fixtures.sh
pwsh -NoProfile -File ./scripts/verify-provider-adapters.ps1
