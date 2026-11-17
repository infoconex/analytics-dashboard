#!/usr/bin/env bash
set -euo pipefail

# Invoke from any working directory: bash lab/ux13/lab.sh up|verify|down.
lab_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "${lab_dir}/../.." && pwd)"
secret_path="${lab_dir}/secrets.env"
compose_file="${lab_dir}/compose.yml"
action="${1:-}"

if [[ "${action}" != up && "${action}" != verify && "${action}" != down ]]; then
  echo 'Usage: bash lab/ux13/lab.sh up|verify|down' >&2
  exit 2
fi

command -v docker >/dev/null || { echo 'Docker with Compose is required for this lab' >&2; exit 1; }
docker compose version >/dev/null
if [[ "${action}" != up && ! -f "${secret_path}" ]]; then
  echo 'No disposable lab credentials found; nothing to verify or tear down' >&2
  exit 1
fi

if [[ "${action}" == up ]]; then
  if [[ -e "${secret_path}" ]]; then
    echo 'Lab already provisioned. Verify it or explicitly tear it down before creating a fresh one.' >&2
    exit 1
  fi
  command -v openssl >/dev/null || { echo 'OpenSSL is required for ephemeral credentials' >&2; exit 1; }
  umask 077
  {
    printf 'UX13_ELASTIC_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'UX13_KIBANA_SYSTEM_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'UX13_VIEWER_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'UX13_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 32)"
    printf 'UX13_SAVED_OBJECTS_KEY=%s\n' "$(openssl rand -hex 32)"
    printf 'UX13_REPORTING_KEY=%s\n' "$(openssl rand -hex 32)"
  } > "${secret_path}"
fi

# Credentials are never printed, committed or uploaded. They remain on disk only
# until explicit `down`; the operator must protect this disposable workstation.
set -a
source "${secret_path}"
set +a
compose() { docker compose --env-file "${secret_path}" -f "${compose_file}" "$@"; }

case "${action}" in
  up)
    node "${repo_dir}/web/scripts/ux13/lab-fixtures.mjs" check
    compose pull
    compose up -d elasticsearch
    node "${repo_dir}/web/scripts/ux13/elastic-lab.mjs" seed-elasticsearch
    compose up -d kibana
    node "${repo_dir}/web/scripts/ux13/elastic-lab.mjs" seed-kibana
    node "${repo_dir}/web/scripts/ux13/capture-environment.mjs"
    echo 'Disposable 9.5.6 lab ready at http://127.0.0.1:15601 (Kibana).'
    echo 'Viewer username: ux13-northstar-viewer. Retrieve its password from lab/ux13/secrets.env locally; never share it.'
    ;;
  verify)
    node "${repo_dir}/web/scripts/ux13/elastic-lab.mjs" verify
    node "${repo_dir}/web/scripts/ux13/capture-environment.mjs"
    ;;
  down)
    compose down --volumes --remove-orphans
    # The only removed credential file is the exact, named disposable lab file.
    rm -- "${secret_path}"
    echo 'Removed ux13lab containers, named lab volumes and local ephemeral credentials.'
    ;;
esac
