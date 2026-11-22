import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const sourcePath = resolve(scriptDirectory, '../../src/demoData.ts');
export const fixtureDirectory = resolve(scriptDirectory, '../../../lab/ux13/fixtures');
export const commerceIndex = 'ux13-northstar-commerce';
export const channelIndex = 'ux13-northstar-channels';
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function extractSampleRows(source) {
  const result = {};
  for (const name of ['commerce', 'channels']) {
    const pattern = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`, 'g');
    const matches = [...source.matchAll(pattern)];
    if (matches.length !== 1) throw new Error(`Missing or duplicate literal array: ${name}`);
    for (const [, objectBody] of matches[0][1].matchAll(/\{([^{}]*)\}/g)) {
      const keys = [...objectBody.matchAll(/(?:^|,)\s*([A-Za-z][A-Za-z0-9]*)\s*:/g)].map(match => match[1]);
      if (new Set(keys).size !== keys.length) throw new Error(`Duplicate field in ${name}`);
    }
    // This is a deliberately narrow parser for the existing static source shape,
    // not JavaScript evaluation. Expressions, spreads and functions are rejected.
    const json = matches[0][1]
      .replace(/'([^'\\]*)'/g, (_, value) => JSON.stringify(value))
      .replace(/\b([A-Za-z][A-Za-z0-9]*)\s*:/g, '"$1":')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/,\s*$/, '');
    try {
      result[name] = JSON.parse(`[${json}]`);
    } catch {
      throw new Error(`Fixture source includes a nonliteral or malformed value: ${name}`);
    }
  }
  assertFixtureSemantics(result);
  return result;
}

function exactFields(row, names) {
  if (Object.keys(row).sort().join(',') !== [...names].sort().join(','))
    throw new Error(`Unexpected fields: ${Object.keys(row)}`);
}

export function assertFixtureSemantics({ commerce, channels }) {
  if (!Array.isArray(commerce) || commerce.length !== 12 || !Array.isArray(channels) || channels.length !== 5)
    throw new Error('Expected 12 commerce and 5 channel records');
  for (const [i, row] of commerce.entries()) {
    exactFields(row, ['month', 'revenue', 'orders', 'customers']);
    if (row.month !== months[i] || ![row.revenue, row.orders, row.customers].every(Number.isSafeInteger))
      throw new Error(`Invalid commerce record ${i}`);
  }
  for (const row of channels) {
    exactFields(row, ['channel', 'orders', 'sessions', 'conversion']);
    if (typeof row.channel !== 'string' || row.channel.length === 0 || !Number.isSafeInteger(row.orders)
      || !Number.isSafeInteger(row.sessions) || row.sessions <= 0
      || !Number.isFinite(row.conversion) || row.conversion < 0 || row.conversion > 100)
      throw new Error('Invalid channel record');
  }
  const orders = Object.fromEntries(channels.map(row => [row.channel, row.orders]));
  if (new Set(channels.map(row => row.channel)).size !== 5 || commerce[0].revenue !== 18400
    || commerce[9].revenue !== 41400 || commerce[11].revenue !== 48300
    || JSON.stringify(orders) !== JSON.stringify({
      'Organic search': 1820, Direct: 1530, 'Paid search': 1120, Social: 890, Referral: 615,
    })) throw new Error('Northstar fixed sentinel values changed; review UX-12 before accepting this');
}

function bulkLine(index, id, document) {
  return `${JSON.stringify({ index: { _index: index, _id: id } })}\n${JSON.stringify(document)}\n`;
}

export function buildFixtures(source) {
  const { commerce, channels } = extractSampleRows(source);
  // An ordinal is not a date. Never invent a calendar year or observation timestamp.
  const commerceDocuments = commerce.map((row, i) => ({ ...row, monthOrdinal: i + 1 }));
  const bulk = commerceDocuments.map((row, i) => bulkLine(commerceIndex, `month-${i + 1}`, row)).join('')
    + channels.map((row, i) => bulkLine(channelIndex, `channel-${i + 1}`, row)).join('');
  const files = {
    'commerce.json': `${JSON.stringify(commerceDocuments, null, 2)}\n`,
    'channels.json': `${JSON.stringify(channels, null, 2)}\n`,
    'elasticsearch-bulk.ndjson': bulk,
  };
  const manifest = {
    schemaVersion: 1,
    source: 'web/src/demoData.ts',
    sourceSha256: sha256(source),
    synthetic: true,
    observationYear: null,
    observationDates: null,
    commerce: { index: commerceIndex, count: 12, monthOrdinal: '1=Jan … 12=Dec; not a calendar date',
      sentinelRevenue: { Jan: 18400, Oct: 41400, Dec: 48300 } },
    channels: { index: channelIndex, count: 5, observationDates: null,
      sentinelOrders: { 'Organic search': 1820, Direct: 1530, 'Paid search': 1120, Social: 890, Referral: 615 },
      conversionMeaning: 'illustrative; not derived from orders / sessions' },
    files: Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, sha256(contents)])),
  };
  return { ...files, 'manifest.json': `${JSON.stringify(manifest, null, 2)}\n` };
}

export async function checkFixtures(write = false) {
  const files = buildFixtures(await readFile(sourcePath, 'utf8'));
  if (write) await mkdir(fixtureDirectory, { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    const path = resolve(fixtureDirectory, name);
    if (write) await writeFile(path, contents);
    else if (await readFile(path, 'utf8') !== contents)
      throw new Error(`Out-of-sync fixture ${name}; regenerate and review before running a comparison`);
  }
  return JSON.parse(files['manifest.json']);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const action = process.argv[2] ?? 'check';
  if (!['write', 'check'].includes(action)) throw new Error('Usage: node lab-fixtures.mjs [write|check]');
  const manifest = await checkFixtures(action === 'write');
  process.stdout.write(`UX-13 fictional fixture ${action}: ${manifest.commerce.count} monthly, ${manifest.channels.count} channel records; source SHA-256 ${manifest.sourceSha256}\n`);
}
