import assert from 'node:assert/strict';
import test from 'node:test';
import { createForwarder, targets } from '../../../lab/ux13/loopback-proxy.mjs';

test('the disposable proxy has only two fixed targets inside the isolated bridge', () => {
  assert.deepEqual(targets, [
    { listenPort: 19200, destination: 'elasticsearch', destinationPort: 9200 },
    { listenPort: 15601, destination: 'kibana', destinationPort: 5601 },
  ]);
  assert.ok(targets.every(target => !Object.hasOwn(target, 'credential')));
});

test('a forwarded socket closes both directions and does not inspect or store data', () => {
  const handlers = {};
  const calls = [];
  const client = { pipe: peer => calls.push(['client-pipe', peer]),
    on: (name, fn) => { handlers[`client:${name}`] = fn; }, destroy: () => calls.push(['client-destroy']) };
  const upstream = { pipe: peer => calls.push(['upstream-pipe', peer]),
    on: (name, fn) => { handlers[`upstream:${name}`] = fn; }, destroy: () => calls.push(['upstream-destroy']) };
  const stub = { createServer: callback => { callback(client); return 'server'; },
    createConnection: (port, host) => { calls.push(['connect', port, host]); return upstream; } };
  assert.equal(createForwarder(targets[0], stub), 'server');
  assert.deepEqual(calls.slice(0, 3), [
    ['connect', 9200, 'elasticsearch'], ['client-pipe', upstream], ['upstream-pipe', client],
  ]);
  handlers['client:close']();
  handlers['upstream:error']();
  assert.deepEqual(calls.slice(3), [['upstream-destroy'], ['client-destroy']]);
});
