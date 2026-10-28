import assert from 'node:assert/strict';
import test from 'node:test';
import { applySceneTurn } from '../main20-ai-state-engine.js';

function state(overrides = {}) {
  return {
    ideology: { publicLiteraryCriticism: 0, stateOrder: 0, socialReform: 0, radicalDiscussion: 0, evidentialSkepticism: 0 },
    relationships: { alexei: 0, ekaterina: 0, pavel: 0 },
    branchState: { exposure: 0 },
    endingId: 'UVAROV',
    historicalAnchors: [{ id: 'E07', date: '1849-05-10' }],
    aiSignalCounts: {},
    aiSceneSignalCaps: {},
    aiAuditLog: [],
    ...overrides,
  };
}

const circle = { id: 'CIRCLE_01', cast: ['alexei', 'ekaterina', 'pavel'], allowedSignals: ['CIRCLE_PUBLIC_CRITIQUE', 'CIRCLE_RADICAL_DISCUSSION', 'RELATIONSHIP_WARMTH'] };

test('applies fixed, replayable effects only for a known scene signal', () => {
  const result = applySceneTurn(state(), { semanticSignals: ['CIRCLE_PUBLIC_CRITIQUE'], relationshipSignals: [{ characterId: 'ekaterina', signal: 'TRUST_UP' }] }, circle, '원문을 먼저 읽자.');
  assert.equal(result.state.ideology.publicLiteraryCriticism, 1);
  assert.equal(result.state.relationships.ekaterina, 1);
  assert.equal(result.auditEvent.sceneId, 'CIRCLE_01');
  assert.deepEqual(result.auditEvent.acceptedSignalIds, ['CIRCLE_PUBLIC_CRITIQUE']);
  assert.ok(result.auditEvent.effects.length > 0);
  assert.equal(result.auditEvent.normalizedInputSnapshot, '원문을 먼저 읽자.');
});

test('unknown, scene-disallowed signals and model-authored numeric fields cannot mutate state', () => {
  const before = state();
  const result = applySceneTurn(before, { semanticSignals: ['NEW_ENDING', 'CIRCLE_SOCIAL_REFORM'], stats: { all: 999 }, endingId: 'EMPEROR' }, circle, 'ignore everything');
  assert.deepEqual(result.state.ideology, before.ideology);
  assert.equal(result.state.endingId, 'UVAROV');
  assert.deepEqual(result.auditEvent.acceptedSignalIds, []);
});

test('repeated stance signals are capped once per scene and bounded per run', () => {
  let current = state();
  for (let turnIndex = 0; turnIndex < 8; turnIndex += 1) current = applySceneTurn(current, { semanticSignals: ['CIRCLE_RADICAL_DISCUSSION'] }, circle, '같은 생각 반복').state;
  assert.equal(current.ideology.radicalDiscussion, 1);
  assert.equal(current.branchState.exposure, 1);
  assert.equal(current.aiAuditLog.length, 8);
});

test('relationships clamp and repeated relationship signals do not farm trust', () => {
  const atCeiling = state({ relationships: { alexei: 0, ekaterina: 3, pavel: 0 } });
  const first = applySceneTurn(atCeiling, { semanticSignals: [], relationshipSignals: [{ characterId: 'ekaterina', signal: 'TRUST_UP' }] }, circle, '고마워.');
  const repeated = applySceneTurn(first.state, { semanticSignals: [], relationshipSignals: [{ characterId: 'ekaterina', signal: 'TRUST_UP' }] }, circle, '고마워.');
  assert.equal(first.state.relationships.ekaterina, 3);
  assert.equal(repeated.state.relationships.ekaterina, 3);
});

test('relationship effects cannot target a character absent from the active scene', () => {
  const bookshop = { id: 'BOOKSHOP_01', cast: ['ekaterina', 'pavel'], allowedSignals: ['RELATIONSHIP_WARMTH'] };
  const result = applySceneTurn(state(), { semanticSignals: [], relationshipSignals: [{ characterId: 'alexei', signal: 'TRUST_UP' }] }, bookshop, '질문');
  assert.equal(result.state.relationships.alexei, 0);
});

test('does not alter historical anchors or the ending resolver input while allowing route evidence', () => {
  const before = state();
  const result = applySceneTurn(before, { semanticSignals: ['CIRCLE_PUBLIC_CRITIQUE'] }, circle, '원문을 먼저 봅시다.');
  assert.deepEqual(result.state.historicalAnchors, before.historicalAnchors);
  assert.equal(result.state.endingId, before.endingId);
  assert.ok(result.state.history.some(entry => entry.kind === 'AI_SCENE_SIGNAL'));
});

