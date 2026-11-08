import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const events = JSON.parse(await readFile(new URL('../data/event_catalog_45.json', import.meta.url), 'utf8'));
const [sourceIndex, sourcePackets] = await Promise.all(['../rpg/data/source-reader-index.json', '../rpg/data/historical-source-packets.json']
  .map(file => readFile(new URL(file, import.meta.url), 'utf8').then(JSON.parse)));
const verifiedSourceIds = new Set([...sourceIndex.records, ...sourcePackets.records].map(record => record.sourceId));
assert.equal(events.length, 45, 'V37 event catalog must retain all 45 events');
assert.deepEqual(events.map(event => event.event_id).sort(), Array.from({ length: 45 }, (_, index) => `E${String(index + 1).padStart(2, '0')}`));
for (const event of events) {
  assert.ok(event.title && event.trigger && event.validation_status && event.occurrence_type, `${event.event_id} must have a title, trigger, and evidence classification`);
  if (event.validation_status === 'DESIGN_SEED_NOT_VERIFIED') {
    assert.equal(event.occurrence_type, 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
      `${event.event_id} is an unverified design seed and must not be classified as a documented historical event`);
  }
  if (event.occurrence_type === 'DOCUMENTED_HISTORICAL_EVENT') {
    assert.notEqual(event.validation_status, 'DESIGN_SEED_NOT_VERIFIED',
      `${event.event_id} cannot claim documentation without verified evidence`);
    assert.ok(Array.isArray(event.source_ids) && event.source_ids.length > 0,
      `${event.event_id} must link its documented historical source`);
    for (const sourceId of event.source_ids) assert.ok(verifiedSourceIds.has(sourceId),
      `${event.event_id} references an unindexed source: ${sourceId}`);
  }
}
console.log('V37 event catalog: 45 IDs and historical-evidence classifications are internally consistent');
