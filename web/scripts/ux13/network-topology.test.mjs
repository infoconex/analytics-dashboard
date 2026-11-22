import assert from 'node:assert/strict';
import test from 'node:test';
import { assertIsolation } from './network-topology.mjs';

const fictional = 'ux13lab_fictional';
const operator = 'ux13lab_operator';
function topology() {
  const core = { NetworkSettings: { Networks: { [fictional]: {} } }, HostConfig: { PortBindings: {} } };
  return {
    elasticsearch: structuredClone(core), kibana: structuredClone(core),
    proxy: { NetworkSettings: { Networks: { [fictional]: {}, [operator]: {} } },
      HostConfig: { ReadonlyRootfs: true, CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges:true'],
        PortBindings: { '19200/tcp': [{ HostIp: '127.0.0.1', HostPort: '19200' }],
          '15601/tcp': [{ HostIp: '127.0.0.1', HostPort: '15601' }] } }, Config: { Env: ['NODE_VERSION=22.23.5'] } },
    fictionalNetwork: { Internal: true }, operatorNetwork: { Internal: false },
    routes: { elasticsearch: ['eth0\t00000001\t00000000'], kibana: ['eth0\t00000001\t00000000'] },
  };
}

test('admits only core services on the internal bridge and loopback-only credential-free proxy', () => {
  assert.equal(assertIsolation(topology()).proxyLoopbackOnly, true);
});

test('fails closed if an app can egress, receives a direct published port or proxy gains a secret', () => {
  const gateway = topology(); gateway.routes.elasticsearch.push('eth0\t00000000\t00000000');
  assert.throws(() => assertIsolation(gateway), /default route/);
  const port = topology(); port.kibana.HostConfig.PortBindings['5601/tcp'] = [{ HostIp: '0.0.0.0', HostPort: '5601' }];
  assert.throws(() => assertIsolation(port), /publish no ports/);
  const network = topology(); network.elasticsearch.NetworkSettings.Networks[operator] = {};
  assert.throws(() => assertIsolation(network), /non-internal network/);
  const password = topology(); password.proxy.Config.Env.push('UX13_ELASTIC_PASSWORD=not-a-real-secret');
  assert.throws(() => assertIsolation(password), /credentials/);
  const publicPort = topology(); publicPort.proxy.HostConfig.PortBindings['19200/tcp'][0].HostIp = '0.0.0.0';
  assert.throws(() => assertIsolation(publicPort));
});
