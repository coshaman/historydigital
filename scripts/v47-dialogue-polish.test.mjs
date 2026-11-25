import test from 'node:test';
import assert from 'node:assert/strict';
import { conversations } from '../rpg/ai/authored-dialogue.mjs';
import { v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';

const questById = new Map(toV47StoryQuests().map(quest => [quest.id, quest]));

test('MAIN01 Talnikov exchange names the child’s concrete experience', () => {
  const dialogue = questById.get('V47_MAIN01_A03').dialogue;
  const lines = dialogue
    .filter(turn => turn.speakerKo === '파나예바').map(turn => turn.lineKo);
  const sceneText = dialogue.map(turn => turn.lineKo).join('\n');
  assert.match(sceneText, /아이/);
  assert.match(sceneText, /집|방/);
  assert.match(sceneText, /유모/);
  assert.doesNotMatch(lines.join('\n'), /맡기기 어려워/,
    'Panayeva discusses the child’s documented perspective without inventing a child-care judgment');
});

test('MAIN03 Vasily answers the question about the proclamation wording', () => {
  const turns = questById.get('V47_MAIN03_P01').dialogue;
  const question = turns.findIndex(turn => turn.lineKo.includes('어떤 말이 제일 걸렸어요'));
  assert.ok(question >= 0);
  assert.match(turns[question + 1].lineKo, /“반란과 무질서”/);
  assert.match(turns[question + 1].lineKo, /왜 거리로 나왔는지/);
});

test('Panaev speaks naturally about the promised but unavailable subscriber copy', () => {
  const quest = v47StoryQuests.find(item => item.id === 'V47_MAIN01_SUBSCRIBER_REPLY');
  assert.equal(quest.dialogue[0].lineKo, '구독자에게 보내기로 했소. 그런데 지금 내 손엔 보낼 책이 없소.');
});

test('Petrashevsky, Antonelli, and Liprandi speak from their situation, not as evidence instructions', () => {
  const people = ['petrashevsky_1849', 'antonelli_1849', 'liprandi_1849'].map(id => conversations[id]);
  const lines = people.flatMap(person => [person.opening, person.closing, ...person.topics.flat()]);
  assert.ok(lines.every(line => !/보고서의 날짜부터|따로 적으시오|순서를 지켜 읽으시오|어느 쪽을 묻소/.test(line)));
  assert.match(conversations.antonelli_1849.opening, /집 바깥에서 사람들을 봤소/);
  assert.match(conversations.liprandi_1849.opening, /4월 22일/);
  assert.doesNotMatch(conversations.liprandi_1849.closing, /서른일곱/);
});
