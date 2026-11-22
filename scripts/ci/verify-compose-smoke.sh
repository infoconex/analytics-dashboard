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
  docker compose -f compose.ux16-owner.yml down || true
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
[[ "$host_html" == *Insights* ]] || { echo 'Sample host content was not served.' >&2; exit 1; }
dashboard=$(curl --silent --show-error --fail http://127.0.0.1:5173/api/organizations/northstar/dashboards)
jq -e 'any(.[]; .name == "Business performance")' <<< "$dashboard"
if curl --silent --fail --max-time 2 http://127.0.0.1:5055/api/organizations >/dev/null; then
  echo 'The API must not be published on the host.' >&2
  exit 1
fi
echo 'Local owner Compose smoke succeeded.'
