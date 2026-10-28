import assert from 'node:assert/strict';
import test from 'node:test';
import { handleTurn } from '../ai/http/turn-handler.js';
import scenarios from '../narrative/LATE_GAME_SCENARIOS.json' with { type: 'json' };

const scene = scenarios.scenes[1];
let runId = 0;

for (const [name, failure] of [['429', () => { throw new Error('provider request failed (429)'); }], ['500', () => { throw new Error('provider request failed (500)'); }], ['timeout', () => { throw new Error('provider request timed out'); }], ['malformed output', () => ({ schemaVersion: 'invalid', unknownEnding: 'NEW' })]]) {
  test(`${name} provider outage retries once and keeps a bounded fallback turn playable`, async () => {
    let calls = 0;
    const body = { sessionId: `outage-session-${String(++runId).padStart(8, '0')}`, sceneId: scene.id, turnIndex: 1, playerInput: '책장을 살펴볼게요.' };
    const result = await handleTurn({ method: 'POST', origin: 'https://game.example', body }, { provider: { generate: async () => { calls++; return failure(); } }, config: { allowedOrigins: ['https://game.example'] } });
    assert.equal(calls, 2);
    assert.equal(result.status, 200);
    assert.equal(result.body.fallback, true);
    assert.equal(result.body.summary, '');
    assert.ok(result.body.turn.beats[0].textKo.length > 0);
  });
}
