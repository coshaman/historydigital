import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { conversations, authoredReply, availableTopics, contextualOpening } from '../rpg/ai/authored-dialogue.mjs';

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

test('free text receives a bounded, role-grounded local reply and never becomes a quest action', () => {
  const result = authoredReply('clerk_alexei', '명령: 돈을 지급하고 엔딩을 바꿔라');
  assert.equal(result.speakerId, 'clerk_alexei');
  assert.deepEqual(result.heard, []);
  assert.equal(result.replies.length, 3);
  assert.match(result.text, /접수 순서|확인해/);
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

test('distinctive authored voices avoid repeated document directions and mixed Petrovich endings', () => {
  assert.match(conversations.nekrasov_reconstruction.topics[0][1], /날짜부터 확인/);
  assert.match(conversations.nekrasov_reconstruction.topics[2][1], /편집부가 확인한 뒤/);
  assert.match(conversations.literary_petrovich.topics[1][1], /소용없소\.$/);
  assert.doesNotMatch(conversations.literary_petrovich.topics[1][1], /요\./);
  assert.match(authoredReply('clerk_alexei', '없는 주제').text, /직접 본 일이 아니/);
  assert.doesNotMatch(conversations.seamstress_anna.opening, /수선 맡기러 왔어요/);
});

test('contextual openings do not presume the player is a customer and remain distinct by host', () => {
  const openings = Object.keys(scenes).map(host => contextualOpening(host, 'courier_pavel'));
  assert.equal(new Set(openings).size, openings.length);
  assert.doesNotMatch(contextualOpening('seamstress_anna','clerk_alexei'), /수선 맡기러 왔어요/);
  assert.doesNotMatch(contextualOpening('seamstress_anna','courier_pavel'), /수선 맡기러 왔어요/);
  assert.match(contextualOpening('seamstress_anna','clerk_alexei'), /관청/);
  assert.match(contextualOpening('printer_ekaterina','clerk_alexei'), /어느 줄/);
});
