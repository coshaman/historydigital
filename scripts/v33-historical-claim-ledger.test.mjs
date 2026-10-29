import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditHistoricalClaimLedger } from './v33-historical-claim-ledger.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../rpg/${name}`, import.meta.url), 'utf8'));
const campaign = read('quests/campaign.json');
const register = read('data/source-register.json');
const packets = read('data/historical-source-packets.json');
const quests = fs.readdirSync(new URL('../rpg/quests/', import.meta.url)).filter((file) => file.endsWith('.json') && file !== 'campaign.json').map((file) => JSON.parse(fs.readFileSync(new URL(`../rpg/quests/${file}`, import.meta.url), 'utf8')));
const maps = fs.readdirSync(new URL('../rpg/maps/', import.meta.url)).filter((file) => file.endsWith('.json')).map((file) => ({ file: `rpg/maps/${file}`, data: JSON.parse(fs.readFileSync(new URL(`../rpg/maps/${file}`, import.meta.url), 'utf8')) }));
const ledger = read('data/historical-claim-ledger.json');
const audit = (changes = {}) => auditHistoricalClaimLedger({ ledger: structuredClone(ledger), campaign, register, packets, quests, maps, ...changes });

test('historical claim ledger resolves at least twelve aligned excerpts into playable campaign issues', () => {
  const result = audit();
  assert.deepEqual(result.failures, []);
  assert.ok(result.uniqueExcerptCount >= 12);
});

test('claim ledger rejects claims without an aligned source range', () => {
  const changed = structuredClone(ledger);
  changed.claims[0].paragraphIndex = 999;
  assert.ok(audit({ ledger: changed }).failures.some((failure) => failure.includes('paragraph')));
});

test('claim ledger rejects historical claims assigned to a campaign that does not contain the source', () => {
  const changed = structuredClone(ledger);
  changed.claims[0].arcId = 'V33_1849_CIRCLE';
  assert.ok(audit({ ledger: changed }).failures.some((failure) => failure.includes('arc')));
});

test('claim ledger rejects duplicate excerpts and non-meaningful placeholder claims', () => {
  const changed = structuredClone(ledger);
  changed.claims[1].sourceId = changed.claims[0].sourceId;
  changed.claims[1].paragraphIndex = changed.claims[0].paragraphIndex;
  changed.claims[1].claimKo = '내용';
  assert.ok(audit({ ledger: changed }).failures.some((failure) => failure.includes('duplicate excerpt')));
  assert.ok(audit({ ledger: changed }).failures.some((failure) => failure.includes('meaningful')));
});

test('claim ledger requires a real in-game source object and rejects a mismatched quest citation', () => {
  const changed = structuredClone(ledger);
  changed.claims[0].useRef = { file: 'rpg/maps/chancery.json', objectId: 25 };
  changed.claims[0].questId = 'CIRCLE_LETTER_1849_MAY';
  const changedCampaign = structuredClone(campaign);
  changedCampaign.arcs.find((arc) => arc.id === 'V33_1848_PUBLIC').questIds.push('CIRCLE_LETTER_1849_MAY');
  const failures = audit({ ledger: changed, campaign: changedCampaign }).failures;
  assert.ok(failures.some((failure) => failure.includes('map source object')));
  assert.ok(failures.some((failure) => failure.includes('does not use')));
});

test('claim ledger rejects whitespace and non-text source provenance fields', () => {
  const changed = structuredClone(packets);
  changed.records[0].sourceUrl = '   ';
  changed.records[0].range = {};
  changed.records[0].edition = ' ';
  changed.records[0].contextKo = ' ';
  const failures = audit({ packets: changed }).failures;
  assert.ok(failures.some((failure) => failure.includes('sourceUrl')));
  assert.ok(failures.some((failure) => failure.includes('range')));
  assert.ok(failures.some((failure) => failure.includes('edition')));
  assert.ok(failures.some((failure) => failure.includes('contextKo')));
});

test('claim ledger rejects hidden, non-source, or wrong-chapter map objects', () => {
  for (const mutate of [
    (object) => { object.visible = false; },
    (object) => { object.type = 'quest-object'; },
    (object) => { object.properties.find((property) => property.name === 'availableChapterId').value = 'V33_1849_CIRCLE'; },
  ]) {
    const changedMaps = structuredClone(maps);
    const object = changedMaps.find((map) => map.file === 'rpg/maps/printshop.json').data.layers.flatMap((layer) => layer.objects ?? []).find((entry) => entry.id === 25);
    mutate(object);
    assert.ok(audit({ maps: changedMaps }).failures.some((failure) => failure.includes('map source object')));
  }
});
