import test from 'node:test';
import assert from 'node:assert/strict';
import { dialogueSessionNeedsReconnect, selectDialogueTurn, shouldUseAuthoredOfflineReply } from '../rpg/engine/dialogue-response.mjs';

test('a validated AI-mode response is the turn shown and recorded by the game', () => {
  const turn = { sceneId: 'SCENE_A', beats: [{ speakerId: 'editor_sofia', textKo: '원문을 먼저 볼게요.' }], suggestedReplies: [] };
  assert.deepEqual(selectDialogueTurn({ mode: 'AI', fallback: false, turn }), { kind: 'generated', turn });
});

test('provider fallback and non-AI mode never pass authored fallback as generated dialogue', () => {
  for (const data of [
    { mode: 'AI', fallback: true, providerErrorCode: 'http_429', turn: { textKo: 'fallback' } },
    { mode: 'BLOCKED_NO_KEY', fallback: true, turn: { textKo: 'offline' } },
    { mode: 'AUTHORED', fallback: false, turn: { textKo: 'offline' } },
  ]) {
    const selected = selectDialogueTurn(data);
    assert.equal(selected.kind, 'unavailable');
    assert.equal('turn' in selected, false);
  }
});

test('a transient authored fallback session must reconnect instead of pinning later conversations offline', () => {
  assert.equal(dialogueSessionNeedsReconnect({ token: 'signed-session', mode: 'AUTHORED' }), true);
  assert.equal(dialogueSessionNeedsReconnect({ token: 'signed-session', mode: 'AI' }), false);
  assert.equal(dialogueSessionNeedsReconnect(null), true);
});

test('only an explicit missing API key enables authored offline answers', () => {
  assert.equal(shouldUseAuthoredOfflineReply({ apiFailureCode: 'BLOCKED_NO_KEY' }), true);
  for (const apiFailureCode of ['network_error', 'http_500', 'timeout', 'response_schema_invalid', '']) {
    assert.equal(shouldUseAuthoredOfflineReply({ apiFailureCode }), false, apiFailureCode || 'unknown failure');
  }
  assert.equal(shouldUseAuthoredOfflineReply({ apiFailureCode: 'BLOCKED_NO_KEY', sessionWasLive: true }), false);
});
