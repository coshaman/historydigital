import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const { purchaseCityProduct, publishNewspaperIssue, circulateNewspaperIssue, commitSuspiciousAct } = await import('../rpg/engine/civic-life.mjs');
const { CIVIC_REACTION_FAMILY_COUNT, formatCivicReaction, formatObservedNpcReactions, OBSERVED_NPC_REACTION_FAMILY_COUNT } = await import('../rpg/engine/world-reaction-presentation.mjs');
const readJson = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const map = await readJson(`../rpg/maps/${file}`);
  return [map.mapId, map];
})));
const ids = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const hostCards = await Promise.all(ids.map(file => readJson(`../rpg/characters/${file}`)));
const state = game.createInitialState({ maps, hostCards, startMapId: 'nevsky' });
const playerPosition = { ...state.player.position };

assert.equal(game.playerCanObserveWorldEvent(state, 'nevsky', playerPosition), true,
  'an event at the player tile in the current district is observable');
assert.equal(game.playerCanObserveWorldEvent(state, 'nevsky', { x: playerPosition.x + 7, y: playerPosition.y }), false,
  'an event beyond the observation radius is not disclosed');
assert.equal(game.playerCanObserveWorldEvent(state, 'market-quay', playerPosition), false,
  'an event in another district is not disclosed');

const alexei = state.hosts.clerk_alexei;
alexei.mapId = 'nevsky'; alexei.position = { ...playerPosition };
const possessed = game.possessHost(state, alexei.id, maps.nevsky);
assert.equal(possessed.ok, true);
assert.equal(game.playerCanObserveWorldEvent(possessed.state, 'nevsky', alexei.position), true,
  'observation follows the player while embodied');

function simulateDelivery(observerMapId, observerPosition) {
  const next = game.createInitialState({ maps, hostCards, startMapId: observerMapId });
  next.player.position = { ...observerPosition };
  const sender = next.hosts.courier_pavel, recipient = next.hosts.clerk_alexei;
  sender.mapId = recipient.mapId = 'nevsky';
  sender.position = { x: 12, y: 12 }; recipient.position = { x: 13, y: 12 };
  sender.inventory.push('시험 봉투');
  sender.schedule = [{ atMinute: 540, mapId: 'nevsky', position: { ...sender.position }, activityKo: '봉투를 건넨다', task: {
    id: 'OBSERVATION_TEST_DELIVERY', type: 'DELIVER', recipientHostId: recipient.id, itemKo: '시험 봉투' } }];
  recipient.schedule = [{ atMinute: 540, mapId: 'nevsky', position: { ...recipient.position }, activityKo: '봉투를 받는다' }];
  return game.advanceNpcWorld(next, 1, maps).ledger.flatMap(entry => entry.deliveries ?? [])
    .find(item => item.taskId === 'OBSERVATION_TEST_DELIVERY');
}
const witnessedDelivery = simulateDelivery('nevsky', { x: 11, y: 12 });
const unwitnessedDelivery = simulateDelivery('market-quay', { x: 11, y: 12 });
assert.equal(witnessedDelivery?.witnessedByPlayer, true, 'nearby delivery records a player observation');
assert.equal(unwitnessedDelivery?.witnessedByPlayer, false, 'the same delivery elsewhere stays unknown to the player');

const routineWorld = game.createInitialState({ maps, hostCards, startMapId: 'nevsky' });
const nearbyWorker = routineWorld.hosts.clerk_alexei;
nearbyWorker.mapId = 'nevsky';
nearbyWorker.position = { ...routineWorld.player.position };
nearbyWorker.schedule = [{ atMinute: 540, mapId: 'nevsky', position: { ...nearbyWorker.position }, activityKo: '장부를 정리한다' }];
const routineResult = game.advanceNpcWorld(routineWorld, 6, maps);
const routineEntry = routineResult.ledger.find(entry => entry.eventType === 'NPC_SIMULATION');
assert.ok(routineEntry?.stateChanges?.some(change => change.hostId === nearbyWorker.id && change.witnessedByPlayer),
  'the player can witness and record an NPC beginning a routine');

const mainSource = await readFile(new URL('../rpg/main.js', import.meta.url), 'utf8');

