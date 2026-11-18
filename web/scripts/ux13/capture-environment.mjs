import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import os from 'node:os';
import { checkFixtures, fixtureDirectory } from './lab-fixtures.mjs';
import { api } from './elastic-lab.mjs';
import { dashboardId, createComparisonDashboard, dashboardDigest } from './kibana-dashboard.mjs';
import { inspectIsolation } from './network-topology.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const capture = (bin, args) => execFileSync(bin, args, { encoding: 'utf8' }).trim();
const manifest = await checkFixtures();
const images = {};
for (const [name, digest] of [
  ['elasticsearch/elasticsearch', '79b4f1de4c15e6eca824723086a51e5934406d614d410cc11be77748cafac537'],
  ['kibana/kibana', 'c7ed45da5c3cfea020fc6c99ce027f4d21d19dab330379c5115d5eb95f6ecebc'],
  ['node-proxy', '6868d4695b947ee120bffaa463fecd68cde370d7bfec92955e7c8ac576b4f475'],
]) {
  const reference = name === 'node-proxy'
    ? `node:22.23.5-alpine3.23@sha256:${digest}`
    : `docker.elastic.co/${name}:9.5.6@sha256:${digest}`;
  const inspected = JSON.parse(capture('docker', ['image', 'inspect', reference]));
  const image = inspected[0];
  if (!image?.RepoDigests?.length) throw new Error(`Missing immutable digest for ${reference}`);
  images[name] = { reference, platform: `${image.Os}/${image.Architecture}`,
    imageId: image.Id, repositoryDigests: image.RepoDigests };
}
const data = {
  artifactKind: 'SCRIPTED_FICTIONAL_LAB_ONLY',
  sourceSha256: manifest.sourceSha256,
  expectedDashboardDefinitionSha256: dashboardDigest(createComparisonDashboard()),
  elasticStackVersion: '9.5.6',
  gitHead: capture('git', ['-C', root, 'rev-parse', 'HEAD']),
  os: { platform: os.platform(), release: os.release(), architecture: os.arch() },
  node: process.version,
  docker: capture('docker', ['--version']),
  compose: capture('docker', ['compose', 'version', '--short']),
  images,
  networkIsolation: inspectIsolation(),
  fixedLoopbackPorts: [19200, 15601],
  researchConsentGate: 'UNAPPROVED',
  parityGate: 'NOT VERIFIED BY IMAGE OR FIXTURE VALIDATION',
};
const evidenceDirectory = join(dirname(fixtureDirectory), 'evidence');
await mkdir(evidenceDirectory, { recursive: true });
const actualDashboard = await api('http://127.0.0.1:15601', `/api/dashboards/${dashboardId}`,
  'ux13-northstar-viewer', process.env.UX13_VIEWER_PASSWORD);
data.actualDashboardResponseSha256 = dashboardDigest(actualDashboard);
await writeFile(join(evidenceDirectory, 'kibana-dashboard-response.json'), `${JSON.stringify(actualDashboard, null, 2)}\n`);
const permissions = await api('http://127.0.0.1:15601', '/api/security/role/ux13-northstar-reader',
  'elastic', process.env.UX13_ELASTIC_PASSWORD);
data.actualPermissionSnapshotSha256 = dashboardDigest(permissions);
await writeFile(join(evidenceDirectory, 'kibana-permissions.json'), `${JSON.stringify(permissions, null, 2)}\n`);
await writeFile(join(evidenceDirectory, 'environment.json'), `${JSON.stringify(data, null, 2)}\n`);
process.stdout.write(`UX-13 immutable image manifests captured for ${data.os.platform}/${data.os.architecture}; no secrets recorded.\n`);
