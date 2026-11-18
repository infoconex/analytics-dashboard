import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyConsoleError, summarizeBrowserErrors } from './browser-observations.mjs';

test('console diagnostics preserve broad cause without copying untrusted text', () => {
  assert.equal(classifyConsoleError('Failed to load resource: net::ERR_FAILED https://example/?token=private'), 'network-or-resource');
  assert.equal(classifyConsoleError('Content Security Policy: blocked'), 'browser-policy');
  assert.equal(classifyConsoleError('Unexpected HTTP 404'), 'http-status');
  assert.equal(classifyConsoleError('Uncaught TypeError: cannot read property'), 'other-console-error');
  assert.deepEqual(summarizeBrowserErrors([
    { product: 'kibana', mode: 'mobile', category: 'browser-console-error', kind: 'network-or-resource', private: 'never-copy' },
    { product: 'kibana', mode: 'mobile', category: 'browser-console-error', kind: 'network-or-resource' },
  ]), [{ product: 'kibana', mode: 'mobile', category: 'browser-console-error', kind: 'network-or-resource', count: 2 }]);
});
