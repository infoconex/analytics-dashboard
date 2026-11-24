// Hosted CI only. Discover the actual Playwright suite before assigning whole
// files; historical durations are hints, never an allowlist of runnable tests.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function getInventory(report) {
  const files = new Map();
  const ids = new Set();
  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      const file = spec.file;
      assert(typeof file === 'string' && file && !isAbsolute(file) &&
        !file.split(/[\\/]/).includes('..'), 'Invalid discovered test path');
      assert(typeof spec.id === 'string' && spec.id, 'Missing spec ID');
      for (const test of spec.tests ?? []) {
        assert.equal(typeof test.projectId, 'string', 'Missing project ID');
        const id = JSON.stringify([spec.id, test.projectId]);
        assert(!ids.has(id), 'Duplicate discovered test: ' + id);
        ids.add(id);
        if (!files.has(file)) files.set(file, []);
        files.get(file).push({ id, results: test.results ?? [] });
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  }
  for (const suite of report.suites ?? []) visit(suite);
  assert(ids.size > 0, 'No tests discovered');
  return files;
}

export function makePlan(files, weights, shardTotal) {
  assert(Number.isInteger(shardTotal) && shardTotal > 0 &&
    shardTotal <= files.size, 'Invalid shard count');
  const perTest = Object.values(weights).map(([ms, count]) => {
    assert(Number.isFinite(ms) && ms > 0 && Number.isInteger(count) && count > 0,
      'Invalid historical timing');
    return ms / count;
  }).sort((a, b) => a - b);
  assert(perTest.length > 0, 'No historical timings');
  const fallback = perTest[Math.floor(perTest.length / 2)];
  const ranked = Array.from(files, ([file, tests]) => {
    const previous = Object.hasOwn(weights, file) ? weights[file] : null;
    const rate = previous ? previous[0] / previous[1] : fallback;
    return { file, testCount: tests.length, estimatedMs: Math.max(1, Math.round(rate * tests.length)),
      historical: previous !== null };
  }).sort((a, b) => b.estimatedMs - a.estimatedMs || order(a.file, b.file));
  const shards = Array.from({ length: shardTotal }, (_, i) => ({
    shardIndex: i + 1, estimatedMs: 0, testCount: 0, files: [],
  }));
  for (const file of ranked) {
    const shard = shards.reduce((best, next) => next.estimatedMs < best.estimatedMs ? next : best);
    shard.files.push(file);
    shard.estimatedMs += file.estimatedMs;
    shard.testCount += file.testCount;
  }
  const assigned = shards.flatMap(shard => shard.files.map(row => row.file));
  assert.deepEqual(assigned.sort(order), [...files.keys()].sort(order), 'File assignment is not exhaustive');
  return shards;
}

export function verifyRun(report, expected) {
  const actual = [...getInventory(report).values()].flat();
  assert.deepEqual(actual.map(test => test.id).sort(order), [...expected].sort(order),
    'Executed test IDs differ from discovered shard assignment');
  for (const test of actual) {
    assert.equal(test.results.length, 1, 'Expected one execution: ' + test.id);
    assert.equal(test.results[0].status, 'passed', 'Test did not pass: ' + test.id);
  }
}

// Playwright CLI positional filters match regular expressions against absolute
// paths. Anchor both ends and escape metacharacters, including nested paths.
export function fileFilter(root, file) {
  const absolute = resolve(root, file);
  return '^' + Array.from(absolute, c => '\\^$.*+?()[]{}|'.includes(c) ? '\\' + c : c).join('') + '$';
}

function run(index, total) {
  assert(Number.isInteger(index) && index >= 1 && index <= total, 'Invalid shard index');
  assert(process.env.CI === 'true' && process.env.GITHUB_ACTIONS === 'true' &&
    process.env.RUNNER_OS === 'Linux', 'Hosted Linux CI only');
  const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
  const baseline = readJson(fileURLToPath(new URL('./ci-browser-durations.json', import.meta.url)));
  assert.equal(baseline.schemaVersion, 1);
  const output = process.env.PLAYWRIGHT_JSON_OUTPUT_FILE;
  assert(output && isAbsolute(output), 'Absolute Playwright JSON output path required');
  const scratch = mkdtempSync(join(tmpdir(), 'nexa-browser-list-'));
  let plan;
  try {
    const discoveryPath = join(scratch, 'discovery.json');
    const discovered = spawnSync(process.execPath, [cli, 'test', '--list', '--forbid-only', '--reporter=json'], {
      stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: discoveryPath },
    });
    if (discovered.error) throw discovered.error;
    assert.equal(discovered.status, 0, 'Playwright discovery failed');
    const report = readJson(discoveryPath);
    const files = getInventory(report);
    const shards = makePlan(files, baseline.files, total);
    const selected = shards[index - 1];
    const expected = selected.files.flatMap(row => files.get(row.file).map(test => test.id));
    plan = { schemaVersion: 1, sourceRun: baseline.sourceRun, shardIndex: index,
      shardTotal: total, discoveredTestCount: [...files.values()].flat().length,
      shards, selectedTestIds: expected };
    console.log('CI browser assignment: ' + JSON.stringify(selected));
    const filters = selected.files.map(row => fileFilter(report.config.rootDir, row.file));
    const result = spawnSync(process.execPath, [cli, 'test', ...filters, '--forbid-only', '--reporter=dot,json'], {
      stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: output },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
    verifyRun(readJson(output), expected);
    console.log('CI browser inventory verified: ' + expected.length + ' tests executed exactly once');
    return 0;
  } finally {
    // Playwright clears its output directory at test start.
    if (plan) {
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(join(dirname(output), 'ci-browser-plan.json'), JSON.stringify(plan, null, 2) + '\n');
    }
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(Number(process.argv[2]), Number(process.argv[3]));
}
