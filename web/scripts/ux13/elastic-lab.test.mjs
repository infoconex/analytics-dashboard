import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { api, basicHeader, requireLabVersion, verifyViewer } from './elastic-lab.mjs';
import { readFile } from 'node:fs/promises';
import { fixtureDirectory, commerceIndex, channelIndex } from './lab-fixtures.mjs';
import { dashboardId, createComparisonDashboard } from './kibana-dashboard.mjs';

const sampleRows = {
  [commerceIndex]: JSON.parse(await readFile(`${fixtureDirectory}/commerce.json`, 'utf8')),
  [channelIndex]: JSON.parse(await readFile(`${fixtureDirectory}/channels.json`, 'utf8')),
};

function fictionalResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function simulatedLab(unauthorizedStatus = 403, exposeIsolatedView = false, deniedSpaceStatus = 404) {
  return async (url, options) => {
    const target = new URL(url);
    if (target.port === '19200' && target.pathname === '/')
      return fictionalResponse({ cluster_name: 'ux13-evaluation-lab', version: { number: '9.5.6' } });
    if (target.port === '15601' && target.pathname === '/api/status')
      return fictionalResponse({ version: { number: '9.5.6' } });
    for (const [index, rows] of Object.entries(sampleRows)) {
      if (target.pathname === `/${index}/_count`) return fictionalResponse({ count: rows.length });
      if (target.pathname === `/${index}/_mget`) {
        const { ids } = JSON.parse(options.body);
        return fictionalResponse({ docs: ids.map((id, i) => ({ _id: id, _source: rows[i] })) });
      }
    }
    if (target.pathname === '/ux13-isolated-sentinel/_search')
      return fictionalResponse({ error: 'forbidden' }, unauthorizedStatus);
    if (target.pathname === '/s/ux13-isolated/api/data_views')
      return fictionalResponse({ data_view: exposeIsolatedView ? [{ id: 'ux13-isolated-only-view' }] : [] });
    if (target.pathname === '/s/ux13-isolated/api/data_views/data_view/ux13-isolated-only-view' && options.headers.authorization === basicHeader('elastic', 'fictional-admin'))
      return fictionalResponse({ data_view: { id: 'ux13-isolated-only-view' } });
    if (target.pathname === '/s/ux13-isolated/api/data_views/data_view/ux13-isolated-only-view')
      return fictionalResponse(exposeIsolatedView ? { data_view: { id: 'ux13-isolated-only-view' } } : { error: 'not found' },
        exposeIsolatedView ? 200 : deniedSpaceStatus);
    if (target.pathname === '/api/data_views')
      return fictionalResponse({ data_view: [{ id: 'ux13-commerce' }, { id: 'ux13-channels' }] });
    if (target.pathname === `/api/dashboards/${dashboardId}`)
      return fictionalResponse({ data: createComparisonDashboard() });
    throw new Error(`Unanticipated test request: ${target.pathname}`);
  };
}

describe('UX-13 lab admission boundaries', () => {
  it('refuses non-loopback or alternate lab destinations before a network request', async () => {
    await assert.rejects(api('https://example.com', '/', 'user', 'password'), /fixed loopback/);
    await assert.rejects(api('http://127.0.0.1:9200', '/', 'user', 'password'), /fixed loopback/);
    await assert.rejects(api('http://127.0.0.1:19200', '//elsewhere', 'user', 'password'), /fixed loopback/);
  });

  it('requires nonempty throwaway credentials', () => {
    assert.throws(() => basicHeader('elastic', ''), /Missing disposable credential/);
    assert.match(basicHeader('viewer', 'fictional-secret'), /^Basic /);
  });

  it('does not accept a different version or an unrelated cluster', async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response(JSON.stringify({ version: { number: '9.5.5' },
        cluster_name: 'ux13-evaluation-lab' }), { status: 200 });
      await assert.rejects(requireLabVersion('http://127.0.0.1:19200', 'elastic', 'secret'), /different Elastic version/);
      globalThis.fetch = async () => new Response(JSON.stringify({ version: { number: '9.5.6' },
        cluster_name: 'production-like' }), { status: 200 });
      await assert.rejects(requireLabVersion('http://127.0.0.1:19200', 'elastic', 'secret'), /Unexpected cluster/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('verifies every imported row, direct saved-object denial and empty-list behavior', async () => {
    const previous = globalThis.fetch;
    const oldAdmin = process.env.UX13_ELASTIC_PASSWORD;
    const oldViewer = process.env.UX13_VIEWER_PASSWORD;
    try {
      process.env.UX13_ELASTIC_PASSWORD = 'fictional-admin';
      process.env.UX13_VIEWER_PASSWORD = 'fictional-viewer';
      globalThis.fetch = simulatedLab();
      await verifyViewer({ report: false });
      globalThis.fetch = simulatedLab(403, false, 400);
      const observed = await verifyViewer({ report: false });
      assert.equal(observed.isolatedSavedViewStatus, 400, 'Kibana may reject unknown Spaces with HTTP 400');
      globalThis.fetch = simulatedLab(200);
      await assert.rejects(verifyViewer({ report: false }), /Unexpected isolated index disclosure/);
      globalThis.fetch = simulatedLab(403, true);
      await assert.rejects(verifyViewer({ report: false }), /Unexpected isolated saved-object disclosure/);
    } finally {
      globalThis.fetch = previous;
      if (oldAdmin === undefined) delete process.env.UX13_ELASTIC_PASSWORD;
      else process.env.UX13_ELASTIC_PASSWORD = oldAdmin;
      if (oldViewer === undefined) delete process.env.UX13_VIEWER_PASSWORD;
      else process.env.UX13_VIEWER_PASSWORD = oldViewer;
    }
  });
});
