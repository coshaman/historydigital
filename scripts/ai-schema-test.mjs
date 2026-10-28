import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateTurn } from '../ai/validate-turn.js';
import scenarios from '../narrative/LATE_GAME_SCENARIOS.json' with { type: 'json' };

const schema = JSON.parse(await readFile(new URL('../schemas/ai-scene-turn.schema.json', import.meta.url), 'utf8'));

const scene = {
  id: 'CIRCLE_01',
  cast: ['pavel', 'ekaterina'],
  allowedSignals: ['CIRCLE_PUBLIC_CRITIQUE', 'RELATIONSHIP_WARMTH'],
  allowedClaimIds: ['CLAIM_FRIDAY_READING'],
  allowedBackgroundIds: ['circle_apartment_night'],
  allowedExpressionIds: ['pavel_guarded'],
  allowedActionIds: ['SET_BOOK_ON_TABLE'],
};

const validTurn = () => ({
  schemaVersion: 'AI_SCENE_TURN_V1',
  sceneId: 'CIRCLE_01',
  turnType: 'DIALOGUE',
  beats: [{ type: 'DIALOGUE', speakerId: 'pavel', textKo: '책부터 펼쳐 보자.', emotion: 'guarded', expressionId: 'pavel_guarded', actionId: 'NONE' }],
  suggestedReplies: [
    { id: 'R1', textKo: '어떤 대목이 먼저 눈에 띄었어?', tone: 'curious' },
    { id: 'R2', textKo: '그 이야긴 여기서 그만하자.', tone: 'cautious' },
  ],
  semanticSignals: ['CIRCLE_PUBLIC_CRITIQUE'],
  relationshipSignals: [{ characterId: 'ekaterina', signal: 'TRUST_UP' }],
  goalSignal: 'PROGRESS',
  memoryCandidates: [{ subjectId: 'player', characterId: 'ekaterina', sceneId: 'CIRCLE_01', kind: 'STANCE', summaryKo: '원문을 먼저 읽자고 했다.', salience: 'HIGH' }],
  historicalClaimIds: ['CLAIM_FRIDAY_READING'],
  uiCue: { backgroundId: 'circle_apartment_night', cgId: 'none', sfxId: 'paper_turn' },
});

test('schema remains strict and keeps every model-authorized collection bounded', () => {
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(new Set(schema.required), new Set(Object.keys(schema.properties)));
  assert.equal(schema.properties.beats.maxItems, 4);
  assert.equal(schema.properties.suggestedReplies.maxItems, 3);
  assert.equal(schema.properties.memoryCandidates.maxItems, 2);
});

test('accepts a complete in-scene structured turn', () => {
  assert.deepEqual(validateTurn(validTurn(), scene), { ok: true, value: validTurn() });
});

test('rejects unknown fields and malformed turns', () => {
  const turn = validTurn();
  turn.hiddenStatDelta = 999;
  assert.equal(validateTurn(turn, scene).ok, false);
});

test('rejects a semantic signal that is not allowed for the active scene', () => {
  const turn = validTurn();
  turn.semanticSignals = ['NEW_EMPEROR_ENDING'];
  assert.equal(validateTurn(turn, scene).ok, false);
});

test('rejects unknown historical claims, backgrounds, expressions and action IDs', () => {
  for (const mutate of [
    value => { value.historicalClaimIds = ['CLAIM_NOT_IN_SCENE']; },
    value => { value.uiCue.backgroundId = 'modern_classroom'; },
    value => { value.beats[0].expressionId = 'unregistered_expression'; },
    value => { value.beats[0].actionId = 'MINT_MONEY'; },
  ]) {
    const value = validTurn();
    mutate(value);
    assert.equal(validateTurn(value, scene).ok, false);
  }
});

test('rejects overlong dialogue and excessive beat, reply or memory counts', () => {
  for (const mutate of [
    value => { value.beats[0].textKo = '가'.repeat(601); },
    value => { value.beats = Array.from({ length: 5 }, () => value.beats[0]); },
    value => { value.suggestedReplies = Array.from({ length: 4 }, () => value.suggestedReplies[0]); },
    value => { value.memoryCandidates = Array.from({ length: 3 }, () => value.memoryCandidates[0]); },
  ]) {
    const value = validTurn();
    mutate(value);
    assert.equal(validateTurn(value, scene).ok, false);
  }
});

test('rejects model-authored memory outside known ownership or allowed memory kind', () => {
  const turn = validTurn();
  turn.memoryCandidates[0].characterId = 'historical_person';
  turn.memoryCandidates[0].kind = 'SECRET_FACT';
  assert.equal(validateTurn(turn, scene).ok, false);
});

test('rejects dialogue speakers and relationship targets outside the active scene cast', () => {
  const bookshop = scenarios.scenes.find(item => item.id === 'BOOKSHOP_01');
  const base = { schemaVersion: 'AI_SCENE_TURN_V1', sceneId: bookshop.id, turnType: 'DIALOGUE', beats: [{ type: 'DIALOGUE', speakerId: 'alexei', textKo: '안녕.', emotion: 'neutral', expressionId: 'none', actionId: 'NONE' }], suggestedReplies: [{ id: 'R1', textKo: '그 말을 다시 설명해 주세요.', tone: 'curious' }, { id: 'R2', textKo: '먼저 책을 읽어 볼게요.', tone: 'reflective' }], semanticSignals: [], relationshipSignals: [{ characterId: 'alexei', signal: 'TRUST_UP' }], goalSignal: 'HOLD', memoryCandidates: [], historicalClaimIds: [], uiCue: { backgroundId: bookshop.backgroundId, cgId: bookshop.cgId, sfxId: 'none' } };
  assert.equal(validateTurn(base, bookshop).ok, false);
});





