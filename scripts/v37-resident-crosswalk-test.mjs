import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [bundle, crosswalk, characterFiles] = await Promise.all([
  readJson('../data/residents_1840s_36.json'),
  readJson('../data/v37_resident_crosswalk.json'),
  readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const runtimeIds = new Set(await Promise.all(characterFiles.filter(file => file.endsWith('.json'))
  .map(async file => (await readJson(`../rpg/characters/${file}`)).id)));
assert.equal(crosswalk.reviewStatus, 'CANDIDATE_MAPPING_ONLY_NOT_RUNTIME_MIGRATION');
assert.equal(crosswalk.records.length, bundle.length);
assert.equal(new Set(crosswalk.records.map(row => row.bundleId)).size, bundle.length);
assert.deepEqual(crosswalk.records.map(row => row.bundleId).sort(), bundle.map(row => row.id).sort());
for (const row of crosswalk.records) {
  assert.equal(row.sourcePath, 'data/residents_1840s_36.json');
  assert.equal(row.fictionClass, 'FICTIONAL_COMPOSITE');
  assert.equal(row.mergeAllowed, false, `${row.bundleId}: candidate links must never silently merge identities`);
  assert.ok(['POTENTIAL_OVERLAP_REVIEWED_NOT_MERGED', 'NO_IDENTITY_SAFE_MATCH'].includes(row.decision));
  for (const candidate of row.candidateRuntimeIds) assert.ok(runtimeIds.has(candidate), `${row.bundleId}: unknown runtime candidate ${candidate}`);
}
console.log(JSON.stringify({ status: 'PASS', sourceResidents: bundle.length,
  candidateOverlapRows: crosswalk.records.filter(row => row.candidateRuntimeIds.length).length,
  safeMergeCount: crosswalk.records.filter(row => row.mergeAllowed).length,
  runtimeCards: runtimeIds.size, statusBoundary: crosswalk.reviewStatus }, null, 2));
