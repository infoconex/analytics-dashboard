import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourcePath, buildFixtures, extractSampleRows, checkFixtures } from './lab-fixtures.mjs';

const source = await readFile(sourcePath, 'utf8');

describe('UX-13 fictional fixture provenance', () => {
  it('extracts precisely the two authoritative datasets with the original sentinel values', () => {
    const { commerce, channels } = extractSampleRows(source);
    assert.equal(commerce.length, 12);
    assert.equal(channels.length, 5);
    assert.equal(commerce[9].revenue, 41400);
    assert.equal(channels.find(row => row.channel === 'Direct').orders, 1530);
    assert.equal(channels.find(row => row.channel === 'Direct').conversion, 5.4);
  });

  it('does not create a year, date, joined channel data or computed conversion', () => {
    const generated = buildFixtures(source);
    const monthly = JSON.parse(generated['commerce.json']);
    const channels = JSON.parse(generated['channels.json']);
    assert.deepEqual(monthly.map(row => row.monthOrdinal), Array.from({ length: 12 }, (_, i) => i + 1));
    assert.equal(Object.keys(monthly[0]).join(','), 'month,revenue,orders,customers,monthOrdinal');
    assert.deepEqual(Object.keys(channels[0]), ['channel', 'orders', 'sessions', 'conversion']);
    const manifest = JSON.parse(generated['manifest.json']);
    assert.equal(manifest.observationYear, null);
    assert.equal(manifest.observationDates, null);
    assert.equal(manifest.channels.observationDates, null);
  });

  it('fails closed on source drift and executable expressions', () => {
    assert.throws(() => buildFixtures(source.replace('revenue: 41400', 'revenue: 41401')), /sentinel/);
    assert.throws(() => buildFixtures(source.replace('revenue: 41400', 'revenue: 41399 + 1')), /nonliteral/);
    assert.throws(() => buildFixtures(source.replace("month: 'Jan'", "month: 'Feb'")), /Invalid commerce/);
  });

  it('matches all reviewed, checked-in payloads byte-for-byte', async () => {
    await checkFixtures();
  });
});
