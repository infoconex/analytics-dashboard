import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileFilter, getInventory, makePlan, verifyRun } from './ci-browser-shards.mjs';

const spec = (file, id, status = 'passed') => ({
  file, id, tests: [{ projectId: '', results: [{ status }] }],
});
const report = (...specs) => ({ suites: [{ suites: [{ specs }] }] });
const weights = { 'a.spec.ts': [9000, 1], 'b.spec.ts': [5000, 1],
  'old.spec.ts': [3000, 1] };

test('discovers nested suites, balances by duration and handles new and renamed files', () => {
  const files = getInventory(report(spec('a.spec.ts', 'a'), spec('b.spec.ts', 'b'),
    spec('nested/new.spec.ts', 'c'), spec('renamed.spec.ts', 'd')));
  const plan = makePlan(files, weights, 2);
  assert.deepEqual(plan.flatMap(s => s.files.map(f => f.file)).sort(), [...files.keys()].sort());
  assert.equal(plan.reduce((sum, s) => sum + s.testCount, 0), 4);
  assert.equal(plan.flatMap(s => s.files).filter(f => !f.historical).length, 2);
  assert.deepEqual(makePlan(new Map([...files].reverse()), weights, 2), plan);
  assert(!plan.flatMap(s => s.files).some(f => f.file === 'old.spec.ts'));
});

test('uses test counts to scale historical weight and never splits a file', () => {
  const files = getInventory(report(spec('a.spec.ts', 'a1'), spec('a.spec.ts', 'a2'),
    spec('b.spec.ts', 'b')));
  const plan = makePlan(files, weights, 2);
  assert.equal(plan[0].estimatedMs, 18000);
  assert.equal(plan[0].testCount, 2);
  assert.equal(plan[1].testCount, 1);
});

test('rejects duplicate discovery IDs, empty inventory and invalid shard totals', () => {
  assert.throws(() => getInventory(report(spec('a.spec.ts', 'a'), spec('b.spec.ts', 'a'))));
  assert.throws(() => getInventory(report()));
  assert.throws(() => makePlan(getInventory(report(spec('a.spec.ts', 'a'))), weights, 2));
});

test('verifies exact selected IDs, rejects missing, extra, skipped or repeated execution', () => {
  const good = report(spec('a.spec.ts', 'a'));
  const expected = [JSON.stringify(['a', ''])];
  verifyRun(good, expected);
  assert.throws(() => verifyRun(good, [...expected, 'missing']));
  assert.throws(() => verifyRun(report(spec('a.spec.ts', 'a'), spec('b.spec.ts', 'b')), expected));
  assert.throws(() => verifyRun(report(spec('a.spec.ts', 'a', 'skipped')), expected));
  const repeated = spec('a.spec.ts', 'a');
  repeated.tests[0].results.push({ status: 'passed' });
  assert.throws(() => verifyRun(report(repeated), expected));
});

test('literal anchored filters distinguish similarly named and nested files', () => {
  const filter = new RegExp(fileFilter('/checkout/e2e', 'a[1].spec.ts'));
  assert(filter.test('/checkout/e2e/a[1].spec.ts'));
  assert(!filter.test('/checkout/e2e/nested/a[1].spec.ts'));
  assert(!filter.test('/checkout/e2e/a1.spec.ts'));
  assert(!filter.test('/checkout/e2e/a[1].spec.ts.extra'));
});
