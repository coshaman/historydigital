import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const [register, witness, quest] = await Promise.all([
  read('../rpg/data/source-register.json'),
  read('../rpg/data/khor-kalynych-source.json'),
  read('../rpg/quests/v37-physiology-reading-1847.json'),
]);
const byId = new Map(register.sources.map(source => [source.sourceId, source]));
const issue = byId.get('V37-SOVREMENNIK-1847-T1-1-2');
const commentary = byId.get('MOD-RVB-TURGENEV-KHOR-1847');

assert.ok(issue, 'the verified 1847 journal volume must be in the source register');
assert.equal(issue.date, '1847');
assert.equal(issue.volume, 'Т. 1');
assert.equal(issue.issue, '№ 1/2');
assert.match(issue.url, /^https:\/\/www\.prlib\.ru\/item\/946269$/);
assert.equal(issue.verificationStatus, 'CATALOG_RECORD_VERIFIED_SCAN_CONTENT_NOT_CHECKED');

assert.ok(commentary, 'the scholarly publication note must be separately identifiable');
assert.equal(commentary.type, 'SCHOLARLY_EDITORIAL_COMMENTARY');
assert.match(commentary.range, /№ 1.*55–64.*30 декабря 1846/);
assert.match(commentary.url, /^https:\/\/rvb\.ru\/turgenev\/02comm\/0123\.htm$/);

assert.equal(witness.firstPublicationSourceId, issue.sourceId);
assert.equal(witness.firstPublicationCommentarySourceId, commentary.sourceId);
assert.equal(witness.firstPublicationRange, '1847, «Современник», № 1, отдел «Смесь», с. 55–64; censor approval 1846-12-30');
assert.match(witness.witness.note, /not a facsimile transcription of the 1847 first printing/);
assert.ok(quest.date > '1847-01-31', 'the in-world June scene occurs after the documented 1847 publication');
for (const sourceId of [witness.sourceId, issue.sourceId, commentary.sourceId]) {
  assert.ok(quest.sourceIds.includes(sourceId), `E39 must cite ${sourceId}`);
  assert.ok(quest.historicalOutcome.sourceIds.includes(sourceId), `E39 outcome must cite ${sourceId}`);
}
const purchase = quest.actions.find(action => action.id === 'E39_BUY_COPY');
assert.deepEqual(purchase.balanceEstimate, { field: 'effects.moneyDelta', amount: 2, unit: 'kopeks', evidenceClass: 'BALANCE_ESTIMATE' },
  'the fictional purchase price must not appear as a documented 1847 market price');

console.log('V37 E39 provenance: first issue, scholarly publication range, edition boundary, scene chronology, and estimated gameplay price are linked.');
