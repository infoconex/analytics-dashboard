// Explicitly assessed UX-12 goals. A script-driven navigation pass is not
// independent human discovery, and it cannot qualify an entire study (R1/R2).
export const tasks = Object.freeze([
  { id: 'T01', goal: 'Arrival, synthetic provenance and access', gate: 'Context and effective permissions must be visible independently' },
  { id: 'T02', goal: 'Discover the saved fictional revenue view', gate: 'Both read-only viewers navigate from an unfiltered dashboard catalog to the revenue chart', candidate: true },
  { id: 'T03', goal: 'Understand metric limits and yearless sample', gate: 'Both UIs expose USD, provenance and unsupported-conclusion caveats' },
  { id: 'T04', goal: 'Inspect the October $41,400 source row', gate: 'Both UIs expose the exact original record through navigable UI' },
  { id: 'T05', goal: 'Independently scope Oct–Dec and Direct', gate: 'Commerce and channel filters retain independent scopes and original rows' },
  { id: 'T06', goal: 'Remove commerce filter but retain Direct', gate: 'T05 fully verified, selective removal tested in each UI' },
  { id: 'T07', goal: 'Reset both sets without saved-state changes', gate: 'T06 verified, reset and persistence independently demonstrated' },
  { id: 'T08', goal: 'Find final of 12 charts and return to index', gate: 'Comparable index and focused return in each UI' },
  { id: 'T09', goal: 'Share saved dashboard and revisit safely', gate: 'Equivalent read-only links, URL state and reset semantics' },
  { id: 'T10A', goal: 'Recover from missing saved resource', gate: 'No equivalent controlled fixture; out of paired scope', excluded: true },
  { id: 'T10B', goal: 'Recover from unavailable list', gate: 'No equivalent controlled failure; out of paired scope', excluded: true },
  { id: 'T11', goal: 'Reject unauthorized destination', gate: 'Separate security audit; Kibana Space is not an Analytics tenant', excluded: true },
  { id: 'T12', goal: 'Switch server-authorized organizations', gate: 'No equivalent account/tenant isolation model', excluded: true },
  { id: 'T13', goal: 'Use same-origin read-only customer host', gate: 'Analytics-only sample embedding contract', excluded: true },
]);

export function decidePair(task, evidence) {
  if (task.excluded) return 'excluded';
  if (!task.candidate) return 'unapproved';
  const { analytics, kibana } = evidence;
  if (!analytics?.completed || !kibana?.completed ||
    !analytics.fixtureSha || analytics.fixtureSha !== kibana.fixtureSha) return 'unapproved';
  for (const product of [analytics, kibana]) {
    if (product.initial !== 'dashboard-catalog' || product.endpoint !== 'revenue-view' || product.role !== 'read-only')
      return 'unapproved';
  }
  return 'conditional-scripted-pair';
}

export function assertEvidenceSafe(value) {
  function inspect(item) {
    if (Array.isArray(item)) return item.forEach(inspect);
    if (item === null || typeof item !== 'object') return;
    for (const [key, val] of Object.entries(item)) {
      if (/password|authorization|cookie|secret|token|participant(name|email|id)|recording/i.test(key))
        throw new Error(`Unsafe evidence field: ${key}`);
      inspect(val);
    }
  }
  inspect(value);
}
