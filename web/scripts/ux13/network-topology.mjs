import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const project = 'ux13lab';
const internal = `${project}_fictional`;
const operator = `${project}_operator`;

export function assertIsolation({ elasticsearch, kibana, proxy, fictionalNetwork, operatorNetwork, routes }) {
  assert.equal(fictionalNetwork.Internal, true, 'The data bridge must block default egress');
  assert.equal(operatorNetwork.Internal, false, 'Only the credential-free proxy may use the host-facing bridge');
  for (const [name, info] of [['elasticsearch', elasticsearch], ['kibana', kibana]]) {
    assert.deepEqual(Object.keys(info.NetworkSettings.Networks), [internal], `${name} joined a non-internal network`);
    assert.equal(Object.keys(info.HostConfig.PortBindings ?? {}).length, 0, `${name} must publish no ports`);
    assert.equal(routes[name].some(line => line.split(/\s+/)[1] === '00000000'), false,
      `${name} has an unexpected default route`);
  }
  assert.deepEqual(Object.keys(proxy.NetworkSettings.Networks).sort(), [internal, operator].sort());
  assert.equal(proxy.HostConfig.ReadonlyRootfs, true, 'The proxy filesystem must be read-only');
  assert.deepEqual(proxy.HostConfig.CapDrop, ['ALL'], 'The proxy must drop Linux capabilities');
  assert.equal(proxy.HostConfig.SecurityOpt?.includes('no-new-privileges:true'), true);
  assert.equal(proxy.Config.Env.some(value => /^(UX13_|ELASTIC_PASSWORD|KIBANA_PASSWORD)/.test(value)), false,
    'The proxy must not receive laboratory credentials');
  const bindings = proxy.HostConfig.PortBindings;
  assert.deepEqual(Object.keys(bindings).sort(), ['15601/tcp', '19200/tcp']);
  assert.deepEqual(bindings['19200/tcp'], [{ HostIp: '127.0.0.1', HostPort: '19200' }]);
  assert.deepEqual(bindings['15601/tcp'], [{ HostIp: '127.0.0.1', HostPort: '15601' }]);
  return { internalNetwork: true, noCorePublishedPorts: true, noCoreDefaultRoute: true,
    proxyLoopbackOnly: true, proxyCredentialsAbsent: true };
}

const docker = args => execFileSync('docker', args, { encoding: 'utf8' }).trim();

export function inspectIsolation() {
  const inspect = name => JSON.parse(docker(['inspect', `${project}-${name}-1`]))[0];
  const routes = Object.fromEntries(['elasticsearch', 'kibana'].map(name => [name,
    docker(['exec', `${project}-${name}-1`, 'cat', '/proc/net/route']).split('\n').slice(1)]));
  return assertIsolation({
    elasticsearch: inspect('elasticsearch'), kibana: inspect('kibana'), proxy: inspect('loopback-proxy'),
    fictionalNetwork: JSON.parse(docker(['network', 'inspect', internal]))[0],
    operatorNetwork: JSON.parse(docker(['network', 'inspect', operator]))[0], routes,
  });
}

if (process.argv[1]?.endsWith('/network-topology.mjs')) {
  process.stdout.write(`PASS: isolated Elastic data network and loopback-only uncredentialed proxy ${JSON.stringify(inspectIsolation())}\n`);
}