const reactionResidents = hostCards.map(card => ({ id: card.id, displayNameKo: card.displayNameKo }));
const visibleNpcReactions = formatObservedNpcReactions([{
  date: '1847-06-01', eventType: 'NPC_SIMULATION',
  stateChanges: [{ hostId: 'clerk_alexei', from: 'IDLE', to: 'WORKING', activityKo: '접수 장부를 편다', witnessedByPlayer: true }],
  moves: [{ hostId: 'courier_pavel', viaExit: 'NEVSKY_TO_PRINTSHOP', activityKo: '인쇄소로 향함', witnessedByPlayer: true }],
  personalGoalVisits: [{ hostId: 'printer_ekaterina', activityKo: '교정쇄를 확인한다', stage: 1, witnessedByPlayer: true }],
  personalContacts: [{ hostId: 'seamstress_anna', partnerHostId: 'tenant_mikhail', witnessedByPlayer: true }],
  deliveries: [{ hostId: 'courier_pavel', recipientHostId: 'clerk_alexei', itemKo: '교정쇄', witnessedByPlayer: true }],
  exchanges: [{ hostId: 'baker_fyodor', recipientHostId: 'market_nadezhda', itemKo: '빵 한 묶음', witnessedByPlayer: true }],
  payments: [{ hostId: 'tenant_mikhail', payerHostId: 'carter_roman', amount: 3, unit: 'kopeks', witnessedByPlayer: true }],
  housing: [{ kind: 'RENT_PAID', hostId: 'tenant_mikhail', landlordHostId: 'landlady_polina', amount: 3, unit: 'kopeks', witnessedByPlayer: true }],
  meals: [{ hostId: 'market_nadezhda', itemKo: '빵', witnessedByPlayer: true }],
  restRecoveries: [{ hostId: 'porter_gavrila', witnessedByPlayer: true }],
  workOutputs: [{ hostId: 'clerk_alexei', outputKo: '접수부에 문서 번호와 도착 시각을 적음', witnessedByPlayer: true }],
  goals: [{ hostId: 'clerk_alexei', activityKo: '내부 목표일 뿐 세계 행동은 아님', witnessedByPlayer: true }],
}, {
  date: '1847-06-01', eventType: 'NPC_SIMULATION',
  stateChanges: [{ hostId: 'clerk_alexei', activityKo: '다른 구역의 비공개 행동', witnessedByPlayer: false }],
}], reactionResidents);
assert.equal(OBSERVED_NPC_REACTION_FAMILY_COUNT, 13,
  'only witnessed physical or social resident outcomes count; internal plan selection is excluded');
assert.equal(visibleNpcReactions.length, 11,
  'the same formatter used by the journal renders each witnessed outcome family once');
assert.ok(visibleNpcReactions.some(line => line.includes('접수 장부를 편다')));
assert.ok(!visibleNpcReactions.some(line => line.includes('내부 목표일 뿐') || line.includes('비공개 행동')),
  'internal goal selection and events outside player observation are neither counted nor disclosed');

const purchaseWorld = game.createInitialState({ maps, hostCards, startMapId: 'nevsky' });
const purchaseHost = purchaseWorld.hosts.clerk_alexei, moneyBeforePurchase = purchaseHost.money.amount;
const purchase = purchaseCityProduct(purchaseWorld, { hostId: purchaseHost.id, productId: 'newsprint_sheet' });
assert.equal(purchase.ok, true);
assert.equal(purchase.state.hosts[purchaseHost.id].money.amount, moneyBeforePurchase - purchase.product.priceKopeks,
  'a recorded shop purchase changes the resident wallet');
assert.ok(purchase.state.hosts[purchaseHost.id].inventory.includes('newsprint_sheet'),
  'a recorded shop purchase changes carried stock');

const publicationWorld = game.createInitialState({ maps, hostCards, startMapId: 'printshop' });
const editor = publicationWorld.hosts.printer_ekaterina;
editor.mapId = 'printshop';
editor.knownEvidenceIds.push('LIT-TURGENEV-KHOR-KALYNYCH-1847');
editor.inventory.push('newsprint_sheet', 'printing_ink');
const publication = publishNewspaperIssue(publicationWorld, { hostId: editor.id, storyId: 'LITERARY_RURAL_LIFE_1847' });
assert.equal(publication.ok, true);
assert.ok(!publication.state.hosts[editor.id].inventory.includes('newsprint_sheet')
  && !publication.state.hosts[editor.id].inventory.includes('printing_ink'),
  'printing consumes supplies and creates an issue');
