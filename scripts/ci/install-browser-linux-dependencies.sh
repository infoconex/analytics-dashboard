#!/usr/bin/env bash
# Bound the complete installer, including its privileged APT descendants.
# A user-level timeout alone cannot reliably terminate root-owned children.
set -euo pipefail

run_bounded_installer() {
    local runtime="$1" grace="$2"
    shift 2
    # Run the locked Playwright CLI as the runner user, not as root. The
    # system service's cgroup also contains the sudo/apt/dpkg descendants.
    # Stream the original installer output and systemd's exit diagnostics.
    local status=0
    sudo -n systemd-run --wait --pipe --collect --service-type=exec \
        --property=TimeoutStartSec=15s \
        --property="RuntimeMaxSec=${runtime}s" \
        --property="TimeoutStopSec=${grace}s" \
        --property=KillMode=control-group \
        --uid="$(id -u)" --gid="$(id -g)" \
        --working-directory="$PWD" --setenv="PATH=$PATH" --setenv="HOME=$HOME" \
        --setenv=CI=true -- "$@" || status=$?
    if (( status != 0 )); then
        echo "Linux dependency installation failed (exit $status; runtime limit ${runtime}s, termination grace ${grace}s). See installer and systemd diagnostics above." >&2
    fi
    return "$status"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    if [[ "$#" != 0 || "${CI:-}" != true || "${GITHUB_ACTIONS:-}" != true || "${RUNNER_OS:-}" != Linux ]]; then
        echo 'Usage: hosted Linux CI only: install-browser-linux-dependencies.sh' >&2
        exit 2
    fi
    echo 'Linux dependency installation: 180s runtime limit, 15s termination grace'
    run_bounded_installer 180 15 /usr/bin/env npx playwright install-deps chromium
fi
