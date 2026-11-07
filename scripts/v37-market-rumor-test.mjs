import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { dialogueSceneContext } from '../rpg/engine/dialogue-context.mjs';
import { newspaperAssignment, purchaseCityProduct, publishNewspaperIssue, circulateNewspaperIssue, readNewspaperIssue } from '../rpg/engine/civic-life.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, e13Quest, e23Quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/market-price-dispute-1847.json'), read('../rpg/quests/market-rumor-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const market = maps['market-quay'];
const e13Object = market.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === e13Quest.entry.objectId);
const rumorObject = market.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === e23Quest.entry.objectId);
assert.ok(e13Object && rumorObject, 'both chained events use visible physical market objects');
assert.equal(objectIsPresent(rumorObject, { world: { chapterId: 'V33_1847_PRINT', date: '1847-06-01', livingEventStates: { E23: { status: 'ACTIVE' } } } }, [e23Quest]), true);

const state = game.createInitialState({ maps, hostCards: cards, quests: [e13Quest, e23Quest], startMapId: 'market-quay' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 601;
state.world.currentMapId = 'market-quay'; state.player.embodiment = null;
const seller = state.hosts.market_nadezhda, buyer = state.hosts.porter_gavrila;
const stall = { x: e13Object.x / 16, y: e13Object.y / 16 };
seller.mapId = 'market-quay'; seller.position = { ...stall };
buyer.mapId = 'market-quay'; buyer.position = { x: stall.x + 1, y: stall.y };
state.hosts.street_vendor_matryona.mapId = 'market-quay'; state.hosts.street_vendor_matryona.position = { x: 22, y: 10 };
state.hosts.clerk_alexei.mapId = 'market-quay'; state.hosts.clerk_alexei.position = { x: 21, y: 10 };
buyer.needs.hunger = 94; buyer.money.amount = 10;
buyer.needs.lastMealAtMinute = null;
buyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: 'TEST_E23_TRIGGER_SALE' };
seller.marketStock['빵 한 묶음'] = 1;
state.world.marketPriceModifiers['market_nadezhda:빵 한 묶음'] = 1;
state.world.livingEventStates.E02 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E02', status: 'ACTIVE', stage: 'RESTOCKED',
  startedAtMinute: 540, restockedAtMinute: 600, buyerHostId: 'baker_fyodor', sellerHostId: 'market_nadezhda', supplierHostId: 'baker_fyodor',
  itemKo: '빵 한 묶음', basePrice: 1, currentPrice: 2, valueStatus: 'fictional_gameplay_balance', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
const sale = game.advanceNpcWorld(state, 1, maps);
assert.equal(sale.world.livingEventStates.E13?.stage, 'PRICE_CHALLENGE', 'E23 must follow the actual E02-adjusted sale and E13 complaint flow');
const complaintState = structuredClone(sale);
complaintState.world.currentMapId = 'market-quay';
complaintState.player.embodiment = buyer.id; complaintState.player.position = { ...complaintState.hosts[buyer.id].position };
const filed = game.performQuestAction(complaintState, { questId: e13Quest.id, hostId: buyer.id,
  actionId: 'E13_FILE_PRICE_COMPLAINT', objectId: e13Quest.entry.objectId }, { quests: [e13Quest, e23Quest], maps });
assert.equal(filed.ok, true, 'the real price complaint opens the downstream rumor');
const active = filed.state, event = active.world.livingEventStates.E23;
assert.equal(event.stage, 'RUMOR_ACTIVE');
assert.equal(event.sourceCatalogEventId, 'E13');
assert.equal(event.claimStatus, 'UNVERIFIED');
assert.ok(active.hosts.street_vendor_matryona.knownRumors.some(row => row.eventId === 'E23' && row.status === 'UNVERIFIED'));
assert.equal(active.world.marketPriceComplaintRecords.length, 1, 'the official complaint remains a separate record');
assert.equal(objectIsPresent(rumorObject, active, [e23Quest]), true, 'the rumor note appears only after the causal trigger');
const moved = game.advanceNpcWorld(active, 40, maps);
assert.equal(moved.hosts.street_vendor_matryona.mapId, 'market-quay');
assert.ok(Math.abs(moved.hosts.street_vendor_matryona.position.x - event.scenePosition.x)
  + Math.abs(moved.hosts.street_vendor_matryona.position.y - event.scenePosition.y) <= 2,
  'the hawker physically approaches the rumor scene under a deterministic event goal');
assert.ok(Math.abs(moved.hosts.clerk_alexei.position.x - event.scenePosition.x)
  + Math.abs(moved.hosts.clerk_alexei.position.y - event.scenePosition.y) <= 2,
  `the clerk physically comes to compare the rumor with the filed record: ${JSON.stringify({ before: active.hosts.clerk_alexei.position, after: moved.hosts.clerk_alexei.position, goal: moved.hosts.clerk_alexei.activeGoal, minute: moved.world.clockMinutes })}`);
assert.deepEqual(questChoices(e23Quest, 'clerk_alexei', [], moved).map(row => row.action.id), ['E23_CHECK_MARKET_RECORD', 'E23_IGNORE_RUMOR']);
assert.deepEqual(questChoices(e23Quest, 'street_vendor_matryona', [], moved).map(row => row.action.id), ['E23_REPEAT_RUMOR', 'E23_CORRECT_RUMOR', 'E23_IGNORE_RUMOR']);
assert.deepEqual(questChoices(e23Quest, 'reader_darya', [], moved), [], 'unrelated residents cannot steer either role');
assert.equal(game.stateHash(game.loadGame(game.saveGame(moved), { maps, hostCards: cards })), game.stateHash(moved), 'active rumor and carrier goal survive save/load');

function atRumorScene(source, hostId) {
  const branch = structuredClone(source), pos = { ...event.scenePosition };
  branch.world.currentMapId = 'market-quay';
  for (const id of [event.carrierHostId, event.clerkHostId, event.sellerHostId, event.witnessHostIds[0]].filter(Boolean)) {
    branch.hosts[id].mapId = 'market-quay'; branch.hosts[id].position = { ...pos };
  }
  branch.player.embodiment = hostId; branch.player.position = { ...pos };
  return branch;
}
for (const [actionId, hostId, stage] of [
  ['E23_CHECK_MARKET_RECORD', 'clerk_alexei', 'PRICE_CHECKED_UNVERIFIED'],
  ['E23_REPEAT_RUMOR', 'street_vendor_matryona', 'FORWARDED_UNVERIFIED'],
  ['E23_CORRECT_RUMOR', 'street_vendor_matryona', 'CORRECTION_SPREAD'],
  ['E23_SEND_TO_PRESS', 'editor_sofia', 'EDITORIAL_NOTE_TAKEN'],
  ['E23_IGNORE_RUMOR', 'clerk_alexei', 'IGNORED_UNCHECKED'],
]) {
  const branch = atRumorScene(moved, hostId);
  if (hostId === 'editor_sofia') { branch.hosts.editor_sofia.mapId = 'market-quay'; branch.hosts.editor_sofia.position = { ...event.scenePosition }; }
  const result = game.performQuestAction(branch, { questId: e23Quest.id, hostId, actionId, objectId: e23Quest.entry.objectId }, { quests: [e13Quest, e23Quest], maps });
  assert.equal(result.ok, true, `${actionId} is available at the rumor object (${result.reason ?? ''})`);
  assert.equal(result.state.world.livingEventStates.E23.stage, stage);
  if (actionId === 'E23_CHECK_MARKET_RECORD') {
    assert.equal(result.state.world.livingEventStates.E23.claimStatus, 'PRICE_ADJUSTMENT_CONFIRMED_STOCK_HIDING_UNVERIFIED');
    assert.ok(result.state.world.livingEventStates.E23.checkedRecordNumber);
  }
  if (actionId === 'E23_REPEAT_RUMOR') assert.ok(result.state.world.livingEventStates.E23.rumorReachedHostIds.length > 0);
  if (actionId === 'E23_CORRECT_RUMOR') assert.ok(result.state.world.livingEventStates.E23.correctionReachedHostIds.length > 0);
  if (actionId === 'E23_REPEAT_RUMOR') {
    const recipientId = result.state.world.livingEventStates.E23.rumorReachedHostIds[0];
    assert.ok(result.state.hosts[recipientId].knownRumors.some(row => row.status === 'UNVERIFIED' && row.fromHostId === 'street_vendor_matryona'));
    const recipientCard = cards.find(card => card.id === recipientId);
    assert.equal(dialogueSceneContext(recipientCard, result.state.hosts[recipientId], result.state.world.date, 'market-quay').heardRumors[0].status, 'UNVERIFIED');
    assert.deepEqual(dialogueSceneContext(cards.find(card => card.id === 'reader_darya'), result.state.hosts.reader_darya,
      result.state.world.date, 'market-quay').heardRumors, [], 'rumor memory stays with residents who actually heard it');
  }
  if (actionId === 'E23_CORRECT_RUMOR') for (const recipientId of result.state.world.livingEventStates.E23.correctionReachedHostIds) {
    assert.ok(result.state.hosts[recipientId].knownRumors.some(row => row.status === 'CORRECTED' && row.fromHostId === 'street_vendor_matryona'));
  }
  if (actionId === 'E23_SEND_TO_PRESS') {
    assert.equal(result.state.world.livingEventStates.E23.editorialNote.claimStatus, 'UNVERIFIED');
    assert.ok(result.state.hosts.editor_sofia.inventory.includes('editorial-note:E23'));
    assert.ok(result.state.hosts.editor_sofia.knownRumors.some(row => row.eventId === 'E23' && row.status === 'UNVERIFIED'));
    assert.match(newspaperAssignment(result.state, 'editor_sofia', maps)?.actionKo ?? '', /장터/);
    let autonomousEditor = game.releaseHost(result.state, market).state;
    for (let elapsed = 0; elapsed < 240 && !autonomousEditor.world.livingEventStates.E23.editorialNote.pressArrivalAtMinute; elapsed += 5) {
      autonomousEditor = game.advanceNpcWorld(autonomousEditor, 5, maps);
    }
    assert.equal(autonomousEditor.hosts.editor_sofia.mapId, 'printshop',
      `after the player releases her, the editor physically carries the interview note to the press: ${JSON.stringify({map:autonomousEditor.hosts.editor_sofia.mapId,position:autonomousEditor.hosts.editor_sofia.position,goal:autonomousEditor.hosts.editor_sofia.activeGoal,allowed:autonomousEditor.hosts.editor_sofia.allowedMaps,note:autonomousEditor.world.livingEventStates.E23.editorialNote,embodiment:autonomousEditor.player.embodiment})}`);
    assert.ok(Number.isInteger(autonomousEditor.world.livingEventStates.E23.editorialNote.pressArrivalAtMinute),
      'the note arrival is recorded as an event stage, not an instantaneous map change');
    const pressArrival = autonomousEditor.ledger.flatMap(row => row.livingEvents ?? []).find(row => row.catalogEventId === 'E23'
      && row.stage === 'EDITORIAL_NOTE_AT_PRESS' && row.sourceEventId === 'E13');
    assert.ok(pressArrival, 'arrival is a distinct E13-linked world event');
    assert.equal(pressArrival.mapId, 'printshop');
    assert.deepEqual(pressArrival.actorHostIds, ['editor_sofia']);
    assert.equal(game.stateHash(game.loadGame(game.saveGame(autonomousEditor), { maps, hostCards: cards })),
      game.stateHash(autonomousEditor), 'physical press arrival and its event record survive save/load');
    let printing = structuredClone(result.state);
    printing.world.currentMapId = 'nevsky';
    printing.hosts.editor_sofia.mapId = 'nevsky'; printing.hosts.editor_sofia.position = { x: 25, y: 15 };
    printing.hosts.bookseller_lev.mapId = 'nevsky'; printing.hosts.bookseller_lev.position = { x: 25, y: 15 };
    for (const productId of ['newsprint_sheet', 'printing_ink']) {
      const purchase = purchaseCityProduct(printing, { hostId: 'editor_sofia', productId });
      assert.equal(purchase.ok, true, `${productId} is bought before printing`); printing = purchase.state;
    }
    printing.world.currentMapId = 'printshop'; printing.hosts.editor_sofia.mapId = 'printshop';
    const issueResult = publishNewspaperIssue(printing, { hostId: 'editor_sofia', storyId: 'MARKET_RUMOR_NOTE_E23' });
    assert.equal(issueResult.ok, true, `editor can print a note from the interview (${issueResult.reason ?? ''})`);
    assert.equal(issueResult.issue.sourceEventId, 'E13');
    assert.deepEqual(issueResult.issue.witnessHostIds, result.state.world.livingEventStates.E23.editorialNote.witnessHostIds);
    assert.match(issueResult.issue.bodyKo, /확인되지 않은 소문/);
    assert.equal(issueResult.state.world.livingEventStates.E23.stage, 'NEWSPAPER_PRINTED');
    let circulated = structuredClone(issueResult.state);
    circulated.world.currentMapId = 'nevsky'; circulated.hosts.editor_sofia.mapId = 'nevsky';
    const issueId = issueResult.issue.id;
    const circulation = circulateNewspaperIssue(circulated, { hostId: 'editor_sofia', issueId, route: 'street' });
    assert.equal(circulation.ok, true);
    circulated = circulation.state; circulated.world.currentMapId = 'nevsky';
    circulated.hosts.reader_darya.mapId = 'nevsky';
    const readIssue = readNewspaperIssue(circulated, { hostId: 'reader_darya', issueId });
    assert.equal(readIssue.ok, true);
    assert.ok(readIssue.state.hosts.reader_darya.knownRumors.some(row => row.eventId === 'E23'
      && row.status === 'UNVERIFIED' && row.newspaperIssueId === issueId));
    assert.ok(readIssue.state.world.livingEventStates.E23.newspaperReaderHostIds.includes('reader_darya'));
    const restoredIssue = game.loadGame(game.saveGame(readIssue.state), { maps, hostCards: cards });
    assert.equal(game.stateHash(restoredIssue), game.stateHash(readIssue.state), 'interview, publication, circulation, and reading persist together');
  }
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards });
  assert.equal(game.stateHash(restored), game.stateHash(result.state), `${actionId} state survives save/load`);
  if (actionId === 'E23_IGNORE_RUMOR') {
    const unattended = game.advanceNpcWorld(result.state, 90, maps);
    assert.equal(unattended.world.livingEventStates.E23.stage, 'SPREAD_UNVERIFIED');
    assert.equal(unattended.world.livingEventStates.E23.status, 'RESOLVED');
    assert.ok(unattended.world.livingEventStates.E23.rumorReachedHostIds.length > 0, 'inaction leaves a rumor audience');
    assert.ok(unattended.world.livingEventStates.E23.rumorReachedHostIds.every(id =>
      unattended.hosts[id].knownRumors.some(row => row.status === 'UNVERIFIED')));
    assert.equal(game.stateHash(game.loadGame(game.saveGame(unattended), { maps, hostCards: cards })), game.stateHash(unattended));
  }
}
const noAudience = atRumorScene(moved, 'street_vendor_matryona');
for (const host of Object.values(noAudience.hosts)) if (!['street_vendor_matryona', 'clerk_alexei'].includes(host.id)) host.position = { x: 1, y: 1 };
noAudience.hosts.clerk_alexei.position = { ...event.scenePosition };
assert.deepEqual(questChoices(e23Quest, 'street_vendor_matryona', [], noAudience).map(row => row.action.id),
  ['E23_IGNORE_RUMOR'], 'choices that need listeners disappear when nobody can hear them');
const blockedRepeat = game.performQuestAction(noAudience, { questId: e23Quest.id, hostId: 'street_vendor_matryona',
  actionId: 'E23_REPEAT_RUMOR', objectId: e23Quest.entry.objectId }, { quests: [e13Quest, e23Quest], maps });
assert.equal(blockedRepeat.ok, false, 'the rumor cannot be spread to an absent fallback audience');
assert.equal(blockedRepeat.reason, 'no_audience_present');
console.log('V37 E23 market rumor: E13 causal trigger, moving carrier, role-gated evidence/check/correction/spread, unattended consequence, and save/load passed.');
