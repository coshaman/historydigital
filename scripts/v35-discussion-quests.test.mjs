import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { availableDiscussionQuests, discussionBoardView, discussionPromptsForHost, discussionReflectionPromptsForHost } from '../rpg/engine/discussion-quests.mjs';
import definitions from '../rpg/data/discussion-quests.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const game = require('../rpg/engine/game-state.js');

test('discussion quests unlock by campaign date and preserve fictional viewpoint boundaries', () => {
  const state = { world: { date: '1847-06-01' }, ledger: [] };
  const quests = availableDiscussionQuests(state, definitions);
  assert.equal(quests.length, 6, 'six viewpoint missions are available from the opening date');
  assert.deepEqual(quests.map(quest => quest.id), [
    'INQUIRY_OFFICIAL_DUTY_AND_MORALITY',
    'INQUIRY_IDEAS_AND_LIVED_LIFE',
    'INQUIRY_LITERATURE_AND_SERFDOM',
    'INQUIRY_CENSORSHIP_AND_LABOR',
    'INQUIRY_CENSORSHIP_AND_PUBLIC_ORDER',
    'INQUIRY_REFORM_AND_LIVED_COST',
  ]);
  assert.equal(definitions.historicalBoundaryKo.includes('실제 발언'), true);
  assert.equal(quests.every(quest => quest.sourceIds.every(sourceId => typeof sourceId === 'string')), true);
});

test('opinion quests collect two distinct character perspectives before comparison and unlock a follow-up', () => {
  const state = { world: { date: '1849-04-22' }, ledger: [] };
  const alexei = availableDiscussionQuests(state, definitions);
  const prompt = discussionPromptsForHost('clerk_alexei', alexei).find(item => item.discussionId === 'INQUIRY_RECORD_AND_RUMOR');
  assert.match(prompt.promptKo, /서기|상급자/);
  const firstView = { ...state, ledger: [{ eventType: 'DIALOGUE_TURN', hostId: 'clerk_alexei', discussionId: prompt.discussionId }] };
  const inProgress = availableDiscussionQuests(firstView, definitions).find(item => item.id === prompt.discussionId);
  assert.equal(inProgress.completed, false);
  assert.equal(inProgress.perspectiveHostIds.length, 1);
  assert.equal(discussionPromptsForHost('clerk_alexei', [inProgress]).length, 0, 'the same character cannot be counted twice');
  assert.equal(discussionPromptsForHost('courier_pavel', [inProgress]).length, 1, 'the second perspective remains available');
  const completed = availableDiscussionQuests({ ...firstView, ledger: [...firstView.ledger, { eventType: 'DIALOGUE_TURN', hostId: 'senior_clerk_konstantin', discussionId: prompt.discussionId }] }, definitions).find(item => item.id === prompt.discussionId);
  assert.equal(completed.completed, true);
  const stateWithNote = { ...state, player: { dialogueGrowth: { comparisonNotes: [{ discussionId: prompt.discussionId }], reflectionIds: [] } } };
  assert.equal(discussionReflectionPromptsForHost('clerk_alexei', stateWithNote, [completed]).length, 1);
  stateWithNote.player.dialogueGrowth.reflectionIds.push(`${prompt.discussionId}::clerk_alexei`);
  assert.equal(discussionReflectionPromptsForHost('clerk_alexei', stateWithNote, [completed]).length, 0, 'follow-up prompts are one-time per character');
  assert.equal(availableDiscussionQuests({ ...state, ledger: [{ eventType: 'DIALOGUE_TURN' }] }, definitions).find(item => item.id === prompt.discussionId).completed, false);
});

test('new press and public-safety opinion missions name the concrete dispute and playable speakers', () => {
  const quests = availableDiscussionQuests({ world: { date: '1849-04-22' }, ledger: [] }, definitions);
  const press = quests.find(item => item.id === 'INQUIRY_NEWS_AND_PUBLIC_TRUTH');
  const safety = quests.find(item => item.id === 'INQUIRY_SAFETY_AND_RECORDS');
  assert.ok(press && safety);
  assert.match(press.stakesKo, /제목|독자|인쇄/);
  assert.ok(press.hosts.editor_sofia && press.hosts.bookseller_lev && press.hosts.reader_darya);
  assert.match(safety.stakesKo, /실제 보고서|개인의 권리/);
  assert.ok(safety.hosts.police_sergeant_ivan && safety.hosts.senior_clerk_konstantin);
  assert.deepEqual(press.sourceIds, ['OBJ-WS-NEKRASOV-EDITORIAL-1848']);
  assert.deepEqual(safety.sourceIds, ['OBJ-WS-PETRASHEVSKY-REPORT-1849']);
});

