// Never persist raw console messages: browser errors can contain dynamic URLs,
// search terms, tokens or credentials in other environments. Preserve counts
// and broad diagnostic classes only, then inspect locally in a secure session.
export function classifyConsoleError(message) {
  if (/net::ERR_|Failed to load resource|Failed to fetch|WebSocket connection/i.test(message))
    return 'network-or-resource';
  if (/Content Security Policy|blocked by client|Refused to connect/i.test(message))
    return 'browser-policy';
  if (/\b401\b|\b403\b|\b404\b|\b503\b/i.test(message))
    return 'http-status';
  return 'other-console-error';
}

export function summarizeBrowserErrors(events) {
  const grouped = new Map();
  for (const { product, mode, category, kind = 'runtime-error' } of events) {
    const key = JSON.stringify([product, mode, category, kind]);
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  return [...grouped].map(([key, count]) => {
    const [product, mode, category, kind] = JSON.parse(key);
    return { product, mode, category, kind, count };
  });
}
