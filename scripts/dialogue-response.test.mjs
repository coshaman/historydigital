import test from 'node:test';
import assert from 'node:assert/strict';
import { dialogueSessionNeedsReconnect, dialogueSpeakerLabel, mayOfferDiscussionPrompt, selectDialogueTurn, shouldUseAuthoredOfflineReply } from '../rpg/engine/dialogue-response.mjs';

test('a validated AI-mode response is the turn shown and recorded by the game', () => {
  const turn = { sceneId: 'SCENE_A', beats: [{ speakerId: 'editor_sofia', textKo: '원문을 먼저 볼게요.' }], suggestedReplies: [] };
  assert.deepEqual(selectDialogueTurn({ mode: 'AI', fallback: false, aiGenerated: true, turn }), { kind: 'generated', turn });
});

test('narration beats are not attributed to the NPC as spoken dialogue', () => {
  assert.equal(dialogueSpeakerLabel('NARRATION', '예카테리나 벨로바'), '주변 상황');
  assert.equal(dialogueSpeakerLabel('printer_ekaterina', '예카테리나 벨로바'), '예카테리나 벨로바');
});

test('provider fallback and non-AI mode never pass authored fallback as generated dialogue', () => {
  for (const data of [
    { mode: 'AI', fallback: true, providerErrorCode: 'http_429', turn: { textKo: 'fallback' } },
    { mode: 'AI', fallback: false, turn: { textKo: 'unverified' } },
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

test('opinion prompts wait until two ordinary exchanges have grounded the conversation', () => {
  assert.equal(mayOfferDiscussionPrompt(0), false);
  assert.equal(mayOfferDiscussionPrompt(1), false);
  assert.equal(mayOfferDiscussionPrompt(2), true);
});

test('missing credentials and provider failures never substitute authored offline answers', () => {
  for (const apiFailureCode of ['BLOCKED_NO_KEY', 'network_error', 'http_500', 'timeout', 'response_schema_invalid', '']) {
    assert.equal(shouldUseAuthoredOfflineReply({ apiFailureCode }), false, apiFailureCode || 'unknown failure');
  }
  assert.equal(shouldUseAuthoredOfflineReply({ apiFailureCode: 'BLOCKED_NO_KEY', sessionWasLive: true }), false);
});