test('new philosophy and event inquiries have actionable questions for distinct social viewpoints', () => {
  const quests = availableDiscussionQuests({ world: { date: '1849-04-22' }, ledger: [] }, definitions);
  const reform = quests.find(item => item.id === 'INQUIRY_REFORM_AND_LIVED_COST');
  const liberty = quests.find(item => item.id === 'INQUIRY_PUBLIC_ORDER_AND_LIBERTY');
  const witness = quests.find(item => item.id === 'INQUIRY_WITNESS_AND_JUDGMENT');
  assert.ok(reform && liberty && witness);
  assert.match(reform.stakesKo, /품삯|책값|배움/);
  assert.match(liberty.titleKo, /질서와 자유/);
  assert.match(witness.stakesKo, /직접 본 일|전해 들은 말/);
  assert.ok(witness.hosts.courier_pavel && witness.hosts.clerk_alexei && witness.hosts.printer_ekaterina);
  assert.equal(witness.sourceIds.every(sourceId => typeof sourceId === 'string'), true);
});

test('the opening opinion quests tell a first-time player what to do before possession', () => {
  const quests = availableDiscussionQuests({ world: { date: '1847-06-01' }, ledger: [] }, definitions);
  const board = discussionBoardView(quests, null, { clerk_alexei: '알렉세이', senior_clerk_konstantin: '콘스탄틴' });
  assert.equal(board.visible, true);
  assert.match(board.progressKo, /사건·사상 견해 조사/);
  assert.match(board.guidanceKo, /빙의해 대화하고.*같은 쟁점을 한 번 더/);
  assert.match(board.rows[0], /먼저 묻기/);
  assert.match(board.rows[0], /명령이 절차에 맞더라도 결과가 부당/);
  assert.match(board.rows.join(' '), /알렉세이|콘스탄틴/);
  assert.equal(board.rows.length, quests.length, 'the board exposes every currently available inquiry, not only the first three');
  const active = quests.find(item => item.id === 'INQUIRY_OFFICIAL_DUTY_AND_MORALITY');
  const inConversation = discussionBoardView([active], 'clerk_alexei', { clerk_alexei: '알렉세이' });
  assert.match(inConversation.rows[0], /지금 대화 중인 알렉세이에게/);
  assert.match(inConversation.rows[0], /결재선/);
  const firstPerspective = { ...active, perspectiveHostIds: ['clerk_alexei'] };
  const nextPerspective = discussionBoardView([firstPerspective], 'clerk_alexei', { clerk_alexei: '알렉세이', senior_clerk_konstantin: '콘스탄틴' });
  assert.match(nextPerspective.rows[0], /1\/2 관점/);
  assert.match(nextPerspective.rows[0], /콘스탄틴에게 같은 쟁점을 물어보세요/);
});

test('an authored offline answer still records the asked perspective without claiming AI generation', () => {
  const ids = ['clerk_alexei', 'printer_ekaterina'];
  const map = { mapId: 'nevsky', width: 5, height: 5, metadata: { observerStart: { x: 0, y: 0 } }, layers: [
    { name: 'Collision', width: 5, height: 5, data: Array(25).fill(0) },
    { name: 'NPCs', objects: ids.map((id, index) => ({ id: index + 1, properties: [{ name: 'hostId', value: id }] })) },
    { name: 'Interactions', objects: [] },
  ] };
  const maps = { nevsky: map };
  const hostCards = ids.map((id, index) => ({ id, kind: 'FICTIONAL', start: { mapId: 'nevsky', x: index + 1, y: 1 }, allowedMaps: ['nevsky'], schedule: [], money: { amount: 10 }, inventory: [], privateKnowledgeIds: [], knownEvidenceIds: [] }));
  const state = game.createInitialState({ maps, hostCards });
  state.player.embodiment = ids[0];
  state.hosts[ids[0]].position = { x: 1, y: 1 };
  state.hosts[ids[1]].position = { x: 2, y: 1 };
  const first = game.recordDialogueTurn(state, { hostId: ids[1], actorHostId: ids[0], sceneId: 'V33_TEST_SCENE', discussionId: 'INQUIRY_OFFICIAL_DUTY_AND_MORALITY', discussionTitleKo: '절차와 책임', aiGenerated: false }, maps);
  assert.equal(first.ok, true);
  assert.equal(first.state.player.dialogueGrowth.aiReplies, 0);
  assert.equal(first.state.player.dialogueGrowth.insight, 1);
  assert.equal(first.state.ledger.at(-1).discussionId, 'INQUIRY_OFFICIAL_DUTY_AND_MORALITY');
  assert.equal(first.state.ledger.at(-1).aiGenerated, undefined);
  const secondState = structuredClone(first.state);
  secondState.player.embodiment = ids[1];
  const second = game.recordDialogueTurn(secondState, { hostId: ids[0], actorHostId: ids[1], sceneId: 'V33_TEST_SCENE', discussionId: 'INQUIRY_OFFICIAL_DUTY_AND_MORALITY', discussionTitleKo: '절차와 책임', aiGenerated: false }, maps);
  assert.equal(second.state.player.dialogueGrowth.comparisonNotes.length, 1);
  assert.equal(second.state.ledger.at(-1).dialogueReward, 'COMPARISON_NOTE');
});
