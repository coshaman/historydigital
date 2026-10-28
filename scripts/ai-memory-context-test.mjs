import assert from 'node:assert/strict';
import test from 'node:test';
import characterCards from '../narrative/LATE_GAME_CHARACTER_CARDS.json' with { type: 'json' };
import loreCards from '../narrative/AI_LORE_CARDS.json' with { type: 'json' };
import scenarios from '../narrative/LATE_GAME_SCENARIOS.json' with { type: 'json' };
import { addMemoryCandidates, restoreMemories, serializeMemories, validateMemoryCandidate } from '../ai/memory-store.js';
import { composeContext } from '../ai/context-composer.js';
const claims = new Map(loreCards.claims.map(item => [item.id, item]));

const circle = scenarios.scenes.find(scene => scene.id === 'CIRCLE_01');
const bookshop = scenarios.scenes.find(scene => scene.id === 'BOOKSHOP_01');

test('memory stores a bounded quote of actual player input, never model-invented summary text', () => {
  const candidate = { subjectId: 'player', characterId: 'ekaterina', sceneId: 'CIRCLE_01', kind: 'STANCE', summaryKo: '플레이어는 황제에게 비밀 지시를 받았다.', salience: 'HIGH' };
  const memory = validateMemoryCandidate(candidate, { scene: circle, turnIndex: 8, playerInput: '원문을 먼저 읽고 판단하고 싶어.' });
  assert.equal(memory.characterId, 'ekaterina');
  assert.match(memory.summaryKo, /원문을 먼저 읽고 판단하고 싶어/);
  assert.doesNotMatch(memory.summaryKo, /황제|비밀 지시/);
  assert.equal(memory.createdTurn, 8);
});

test('rejects invalid owner, out-of-scene character, unsupported kind, or empty player input', () => {
  const base = { subjectId: 'player', characterId: 'ekaterina', sceneId: 'CIRCLE_01', kind: 'STANCE', summaryKo: 'anything', salience: 'HIGH' };
  assert.equal(validateMemoryCandidate({ ...base, characterId: 'historical_person' }, { scene: circle, turnIndex: 1, playerInput: '안녕.' }), null);
  assert.equal(validateMemoryCandidate({ ...base, subjectId: 'npc' }, { scene: circle, turnIndex: 1, playerInput: '안녕.' }), null);
  assert.equal(validateMemoryCandidate({ ...base, kind: 'SECRET_FACT' }, { scene: circle, turnIndex: 1, playerInput: '안녕.' }), null);
  assert.equal(validateMemoryCandidate(base, { scene: circle, turnIndex: 1, playerInput: '  ' }), null);
});

test('memory persistence deduplicates, validates on restore, and retains a bounded durable set', () => {
  const candidate = { subjectId: 'player', characterId: 'ekaterina', sceneId: 'CIRCLE_01', kind: 'STANCE', summaryKo: 'ignored', salience: 'HIGH' };
  const one = addMemoryCandidates([], [candidate], { scene: circle, turnIndex: 1, playerInput: '원문을 먼저 보자.' });
  const duplicate = addMemoryCandidates(one, [candidate], { scene: circle, turnIndex: 2, playerInput: '원문을 먼저 보자.' });
  assert.equal(duplicate.length, 1);
  const restored = restoreMemories(serializeMemories(duplicate), { scenes: scenarios.scenes, maxMemories: 2 });
  assert.deepEqual(restored, duplicate);
  assert.equal(restoreMemories('[{"subjectId":"npc"}]', { scenes: scenarios.scenes }).length, 0);
});

test('character memories survive moves between authored scenes and save restoration', () => {
  const candidate = { subjectId: 'player', characterId: 'ekaterina', sceneId: 'CIRCLE_01', kind: 'STANCE', summaryKo: 'ignored', salience: 'HIGH' };
  const first = addMemoryCandidates([], [candidate], { scene: circle, scenes: scenarios.scenes, turnIndex: 1, playerInput: '원문부터 읽자.' });
  const nextScene = addMemoryCandidates(first, [], { scene: bookshop, scenes: scenarios.scenes, turnIndex: 1, playerInput: '책을 고른다.' });
  assert.equal(nextScene.length, 1);
  assert.equal(nextScene[0].sceneId, 'CIRCLE_01');
  assert.deepEqual(restoreMemories(serializeMemories(nextScene), { scenes: scenarios.scenes }), nextScene);
});

test('context keeps only relevant lore and character memories, with ten recent turns and bounded copy', () => {
  const claims = new Map(loreCards.claims.map(claim => [claim.id, claim]));
  const memories = [
    { id: 'M1', subjectId: 'player', characterId: 'ekaterina', sceneId: 'CIRCLE_01', kind: 'STANCE', summaryKo: '원문부터 읽자고 했다.', salience: 'HIGH', createdTurn: 2 },
    { id: 'M2', subjectId: 'player', characterId: 'alexei', sceneId: 'CIRCLE_01', kind: 'STANCE', summaryKo: '행정 순서를 확인했다.', salience: 'MEDIUM', createdTurn: 2 },
  ];
  const context = composeContext({ scene: bookshop, characterId: 'ekaterina', characterCards, state: { relationships: { ekaterina: 1 }, ideology: { publicLiteraryCriticism: 9 }, endingId: 'HERZEN' }, claims, memories, summary: '요약'.repeat(900), recentTurns: Array.from({ length: 14 }, (_, i) => ({ role: 'user', text: `발언 ${i}` })), playerInput: '책을 펼쳐 볼게.' });
  assert.equal(context.recentTurns.length, 10);
  assert.deepEqual(context.memories.map(memory => memory.id), ['M1']);
  assert.ok(context.claims.length <= 6);
  assert.ok(context.summary.length <= 1200);
  assert.equal(context.state.endingId, undefined);
  assert.equal(context.state.ideology, undefined);
  assert.equal(context.state.relationshipTone.ekaterina, 'trusting');
  assert.ok(context.character.voice.rhythm);
  assert.equal(context.playerInput, '책을 펼쳐 볼게.');
});

test('narrator-only secondary synthesis is not included in the NPC context', () => {
  const context = composeContext({ scene: circle, characterId: 'ekaterina', characterCards, state: {}, claims: new Map(loreCards.claims.map(claim => [claim.id, claim])), memories: [], summary: '', recentTurns: [], playerInput: '어디서 시작하지?' });
  assert.equal(context.claims.some(claim => claim.id === 'CLAIM_FRIDAY_READING_SYNTHESIS'), false);
});

test('month-only source dates are treated as available after the month closes', () => {
  const reading = composeContext({ scene: { ...scenarios.scenes.find(item => item.id === 'BOOKSHOP_01'), date: '1847-01-15' }, characterId: 'pavel', characterCards, claims });
  assert.equal(reading.claims.some(claim => claim.id === 'CLAIM_KHOR_PUBLICATION'), false);
});

