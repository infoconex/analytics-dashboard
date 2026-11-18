import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkFixtures, fixtureDirectory, commerceIndex, channelIndex } from './lab-fixtures.mjs';
import { dashboardId, createComparisonDashboard, validateComparisonDashboard } from './kibana-dashboard.mjs';

const elastic = 'http://127.0.0.1:19200';
const kibana = 'http://127.0.0.1:15601';
const isolatedIndex = 'ux13-isolated-sentinel';
const isolatedView = 'ux13-isolated-only-view';
const user = 'ux13-northstar-viewer';
const role = 'ux13-northstar-reader';

export function basicHeader(username, password) {
  if (!password) throw new Error(`Missing disposable credential for ${username}`);
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export async function api(origin, path, username, password, { method = 'GET', body, allowStatus = [] } = {}) {
  if (![elastic, kibana].includes(origin) || !path.startsWith('/') || path.startsWith('//'))
    throw new Error('UX-13 requests can only target the two fixed loopback lab ports');
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {
      authorization: basicHeader(username, password),
      'content-type': body?.startsWith?.('{"index"') ? 'application/x-ndjson' : 'application/json',
      'kbn-xsrf': 'ux13-fixtures',
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (allowStatus.includes(response.status)) return { status: response.status };
  const text = await response.text();
  if (!response.ok) throw new Error(`Lab ${origin === elastic ? 'Elasticsearch' : 'Kibana'} ${path}: HTTP ${response.status}; response omitted to avoid leaking credentials`);
  return text ? JSON.parse(text) : {};
}

function credentials() {
  return { admin: process.env.UX13_ELASTIC_PASSWORD, system: process.env.UX13_KIBANA_SYSTEM_PASSWORD,
    viewer: process.env.UX13_VIEWER_PASSWORD };
}

const esMappings = {
  [commerceIndex]: { properties: { month: { type: 'keyword' }, monthOrdinal: { type: 'integer' },
    revenue: { type: 'integer' }, orders: { type: 'integer' }, customers: { type: 'integer' } } },
  [channelIndex]: { properties: { channel: { type: 'keyword' }, orders: { type: 'integer' },
    sessions: { type: 'integer' }, conversion: { type: 'float' } } },
  [isolatedIndex]: { properties: { tenantLabel: { type: 'keyword' }, marker: { type: 'keyword' } } },
};

export async function requireLabVersion(origin, username, password) {
  const result = await api(origin, origin === elastic ? '/' : '/api/status', username, password);
  const actual = origin === elastic ? result.version?.number : result.version?.number;
  assert.equal(actual, '9.5.6', 'Do not compare a different Elastic version');
  if (origin === elastic) assert.equal(result.cluster_name, 'ux13-evaluation-lab', 'Unexpected cluster: refusing writes');
  return actual;
}

export async function waitForLab(origin, username, password) {
  let last;
  for (let i = 0; i < 90; i++) {
    try { return await requireLabVersion(origin, username, password); }
    catch (error) { last = error; await new Promise(resolve => setTimeout(resolve, 2000)); }
  }
  throw new Error(`Lab did not become ready: ${last?.message}`);
}

async function indexOnce(name, properties, password) {
  const existing = await api(elastic, `/${name}`, 'elastic', password, { allowStatus: [404] });
  if (existing.status === 404) {
    await api(elastic, `/${name}`, 'elastic', password, { method: 'PUT',
      body: { settings: { number_of_shards: 1, number_of_replicas: 0 }, mappings: { dynamic: 'strict', ...properties } } });
  } else {
    assert.deepEqual(existing[name]?.mappings?.properties, properties.properties, `Unexpected existing mapping for ${name}`);
  }
}

export async function seedElasticsearch() {
  await checkFixtures();
  const { admin, system } = credentials();
  await waitForLab(elastic, 'elastic', admin);
  // The built-in Kibana service account receives its own throwaway password.
  await api(elastic, '/_security/user/kibana_system/_password', 'elastic', admin,
    { method: 'POST', body: { password: system } });
  for (const [name, mapping] of Object.entries(esMappings)) await indexOnce(name, mapping, admin);
  const bulk = await readFile(`${fixtureDirectory}/elasticsearch-bulk.ndjson`, 'utf8');
  const imported = await api(elastic, '/_bulk?refresh=true', 'elastic', admin, { method: 'POST', body: bulk });
  assert.equal(imported.errors, false, 'Elasticsearch bulk import rejected some fictional records');
  await api(elastic, `/${isolatedIndex}/_doc/sentinel?refresh=true`, 'elastic', admin, { method: 'PUT',
    body: { tenantLabel: 'Isolated Tenant', marker: 'fictional-no-share' } });
  await verifyElasticsearch('elastic', admin);
}

async function verifyElasticsearch(username, password) {
  const expected = [
    [commerceIndex, JSON.parse(await readFile(`${fixtureDirectory}/commerce.json`, 'utf8')), 'month'],
    [channelIndex, JSON.parse(await readFile(`${fixtureDirectory}/channels.json`, 'utf8')), 'channel'],
  ];
  for (const [index, rows, dimension] of expected) {
    const count = await api(elastic, `/${index}/_count`, username, password);
    assert.equal(count.count, rows.length, `${index} must contain precisely ${rows.length} fictional records`);
    const results = await api(elastic, `/${index}/_mget`, username, password, { method: 'POST',
      body: { ids: rows.map((_, i) => `${dimension === 'month' ? 'month' : 'channel'}-${i + 1}`) } });
    assert.deepEqual(results.docs.map(item => item._source), rows, `${index} rows differ from the source fixture`);
  }
}

export async function seedKibana() {
  const { admin, viewer } = credentials();
  await waitForLab(kibana, 'elastic', admin);
  const createSpace = await api(kibana, '/api/spaces/space', 'elastic', admin, { method: 'POST',
    body: { id: 'ux13-isolated', name: 'Isolated Tenant (fictional)' }, allowStatus: [409] });
  if (createSpace.status === 409) throw new Error('Kibana isolated space already exists; reset the disposable lab');
  const sentinelView = await api(kibana, '/s/ux13-isolated/api/data_views/data_view', 'elastic', admin,
    { method: 'POST', body: { data_view: { id: isolatedView,
      name: 'Fictional isolated space only — do not share', title: isolatedIndex } } });
  assert.equal(sentinelView.data_view?.id, isolatedView);
  for (const [index, id, label] of [
    [commerceIndex, 'ux13-commerce', 'Northstar Commerce — undated monthly sample'],
    [channelIndex, 'ux13-channels', 'Northstar Commerce — undated channel sample'],
  ]) {
    const response = await api(kibana, '/api/data_views/data_view', 'elastic', admin, { method: 'POST',
      body: { data_view: { id, name: label, title: index } } });
    assert.equal(response.data_view?.id, id);
    assert.equal(response.data_view?.timeFieldName == null, true, 'Do not manufacture timestamps');
  }
  const comparison = createComparisonDashboard();
  validateComparisonDashboard(comparison);
  const created = await api(kibana, `/api/dashboards/${dashboardId}`, 'elastic', admin,
    { method: 'PUT', body: comparison });
  assert.equal(created.data?.panels?.length ?? created.panels?.length, 12, 'Kibana rejected the matched 12-panel dashboard');
  await api(kibana, `/api/security/role/${role}`, 'elastic', admin, { method: 'PUT', body: {
    description: 'Disposable UX-13 Northstar read-only observer, default space only',
    elasticsearch: { cluster: [], indices: [
      { names: [commerceIndex, channelIndex], privileges: ['read', 'view_index_metadata'] },
    ] },
    kibana: [{ base: ['read'], feature: {}, spaces: ['default'] }],
  } });
  await api(elastic, `/_security/user/${user}`, 'elastic', admin, { method: 'PUT',
    body: { password: viewer, roles: [role], full_name: 'UX13 Fictional Northstar Viewer' } });
  await verifyViewer();
}

export async function verifyViewer({ report = true } = {}) {
  await checkFixtures();
  const { admin, viewer } = credentials();
  await requireLabVersion(elastic, 'elastic', admin);
  await requireLabVersion(kibana, 'elastic', admin);
  await verifyElasticsearch(user, viewer);
  const exactIsolatedPath = `/s/ux13-isolated/api/data_views/data_view/${isolatedView}`;
  // Positive control: a mistaken URL must not masquerade as isolation.
  const adminSentinel = await api(kibana, exactIsolatedPath, 'elastic', admin);
  assert.equal(adminSentinel.data_view?.id, isolatedView, 'Isolated Space control object not retrievable');
  const deniedIndex = await api(elastic, `/${isolatedIndex}/_search`, user, viewer,
    { allowStatus: [403, 404] });
  assert.equal([403, 404].includes(deniedIndex.status), true, 'Unexpected isolated index disclosure');
  // Some Kibana read endpoints return HTTP 200 with an empty list for a space
  // the caller cannot access. A bare 200 is not proof of cross-space exposure.
  // Test the actual sentinel saved object and then ensure any list omits it.
  const deniedSpace = await api(kibana, exactIsolatedPath, user, viewer,
    { allowStatus: [400, 403, 404] });
  assert.equal([400, 403, 404].includes(deniedSpace.status), true, 'Unexpected isolated saved-object disclosure');
  const spaceListing = await api(kibana, '/s/ux13-isolated/api/data_views', user, viewer,
    { allowStatus: [403, 404] });
  assert.equal(JSON.stringify(spaceListing).includes(isolatedView), false, 'Unexpected isolated space listing disclosure');
  const accessible = await api(kibana, '/api/data_views', user, viewer);
  const values = JSON.stringify(accessible);
  assert.ok(values.includes('ux13-commerce') && values.includes('ux13-channels'), 'Default space data views absent');
  const dashboard = await api(kibana, `/api/dashboards/${dashboardId}`, user, viewer);
  const panels = dashboard.data?.panels ?? dashboard.panels;
  assert.equal(panels?.length, 12, 'The read-only viewer cannot retrieve the intended 12 charts');
  const probe = { isolatedIndexStatus: deniedIndex.status, isolatedSavedViewStatus: deniedSpace.status,
    spaceListingStatus: spaceListing.status ?? 200, isolatedViewPresent: false };
  if (report) process.stdout.write(`PASS: 9.5.6 exact 12+5 records, two undated Northstar views, twelve saved panels, isolated index/view denied (${deniedIndex.status}/${deniedSpace.status}); Space listing status ${probe.spaceListingStatus}, no isolated object. NOT task parity or tenant-model equivalence.\n`);
  return probe;
}

if (process.argv[1] && process.argv[1].endsWith('/elastic-lab.mjs')) {
  const command = process.argv[2];
  if (command === 'seed-elasticsearch') await seedElasticsearch();
  else if (command === 'seed-kibana') await seedKibana();
  else if (command === 'verify') await verifyViewer();
  else throw new Error('Usage: node elastic-lab.mjs [seed-elasticsearch|seed-kibana|verify]');
}
