#!/usr/bin/env bash
# No customer data, network or credentials. Real Elasticsearch conformance is
# isolated in the existing required provider CI job, after relational cleanup.
set -euo pipefail
cd "$(dirname "$0")/../.."

cleanup() {
  docker rm -f analytics-elasticsearch-fixture >/dev/null 2>&1 || true
}
trap cleanup EXIT

command -v docker >/dev/null || { echo 'Docker is required for Elasticsearch conformance' >&2; exit 1; }
# Docker prior to 28.0 may expose loopback-published ports to layer-2 neighbors.
version="$(docker version --format '{{.Server.Version}}')"
major="${version%%.*}"
if [[ ! "$major" =~ ^[0-9]+$ ]] || (( major < 28 )); then
  echo 'Docker Engine 28+ is required for isolated localhost publishing' >&2
  exit 1
fi

docker run -d --rm --name analytics-elasticsearch-fixture \
  -e 'discovery.type=single-node' \
  -e 'xpack.security.enabled=false' \
  -e 'ES_JAVA_OPTS=-Xms512m -Xmx512m' \
  -p 127.0.0.1:19200:9200 \
  docker.elastic.co/elasticsearch/elasticsearch:9.5.6@sha256:79b4f1de4c15e6eca824723086a51e5934406d614d410cc11be77748cafac537 >/dev/null

dotnet test tests/AnalyticsDashboard.Tests/AnalyticsDashboard.Tests.csproj --nologo \
  --filter 'TestCategory=ElasticsearchIntegration'
