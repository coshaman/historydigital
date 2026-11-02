import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { conversations, authoredReply, availableTopics, contextualOpening } from '../rpg/ai/authored-dialogue.mjs';

const scenes = JSON.parse(fs.readFileSync(new URL('../rpg/ai/scenes.json', import.meta.url))).sessions;
test('every speakable NPC has a distinct, finite authored conversation with provenance', () => {
  assert.deepEqual(Object.keys(conversations).sort(), Object.keys(scenes).sort());
  for (const [host, conversation] of Object.entries(conversations)) {
    assert.ok(conversation.provenance.length, host);
    assert.ok(conversation.topics.length >= 3, host);
    assert.equal(new Set(conversation.topics.map(([q]) => q)).size, conversation.topics.length, host);
    assert.equal(new Set(conversation.topics.map(([,a]) => a)).size, conversation.topics.length, host);
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
      assert.equal(result.replies.length, conversation.topics.length - heard.length);
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
  assert.equal(result.replies.length, conversations.clerk_alexei.topics.length);
  assert.match(result.text, /접수 순서|확인해/);
  assert.deepEqual(Object.keys(result).sort(), ['complete', 'heard', 'replies', 'speakerId', 'text']);
});

test('topic progress can be isolated by the embodied-player/NPC pair', () => {
  const progress = new Map();
  const first = 'seamstress_anna::printer_ekaterina', second = 'courier_pavel::printer_ekaterina';
  const reply = authoredReply('printer_ekaterina', conversations.printer_ekaterina.topics[0][0], progress.get(first));
  progress.set(first, reply.heard);
  assert.equal(availableTopics('printer_ekaterina', progress.get(first)).length, conversations.printer_ekaterina.topics.length - 1);
  assert.equal(availableTopics('printer_ekaterina', progress.get(second)).length, conversations.printer_ekaterina.topics.length);
});

test('distinctive authored voices avoid repeated document directions and mixed Petrovich endings', () => {
  assert.match(conversations.nekrasov_reconstruction.topics[0][1], /공고에 적힌 날짜/);
  assert.match(conversations.nekrasov_reconstruction.topics[2][1], /절차는 확인 뒤 재발송/);
  assert.match(conversations.literary_petrovich.topics[1][1], /하오\.$/);
  assert.doesNotMatch(conversations.literary_petrovich.topics[1][1], /요\./);
  assert.match(authoredReply('clerk_alexei', '없는 주제').text, /말씀해 주세요|사실을 확인한 뒤/);
  assert.doesNotMatch(conversations.seamstress_anna.opening, /수선 맡기러 왔어요/);
});

test('every historical-life character has a distinct authored fallback for viewpoint questions', () => {
  const samples = {
    clerk_alexei: '상급자 지시와 확인한 사실이 다르면 장부에는 어떻게 적어야 합니까?',
    printer_ekaterina: '검열 뒤에 돌아온 문장은 작업자도 책임져야 할까요?',
    courier_pavel: '봉투 안을 모른 채 전했다면, 전달한 사람은 어디까지 책임져야 합니까?',
    seamstress_anna: '큰 사상 논쟁이 일하는 사람의 하루도 바꿀까요?',
    tenant_mikhail: '가난은 게으른 탓이라고 생각하세요?',
    bookseller_lev: '책값 때문에 못 읽는 사람이 있다면 값을 낮춰야 하오?',
  };
  const answers = Object.entries(samples).map(([host, question]) => authoredReply(host, question).text);
  assert.equal(new Set(answers).size, answers.length);
  assert.match(answers[0], /지시는 누가|확인한 사실/);
  assert.match(answers[3], /품삯|일한 만큼/);
  assert.match(answers[4], /동의 못 하겠어요|일자리/);
  assert.match(answers[5], /인쇄비|종이값/);
});

test('contextual openings do not presume the player is a customer and remain distinct by host', () => {
  const openings = Object.keys(scenes).map(host => contextualOpening(host, 'courier_pavel'));
  assert.equal(new Set(openings).size, openings.length);
  assert.doesNotMatch(contextualOpening('seamstress_anna','clerk_alexei'), /수선 맡기러 왔어요/);
  assert.doesNotMatch(contextualOpening('seamstress_anna','courier_pavel'), /수선 맡기러 왔어요/);
  assert.match(contextualOpening('seamstress_anna','clerk_alexei'), /관청/);
  assert.match(contextualOpening('printer_ekaterina','clerk_alexei'), /어느 줄/);
});

test('editor and police personas have separate registers, viewpoints and discussion-ready authored replies', () => {
  const sofia = authoredReply('editor_sofia', conversations.editor_sofia.topics[0][0]);
  const ivan = authoredReply('police_sergeant_ivan', conversations.police_sergeant_ivan.topics[0][0]);
  assert.match(sofia.text, /제목|편집/);
  assert.match(ivan.text, /위험|감시/);
  assert.notEqual(sofia.text, ivan.text);
  assert.match(conversations.editor_sofia.opening, /인쇄/);
  assert.match(conversations.police_sergeant_ivan.opening, /보신 일인지/);
  assert.ok(conversations.editor_sofia.provenance.length && conversations.police_sergeant_ivan.provenance.length);
});
