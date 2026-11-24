#!/usr/bin/env bash
# Hosted Ubuntu CI only. Keep APT's normal repository/index verification and
# Playwright installation; cache only package archives, never installed state.
set -euo pipefail

if [[ "$#" != 2 || "${CI:-}" != true || "${GITHUB_ACTIONS:-}" != true || "${RUNNER_OS:-}" != Linux ]]; then
    echo 'Usage: hosted Linux CI only: verify-browser-with-apt-cache.sh SHARD TOTAL' >&2
    exit 2
fi
: "${RUNNER_TEMP:?}" "${GITHUB_OUTPUT:?}"
cache_dir="$RUNNER_TEMP/playwright-apt-debs"
mkdir -p -- "$cache_dir"

archive_dir=''
apt_config=''
cleanup() {
    if [[ -n "$apt_config" ]]; then sudo rm -f -- "$apt_config"; fi
    if [[ -n "$archive_dir" ]]; then sudo rm -rf -- "$archive_dir"; fi
}
trap cleanup EXIT

# Use a temporary root-owned archive directory, outside the default APT
# cleanup-hook paths. Never expose a user-writable directory to APT as root.
archive_dir="$(sudo mktemp -d /var/cache/nexa-playwright-apt.XXXXXX)"
sudo chmod 0755 "$archive_dir"
apt_config="$(sudo mktemp /etc/apt/apt.conf.d/99nexa-playwright-XXXXXX)"
printf 'Dir::Cache::archives "%s/";\nAPT::Keep-Downloaded-Packages "true";\nBinary::apt::APT::Keep-Downloaded-Packages "true";\nBinary::apt-get::APT::Keep-Downloaded-Packages "true";\n' "$archive_dir" | sudo tee "$apt_config" >/dev/null
# Only regular package archives are staged. APT validates requested versions
# against current signed repository indexes, downloading any missing packages.
find "$cache_dir" -maxdepth 1 -type f -name '*.deb' -exec sudo install -m 0644 -t "$archive_dir" -- {} +
restored="$(find "$cache_dir" -maxdepth 1 -type f -name '*.deb' -printf '.' | wc -c)"
echo "Playwright APT archives restored: $restored"

pwsh -NoProfile -File scripts/verify-browser.ps1 -ShardIndex "$1" -ShardTotal "$2"

# APT's partial files, lock files, configuration and indexes are excluded.
sudo find "$archive_dir" -maxdepth 1 -type f -name '*.deb' \
    -exec install -m 0644 -o "$(id -u)" -g "$(id -g)" -t "$cache_dir" -- {} +
archives="$(find "$cache_dir" -maxdepth 1 -type f -name '*.deb' -printf '.' | wc -c)"
echo "Playwright APT archives available: $archives"
echo "archives=$archives" >> "$GITHUB_OUTPUT"
