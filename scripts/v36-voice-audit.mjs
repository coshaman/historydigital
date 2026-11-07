import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.join(process.cwd(), 'rpg', 'characters');
const cards = await Promise.all((await readdir(directory)).filter(file => file.endsWith('.json')).map(async file => JSON.parse(await readFile(path.join(directory, file), 'utf8'))));
const residents = cards.filter(card => card.kind === 'FICTIONAL' && !card.id.startsWith('literary_'));
assert.ok(residents.length >= 36, 'the audit covers at least 36 fictional city residents');

const registerSituations = ['firstMeeting', 'colleague', 'private', 'conflict', 'intimacy', 'formal'];
const registerSignatures = new Map();
for (const card of residents) {
  assert.ok(card.speechRhythm?.trim(), `${card.id} needs an authored sentence rhythm`);
  for (const situation of registerSituations) assert.ok(card.speechRegister?.[situation]?.trim(), `${card.id} needs a ${situation} register`);
  assert.equal(new Set(card.voiceSamples ?? []).size, 3, `${card.id} needs three distinct voice samples`);
  assert.ok(card.worldview?.blindSpotKo?.trim(), `${card.id} needs a concrete worldview limitation`);
  assert.ok(!/(라고 본다|다고 본다|라고 믿는다|다고 믿는다|라고 여긴다|다고 여긴다|라고 생각한다|다고 생각한다|해야 한다\.|하려 한다|할 수 있다고 본다)/.test(card.voiceSamples[2]),
    `${card.id} third voice sample must sound spoken, not like a character-card summary`);
  const registerSignature = JSON.stringify(Object.fromEntries(registerSituations.map(key => [key, card.speechRegister[key]])));
  registerSignatures.set(registerSignature, [...(registerSignatures.get(registerSignature) ?? []), card.id]);
}
assert.equal(new Set(residents.map(card => card.worldview.blindSpotKo)).size, residents.length, 'resident blind spots must be individually authored');
const duplicateRegisterGroups = [...registerSignatures.values()].filter(group => group.length > 1);
assert.deepEqual(duplicateRegisterGroups, [], 'relationship registers must not be copied wholesale across residents');

const endings = ['겠습니다', '합니다', '했어요', '거든요', '잖아요', '겠어요', '하오', '구려', '습니다', '어요', '아요', '해요', '죠', '요', '소', '오', '다', '지']
  .sort((left, right) => right.length - left.length);
const voiceSignature = card => {
  const samples = card.voiceSamples;
  const endingKinds = [...new Set(samples.map(line => endings.find(ending => line.replace(/[.!?…]+$/g, '').endsWith(ending)) ?? 'other'))].sort();
  const rhythms = [...new Set(samples.map(line => `${(line.match(/[.!?]/g) ?? []).length || 1}:${line.length < 35 ? 'short' : line.length < 70 ? 'medium' : 'long'}`))].sort();
  return `${endingKinds.join('|')}::${rhythms.join('|')}`;
};
const signatures = new Map();
for (const card of residents) signatures.set(voiceSignature(card), [...(signatures.get(voiceSignature(card)) ?? []), card.id]);
const indistinct = [...signatures.values()].filter(group => group.length > 1);
assert.deepEqual(indistinct, [], 'voice samples must differ by sentence endings and rhythm, not only by topic');

const report = { schemaVersion: 'V36_VOICE_AUDIT_V1', status: 'PASS', residents: residents.length, uniqueBlindSpots: residents.length,
  distinctEndingAndRhythmSignatures: signatures.size, uniqueRelationshipRegisterMatrices: registerSignatures.size,
  conversationalThirdSamples: residents.length, rejectedNarrativeSummarySamples: true, registerSituations: registerSituations.length,
  duplicateRegisterGroups: [], duplicateBlindSpotGroups: [], indistinctVoiceGroups: [] };
const reportDirectory = path.join(process.cwd(), 'docs', 'v36', 'current-audit');
await mkdir(reportDirectory, { recursive: true });
await writeFile(path.join(reportDirectory, 'VOICE_AUDIT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
