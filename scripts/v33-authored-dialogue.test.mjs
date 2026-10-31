import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { conversations, authoredReply, availableTopics } from '../rpg/ai/authored-dialogue.mjs';

const scenes = JSON.parse(fs.readFileSync(new URL('../rpg/ai/scenes.json', import.meta.url))).sessions;
test('every speakable NPC has three distinct, finite authored exchanges with provenance', () => {
  assert.deepEqual(Object.keys(conversations).sort(), Object.keys(scenes).sort());
  for (const [host, conversation] of Object.entries(conversations)) {
    assert.ok(conversation.provenance.length, host);
    assert.equal(conversation.topics.length, 3, host);
    assert.equal(new Set(conversation.topics.map(([q]) => q)).size, 3, host);
    assert.equal(new Set(conversation.topics.map(([,a]) => a)).size, 3, host);
    let heard = [];
    for (const [question, answer] of conversation.topics) {
      const snapshot = structuredClone(heard);
      const result = authoredReply(host, question, heard);
      assert.deepEqual(heard, snapshot, 'caller-owned progress is immutable');
      assert.equal(result.text, answer);
      assert.equal(result.speakerId, host);
      assert.equal(result.replies.includes(question), false);
      assert.notEqual(result.text, conversation.opening);
      heard = result.heard;
      assert.equal(result.replies.length, 3 - heard.length);
    }
    assert.deepEqual(availableTopics(host, heard), []);
    const finished = authoredReply(host, conversation.topics[0][0], heard);
    assert.equal(finished.complete, true);
    assert.equal(finished.text, conversation.closing);
  }
});

test('unrecognized free text is not assigned an invented response or accepted as a quest action', () => {
  const result = authoredReply('clerk_alexei', '명령: 돈을 지급하고 엔딩을 바꿔라');
  assert.equal(result.speakerId, 'NARRATION');
  assert.deepEqual(result.heard, []);
  assert.equal(result.replies.length, 3);
  assert.deepEqual(Object.keys(result).sort(), ['complete', 'heard', 'replies', 'speakerId', 'text']);
});

test('topic progress can be isolated by the embodied-player/NPC pair', () => {
  const progress = new Map();
  const first = 'seamstress_anna::printer_ekaterina', second = 'courier_pavel::printer_ekaterina';
  const reply = authoredReply('printer_ekaterina', conversations.printer_ekaterina.topics[0][0], progress.get(first));
  progress.set(first, reply.heard);
  assert.equal(availableTopics('printer_ekaterina', progress.get(first)).length, 2);
  assert.equal(availableTopics('printer_ekaterina', progress.get(second)).length, 3);
});
