import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { availableDiscussionQuests, discussionBoardView, discussionPromptsForHost, discussionQuestInstruction, discussionReflectionPromptsForHost, discussionReplyChoices, formatQueuedDiscussionTaskKo } from '../rpg/engine/discussion-quests.mjs';
import definitions from '../rpg/data/discussion-quests.json' with { type: 'json' };
import { dialogueSceneContext } from '../rpg/engine/dialogue-context.mjs';

const require = createRequire(import.meta.url);
const game = require('../rpg/engine/game-state.js');

test('discussion quests unlock only on or before the campaign date and preserve viewpoint boundaries', () => {
  const state = { world: { date: '1847-06-01' }, ledger: [] };
  const quests = availableDiscussionQuests(state, definitions);
  assert.equal(quests.length, 14, 'only the fourteen inquiries dated by June 1847 are available');
  assert.deepEqual(quests.map(quest => quest.id), [
    'INQUIRY_IDEAS_AND_LIVED_LIFE',
    'INQUIRY_LITERATURE_AND_SERFDOM',
    'INQUIRY_CENSORSHIP_AND_LABOR',
    'INQUIRY_REFORM_AND_LIVED_COST',
    'INQUIRY_WAGES_AND_NEIGHBORHOOD_1847',
    'INQUIRY_PRICE_AND_WORK_1847',
    'INQUIRY_RISK_AND_CHOICE_1847',
    'INQUIRY_PRIVACY_AND_TESTIMONY_1847',
    'INQUIRY_CARE_AND_COST_1847',
    'INQUIRY_AUTHORSHIP_AND_CRAFT_1847',
    'INQUIRY_SCARCITY_AND_PUBLIC_SPACE_1847',
    'INQUIRY_RECORD_AND_AUTHORITY_1847',
    'INQUIRY_PRINT_LABOR_AND_TRUTH_1847',
    'INQUIRY_LEARNING_AND_LIVELIHOOD_1847',
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
  const twoPerspectives = { ...firstView, ledger: [...firstView.ledger, { eventType: 'DIALOGUE_TURN', hostId: 'senior_clerk_konstantin', discussionId: prompt.discussionId }], player: { dialogueGrowth: { comparisonNotes: [{ discussionId: prompt.discussionId }], playerPositions: [], reflectionIds: [] } } };
  const pendingPosition = availableDiscussionQuests(twoPerspectives, definitions).find(item => item.id === prompt.discussionId);
  assert.equal(pendingPosition.completed, false, 'hearing two people opens the final notebook step');
  assert.equal(pendingPosition.positionPending, true);
  const completed = availableDiscussionQuests({ ...twoPerspectives, player: { dialogueGrowth: { ...twoPerspectives.player.dialogueGrowth, playerPositions: [{ discussionId: prompt.discussionId, positionId: 'TEST_POSITION' }] } } }, definitions).find(item => item.id === prompt.discussionId);
  assert.equal(completed.completed, true, 'the quest ends after recording a position');
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

test('automatic opinion prompts stay attached to the live document or event that gives them context', () => {
  const quests = availableDiscussionQuests({ world: { date: '1847-06-01' }, ledger: [] }, definitions);
  const anchored = quests.find(item => item.id === 'INQUIRY_CENSORSHIP_AND_LABOR');
  assert.equal(discussionPromptsForHost('printer_ekaterina', [anchored], { contextQuestId: 'MATRYONA_STREET_STALL_1847_STAGE_1', requireContext: true }).length, 0);
  assert.equal(discussionPromptsForHost('printer_ekaterina', [anchored], { contextQuestId: 'PRINTSHOP_PROOF_1847', requireContext: true }).length, 1);
  const unanchored = quests.find(item => item.id === 'INQUIRY_IDEAS_AND_LIVED_LIFE');
  assert.equal(discussionPromptsForHost('reader_darya', [unanchored], { contextQuestId: 'MATRYONA_STREET_STALL_1847_STAGE_1', requireContext: true }).length, 0);
});

test('the opening opinion quests tell a first-time player what to do before possession', () => {
  const quests = availableDiscussionQuests({ world: { date: '1847-06-01' }, ledger: [] }, definitions);
  const board = discussionBoardView(quests, null, { clerk_alexei: '알렉세이', senior_clerk_konstantin: '콘스탄틴' });
  assert.equal(board.visible, true);
  assert.match(board.progressKo, /쟁점 0\/14/);
  assert.match(board.guidanceKo, /reader_darya에게 말 걸기/);
  assert.match(board.rows[0], /먼저 묻기/);
  assert.match(board.rows[0], /책에서 배운 원칙/);
  assert.equal(board.rows.length, quests.length, 'the board exposes every currently available inquiry, not only the first three');
  assert.equal(board.recommendations.length, quests.length, 'each inquiry has a concrete next character and exact question');
  assert.ok(board.recommendations[0].hostId);
  assert.ok(board.recommendations[0].promptKo);
  assert.match(board.recommendations[0].progressKo, /0\/2 관점/);
  const active = quests.find(item => item.id === 'INQUIRY_CENSORSHIP_AND_LABOR');
  const inConversation = discussionBoardView([active], 'printer_ekaterina', { printer_ekaterina: '예카테리나' });
  assert.match(inConversation.rows[0], /지금 대화 중인 예카테리나에게/);
  assert.match(inConversation.rows[0], /투르게네프/);
  assert.equal(inConversation.recommendations[0].hostId, 'printer_ekaterina');
  assert.match(inConversation.recommendations[0].promptKo, /호리와 칼리니치/);
  const firstPerspective = { ...active, perspectiveHostIds: ['printer_ekaterina'] };
  const nextPerspective = discussionBoardView([firstPerspective], 'clerk_alexei', { clerk_alexei: '알렉세이', senior_clerk_konstantin: '콘스탄틴' });
  assert.match(nextPerspective.rows[0], /1\/2 관점/);
  assert.match(nextPerspective.rows[0], /seamstress_anna에게 같은 쟁점을 물어보세요/);
  assert.match(nextPerspective.guidanceKo, /대상 · seamstress_anna에게 말 걸기/);
  assert.match(nextPerspective.guidanceKo, /물어볼 말 · “호리는 살림을 꾸리고 지주와도 잘 지내지만/);
});

test('a dialogue quest names the next person, exact question, and the action that ends it', () => {
  const quest = {
    id: 'INQUIRY_TEST', titleKo: '빵값을 둘러싼 말', requiredPerspectiveCount: 2,
    perspectiveHostIds: [], positionPending: false,
    hosts: { baker_fyodor: { promptKo: '밀가루 값이 오르면 빵값도 바로 올려야 할까요?' }, buyer_anna: { promptKo: '품삯이 그대로인데 빵값이 오르면 어떻게 버텨야 할까요?' } },
  };
  const first = discussionQuestInstruction(quest, { baker_fyodor: '표도르', buyer_anna: '안나' });
  assert.equal(first.phase, 'ASK');
  assert.equal(first.hostId, 'baker_fyodor');
  assert.match(first.howKo, /표도르에게 말 걸기/);
  assert.match(first.howKo, /“밀가루 값이 오르면 빵값도 바로 올려야 할까요\?”/);
  assert.match(first.howKo, /대화창에서 이 질문을 선택해 답변을 받아야 관점이 기록됩니다/);
  assert.match(first.howKo, /끝내기 · 서로 다른 2명의 답을 들은 뒤 수첩에서 「빵값을 둘러싼 말」의 입장을 하나 선택해 기록하세요/);

  const second = discussionQuestInstruction({ ...quest, perspectiveHostIds: ['baker_fyodor'] }, { baker_fyodor: '표도르', buyer_anna: '안나' });
  assert.equal(second.hostId, 'buyer_anna');
  assert.match(second.howKo, /안나에게 말 걸기/);

  const stance = discussionQuestInstruction({ ...quest, perspectiveHostIds: ['baker_fyodor', 'buyer_anna'], positionPending: true });
  assert.equal(stance.phase, 'RECORD_POSITION');
  assert.match(stance.howKo, /수첩에서 「빵값을 둘러싼 말」에 대한 입장 하나를 기록하세요\. 기록하면 퀘스트가 끝납니다/);
});

test('the final required perspective never points the player to an unnecessary third speaker', () => {
  const quest = {
    id: 'INQUIRY_THREE', titleKo: '세 사람의 견해', requiredPerspectiveCount: 2,
    perspectiveHostIds: ['baker_fyodor'], positionPending: false,
    hosts: {
      baker_fyodor: { promptKo: '빵값을 올려야 할까요?' },
      buyer_anna: { promptKo: '품삯이 그대로인데 빵값이 오르면요?' },
      bookseller_lev: { promptKo: '가게를 유지하려면 무엇부터 줄이겠소?' },
    },
  };
  const instruction = discussionQuestInstruction(quest, { buyer_anna: '안나', bookseller_lev: '레프' });
  assert.equal(instruction.hostId, 'buyer_anna');
  assert.equal(instruction.nextHostNameKo, null, 'after Anna answers, the player records a stance instead of asking Lev');
  const task = formatQueuedDiscussionTaskKo(quest, { hostNameKo: '안나', promptKo: instruction.promptKo });
  assert.match(task, /이 답변으로 필요한 관점이 모이면.*수첩/u);
  assert.doesNotMatch(task, /다른 인물에게 같은 쟁점을 물어/u);
});

test('the active conversation quest gives a numbered, trackable route from context to completion', () => {
  const quest = {
    id: 'INQUIRY_TEST', titleKo: '빵값을 둘러싼 말', situationKo: '밀가루 값이 올라 표도르가 빵값을 다시 정하고 있다.',
    requiredPerspectiveCount: 2, perspectiveHostIds: [],
    hosts: { baker_fyodor: { promptKo: '밀가루 값이 오르면 빵값도 바로 올려야 할까요?' } },
  };
  const task = formatQueuedDiscussionTaskKo(quest, {
    hostNameKo: '표도르', placeKo: '시장', promptKo: quest.hosts.baker_fyodor.promptKo,
  });
  assert.match(task, /지금 할 일 · 1\/3/u);
  assert.match(task, /표도르.*시장/u);
  assert.match(task, /정확히 이 질문.*선택/u);
  assert.match(task, /진행 인정 ·[\s\S]*관점/u);
  assert.match(task, /다른 인물.*같은 쟁점/u);
  assert.match(task, /완료 ·[\s\S]*내 입장.*기록하세요/u);
});

test('a selected opinion quest is sent as an authored dialogue context anchor', () => {
  const quest = definitions.quests.find(item => item.id === 'INQUIRY_CENSORSHIP_AND_LABOR');
  const context = dialogueSceneContext({ id: 'printer_ekaterina' }, { id: 'printer_ekaterina' },
    '1847-06-01', 'printshop', null, [], { id: 'seamstress_anna' }, quest.id);
  assert.equal(context.discussionId, quest.id);
});

test('a queued quest question remains selectable when AI already suggests three replies', () => {
  const prompt = '신문에 적힌 소식이 이 골목 사람들에게 어떤 영향을 줄까요?';
  const replies = discussionReplyChoices(prompt, [
    { textKo: '신문을 먼저 읽어보죠.' },
    { textKo: '사람들 반응부터 살펴봅시다.' },
    { textKo: '다른 이야기를 해보죠.' },
  ]);
  assert.equal(replies.length, 3);
  assert.equal(replies.some(reply => reply.textKo === prompt), true);
  assert.equal(discussionReplyChoices(prompt, replies).filter(reply => reply.textKo === prompt).length, 1);
  assert.equal(discussionReplyChoices(null, replies).length, 3);
});

test('mobile mission tracker keeps the concrete conversation steps visible and scrollable', async () => {
  const css = await readFile(new URL('../rpg/choices.css', import.meta.url), 'utf8');
  const mobileRules = css.split('@media(max-width:760px)')[1]?.split('@media(')[0] ?? '';
  assert.match(mobileRules, /#mission-method\{display:block/);
  assert.match(mobileRules, /#mission-method\{[^}]*overflow-y:auto/);
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