assert.equal(publication.state.player.civic.publishedIssues.length, 1);

const circulationWorld = game.createInitialState({ maps, hostCards, startMapId: 'nevsky' });
circulationWorld.player.civic.publishedIssues.push({ id: 'OBSERVATION_ISSUE', titleKo: '시험 호외', storyId: 'LITERARY_RURAL_LIFE_1847' });
circulationWorld.hosts.clerk_alexei.inventory.push('newspaper_issue:OBSERVATION_ISSUE');
const circulation = circulateNewspaperIssue(circulationWorld, { hostId: 'clerk_alexei', issueId: 'OBSERVATION_ISSUE', route: 'street' });
assert.equal(circulation.ok, true);
assert.ok(!circulation.state.hosts.clerk_alexei.inventory.includes('newspaper_issue:OBSERVATION_ISSUE'),
  'public circulation removes the issue from office stock');
assert.equal(circulation.state.player.civic.circulatedIssues.at(-1).route, 'street',
  'public circulation records the new audience');

const custodyWorld = game.createInitialState({ maps, hostCards, startMapId: 'nevsky' });
const custodyHost = custodyWorld.hosts.courier_pavel;
const embodied = game.possessHost(custodyWorld, custodyHost.id, maps.nevsky);
assert.equal(embodied.ok, true);
const custody = commitSuspiciousAct(embodied.state, { hostId: custodyHost.id, actId: 'OPEN_SEALED_DISPATCH', witnessIds: ['printer_ekaterina'], maps });
assert.equal(custody.ok, true);
assert.equal(custody.arrested, true);
assert.equal(custody.state.player.civic.custody.active, true,
  'a witnessed act produces an explicit police response');

const civicOutcomes = [
  purchase.state.ledger.find(entry => entry.eventType === 'CITY_PURCHASE'),
  publication.state.ledger.find(entry => entry.eventType === 'NEWSPAPER_PUBLISHED'),
  circulation.state.ledger.find(entry => entry.eventType === 'NEWSPAPER_CIRCULATED'),
  custody.state.ledger.find(entry => entry.eventType === 'POLICE_CUSTODY'),
];
assert.equal(CIVIC_REACTION_FAMILY_COUNT, 4,
  'four distinct civic outcomes count toward the world-change gate');
assert.ok(civicOutcomes.every(Boolean), 'each civic outcome is produced by its real game reducer');
const civicLines = civicOutcomes.map(entry => formatCivicReaction(entry, {
  productName: id => id === 'newsprint_sheet' ? '신문용 종이 한 묶음' : id,
  storyName: id => id === 'LITERARY_RURAL_LIFE_1847' ? '농촌의 두 사람을 그린 글' : id,
  residentName: id => reactionResidents.find(item => item.id === id)?.displayNameKo ?? '주민',
}));
assert.deepEqual(civicLines.map(line => line.slice(line.indexOf(' · ') + 3).split(' · ')[0]), [
  '가판대에서 신문용 종이 한 묶음 구입', '신문 인쇄', '신문 배포', '경찰 접수·연행',
]);
assert.match(mainSource, /formatObservedNpcReactions\(state\.ledger, cards\)/,
  'the journal renders observed world outcomes through the audited formatter');
assert.match(mainSource, /formatCivicReaction\(entry/,
  'civic outcomes use the same formatter exercised by this test');

console.log(JSON.stringify({ status: 'PASS', currentDistrictAndRangeRequired: true,
  embodiedPlayerPositionUsed: true, witnessedDelivery: true, remoteDeliveryWithheld: true,
  witnessedRoutineChange: true, internalGoalsExcludedFromWorldChangeCount: true,
  witnessedNpcOutcomeFamilies: OBSERVED_NPC_REACTION_FAMILY_COUNT,
  reducerProducedAndJournalFormattedCivicOutcomeFamilies: CIVIC_REACTION_FAMILY_COUNT,
  independentlyFormattedVisibleWorldChangeFamilies: OBSERVED_NPC_REACTION_FAMILY_COUNT + CIVIC_REACTION_FAMILY_COUNT }));
