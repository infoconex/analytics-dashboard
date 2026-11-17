import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { api, basicHeader, requireLabVersion } from './elastic-lab.mjs';

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
});
