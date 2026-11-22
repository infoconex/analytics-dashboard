// Credential-free, single-purpose TCP forwarding for a disposable local lab.
// Only the proxy joins the operator-facing bridge. No application service does.
import { createConnection, createServer } from 'node:net';

export const targets = Object.freeze([
  Object.freeze({ listenPort: 19200, destination: 'elasticsearch', destinationPort: 9200 }),
  Object.freeze({ listenPort: 15601, destination: 'kibana', destinationPort: 5601 }),
]);

export function createForwarder(target, net = { createConnection, createServer }) {
  return net.createServer(client => {
    const upstream = net.createConnection(target.destinationPort, target.destination);
    client.pipe(upstream);
    upstream.pipe(client);
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
  });
}

if (process.argv[1]?.endsWith('/loopback-proxy.mjs')) {
  for (const target of targets) {
    createForwarder(target).listen(target.listenPort, '0.0.0.0');
  }
}
