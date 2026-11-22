#!/usr/bin/env bash
# Local sample-host Compose smoke test; always removes disposable containers.
set -euo pipefail
cd "$(dirname "$0")/../.."
cleanup() {
  code=$?
  if [[ "$code" -ne 0 ]]; then
    docker compose -f compose.ux16-owner.yml ps || true
    docker compose -f compose.ux16-owner.yml logs --tail 60 api web || true
  fi
  trap - EXIT
  if ! docker compose -f compose.ux16-owner.yml down; then
    echo "Sample-host Compose cleanup failed." >&2
    code=1
  fi
  exit "$code"
}
trap cleanup EXIT
docker compose -f compose.ux16-owner.yml config --quiet
docker compose -f compose.ux16-owner.yml up -d
for attempt in $(seq 1 120); do
  response=$(curl --silent --fail --max-time 3 http://127.0.0.1:5173/api/organizations || true)
  if jq -e 'any(.[]; .id == "northstar" and .role == "owner")' <<< "$response" >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" -eq 120 ]]; then
    echo 'Timed out waiting for the fictional API behind Vite.' >&2
    exit 1
  fi
  sleep 2
done
# Avoid curl | grep -q with pipefail: grep may exit early and produce EPIPE.
index_html=$(curl --silent --show-error --fail http://127.0.0.1:5173/)
[[ "$index_html" == *root* ]] || { echo 'Vite root was not served.' >&2; exit 1; }
host_html=$(curl --silent --show-error --fail http://127.0.0.1:5173/sample-host.html)
[[ "$host_html" == *Insights* && "$host_html" == *host-dashboard-picker* && "$host_html" == *sampleHostMain.ts* && "$host_html" == *about:blank* && "$host_html" == *host-frame-loading* ]] || {
  echo 'Sample host navigation content was not served.' >&2; exit 1;
}
dashboard=$(curl --silent --show-error --fail http://127.0.0.1:5173/api/organizations/northstar/dashboards)
jq -e 'any(.[]; .name == "Business performance") and any(.[]; .name == "Channel performance")' <<< "$dashboard"
channel=$(curl --silent --show-error --fail http://127.0.0.1:5173/api/organizations/northstar/dashboards/c730b8e2-4990-42b7-80cc-71b47290aec4)
jq -e '.organizationId == "northstar" and .name == "Channel performance"' <<< "$channel"
denied=$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:5173/api/organizations/isolated/dashboards/c730b8e2-4990-42b7-80cc-71b47290aec4)
[[ "$denied" == 403 ]] || { echo "Cross-tenant dashboard was not denied: $denied" >&2; exit 1; }
if curl --silent --fail --max-time 2 http://127.0.0.1:5055/api/organizations >/dev/null; then
  echo 'The API must not be published on the host.' >&2
  exit 1
fi
echo 'Sample-host Compose integration smoke succeeded.'
