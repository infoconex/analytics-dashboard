#!/usr/bin/env bash
# Source locally to retain the exported credentials for verify-provider-adapters.ps1.
# CI uses the GITHUB_ENV channel; passwords exist only for these disposable containers.
set -euo pipefail

if ! command -v docker >/dev/null || ! command -v openssl >/dev/null; then
  echo 'Docker and openssl are required for real-provider test fixtures.' >&2
  return 1 2>/dev/null || exit 1
fi

export ANALYTICS_TEST_SQLSERVER_ADMIN="Aa1!$(openssl rand -hex 16)"
export ANALYTICS_TEST_POSTGRES_ADMIN="$(openssl rand -hex 20)"
export ANALYTICS_TEST_SQLSERVER_READER="Aa1!$(openssl rand -hex 16)"
export ANALYTICS_TEST_POSTGRES_READER="$(openssl rand -hex 20)"
export ANALYTICS_TEST_MYSQL_ADMIN="$(openssl rand -hex 20)"
export ANALYTICS_TEST_MYSQL_READER="$(openssl rand -hex 20)"

docker run -d --rm --name analytics-sqlserver-fixture \
  -e ACCEPT_EULA=Y -e "MSSQL_SA_PASSWORD=$ANALYTICS_TEST_SQLSERVER_ADMIN" \
  -p 127.0.0.1:1433:1433 mcr.microsoft.com/mssql/server:2022-latest >/dev/null
docker run -d --rm --name analytics-postgres-fixture \
  -e POSTGRES_USER=postgres -e "POSTGRES_PASSWORD=$ANALYTICS_TEST_POSTGRES_ADMIN" \
  -p 127.0.0.1:5432:5432 postgres:17 >/dev/null

docker run -d --rm --name analytics-mysql-fixture \
  -e "MYSQL_ROOT_PASSWORD=$ANALYTICS_TEST_MYSQL_ADMIN" -e MYSQL_ROOT_HOST='%' \
  -p 127.0.0.1:3306:3306 mysql:8.4 >/dev/null

if [[ -n "${GITHUB_ENV:-}" ]]; then
  for key in ANALYTICS_TEST_SQLSERVER_ADMIN ANALYTICS_TEST_POSTGRES_ADMIN \
             ANALYTICS_TEST_SQLSERVER_READER ANALYTICS_TEST_POSTGRES_READER \
             ANALYTICS_TEST_MYSQL_ADMIN ANALYTICS_TEST_MYSQL_READER; do
    printf '::add-mask::%s\n' "${!key}"
    printf '%s=%s\n' "$key" "${!key}" >> "$GITHUB_ENV"
  done
fi

echo 'Disposable SQL Server, PostgreSQL and MySQL fixtures started; run the provider verification script.'
