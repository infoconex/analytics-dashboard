#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'web/test-results');
const apply = process.argv.includes('--apply');
const reportPath = resolve(root, 'ci-playwright-report.json');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
  const files = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function collectReportPaths(value, paths = []) {
  if (Array.isArray(value)) for (const item of value) collectReportPaths(item, paths);
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'path' && typeof item === 'string') paths.push(item);
      else collectReportPaths(item, paths);
    }
  }
  return paths;
}

function resolveReportPath(raw) {
  if (/^[a-z]+:\/\//i.test(raw)) return null;
  const candidates = [resolve(raw), resolve(root, raw)];
  return candidates.find(path => path === root || path.startsWith(`${root}${sep}`)) ?? null;
}

const allFiles = await walk(root);
const reportFile = allFiles.find(path => path === reportPath);
const referenced = new Set();
if (reportFile) {
  const report = JSON.parse(await readFile(reportFile, 'utf8'));
  for (const raw of collectReportPaths(report)) {
    const path = resolveReportPath(raw);
    if (!path) continue;
    try { await stat(path); }
    catch { throw new Error(`Playwright report attachment is missing before deduplication: ${raw}`); }
    referenced.add(path);
  }
}

const pngs = allFiles.filter(path => path.toLowerCase().endsWith('.png'));
const attachedPngs = pngs.filter(path => /(?:^|[\\/])attachments(?:[\\/]|$)/.test(path));
const hashes = new Map();
for (const path of attachedPngs) {
  const bytes = await readFile(path);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const matches = hashes.get(hash) ?? [];
  matches.push({ path, bytes: bytes.length });
  hashes.set(hash, matches);
}

const removed = [];
for (const path of pngs) {
  if (/(?:^|[\\/])attachments(?:[\\/]|$)/.test(path) || referenced.has(path)) continue;
  const bytes = await readFile(path);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const match = hashes.get(hash)?.find(item => item.path !== path);
  if (!match) continue;
  removed.push({ path: relative(root, path), retainedAttachment: relative(root, match.path), sha256: hash, bytes: bytes.length });
  if (apply) await unlink(path);
}

for (const path of referenced) {
  try { await stat(path); }
  catch { throw new Error(`Playwright report attachment no longer resolves after deduplication: ${relative(root, path)}`); }
}

const summary = {
  schemaVersion: 1,
  mode: apply ? 'applied' : 'dry-run',
  pngCountBefore: pngs.length,
  pngCountAfter: pngs.length - (apply ? removed.length : 0),
  reportAttachmentReferencesVerified: referenced.size,
  duplicatePngsRemoved: apply ? removed.length : 0,
  duplicatePngsFound: removed.length,
  bytesRemoved: removed.reduce((sum, item) => sum + item.bytes, 0),
  removed,
};
await writeFile(resolve(root, 'browser-evidence-deduplication.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
