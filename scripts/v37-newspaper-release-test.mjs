import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { publishNewspaperIssue, purchaseCityProduct } from '../rpg/engine/civic-life.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const buyerId = 'seamstress_anna';
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/newspaper-release-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const nevsky = maps.nevsky, receipt = nevsky.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(receipt, 'the E22 discussion uses a physical bibliographic card at Lev’s counter');
const sourceCard = nevsky.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.properties?.some(property => property.name === 'sourceId' && property.value === 'OBJ-SOV-1847'));
assert.ok(sourceCard, 'the verified bibliographic record is physically readable at the counter');
const passageCard = nevsky.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.name === '호리와 칼리니치가 나오는 문학면'
  && item.properties?.some(property => property.name === 'sourceId' && property.value === 'LIT-TURGENEV-KHOR-KALYNYCH-1847'));
assert.ok(passageCard, 'the actual literary passage is physically readable beside the counter');
function setup() {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 540;
  state.world.currentMapId = 'printshop';
  const printer = state.hosts.printer_ekaterina;
  printer.mapId = 'printshop'; printer.position = { x: 12, y: 10 };
  printer.knownEvidenceIds.push('LIT-TURGENEV-KHOR-KALYNYCH-1847');
  printer.inventory.push('newsprint_sheet', 'printing_ink');
  state.player.embodiment = printer.id; state.player.position = { ...printer.position };
  const released = publishNewspaperIssue(state, { hostId: printer.id, storyId: 'LITERARY_RURAL_LIFE_1847' });
  assert.equal(released.ok, true, 'press staff can publish the source-backed literary issue');
  assert.equal(released.state.world.livingEventStates?.E22?.stage, 'ISSUE_RELEASED',
    'E22 starts when the new issue is physically printed, before a reader buys it');
  assert.equal(released.state.world.livingEventStates?.E22?.sceneMapId, 'printshop');
  assert.ok(released.state.hosts[printer.id].inventory.includes(`newspaper_issue:${released.issue.id}`));
  assert.equal(game.stateHash(game.loadGame(game.saveGame(released.state), { maps, hostCards: cards, quests: [quest] })),
    game.stateHash(released.state), 'the release-stage event and physical issue survive save/load');
  const observedRelease = game.advanceNpcWorld(released.state, 1, maps);
  assert.ok(observedRelease.ledger.at(-1).livingEvents.some(event => event.catalogEventId === 'E22'
    && event.stage === 'ISSUE_RELEASED' && event.mapId === 'printshop'),
  'the release appears as an in-world event at the press');
  Object.assign(state, released.state);
  state.world.currentMapId = 'nevsky';
  const seller = state.hosts.bookseller_lev, buyer = state.hosts[buyerId];
  seller.mapId = buyer.mapId = 'nevsky'; seller.position = { x: 25, y: 15 }; buyer.position = { x: 24, y: 15 };
  state.player.embodiment = buyer.id; state.player.position = { ...buyer.position };
  const purchased = purchaseCityProduct(state, { hostId: buyer.id, productId: 'newspaper_1847_01' });
  assert.equal(purchased.ok, true, `sale requires the buyer and bookseller at the Nevsky counter (${purchased.reason ?? ''})`);
  assert.equal(purchased.state.hosts[buyer.id].money.amount, buyer.money.amount - 4);
  assert.equal(purchased.state.hosts[seller.id].money.amount, seller.money.amount + 4);
  assert.ok(purchased.state.hosts[buyer.id].inventory.includes('newspaper_1847_01'));
  assert.ok(!purchased.state.hosts[seller.id].inventory.includes('newspaper_1847_01'), 'the actual copy leaves the bookseller’s stock');
  assert.equal(purchased.state.world.livingEventStates.E22.sourceId, 'OBJ-SOV-1847');
  assert.equal(purchased.state.world.livingEventStates.E22.stage, 'ISSUE_SOLD');
  const arrived = game.advanceNpcWorld(purchased.state, 1, maps);
  assert.equal(arrived.world.livingEventStates.E22.stage, 'DISCUSSION_OPEN', 'the buyer and bookseller physically meet at the counter');
  assert.equal(objectIsPresent(receipt, arrived, [quest]), true);
  return arrived;
}
function atCounter(source, readPassage = true) {
  const state = structuredClone(source), event = state.world.livingEventStates.E22, position = { ...event.scenePosition };
  state.world.currentMapId = 'nevsky'; state.player.embodiment = event.buyerHostId; state.player.position = { ...position };
  for (const id of event.actorHostIds) { state.hosts[id].mapId = 'nevsky'; state.hosts[id].position = { ...position }; }
  if (readPassage) {
    for (const [sourceId, object] of [['OBJ-SOV-1847', sourceCard], ['LIT-TURGENEV-KHOR-KALYNYCH-1847', passageCard]]) {
      const sourcePosition = { x: object.x / 16, y: object.y / 16 };
      state.player.position = { ...sourcePosition }; state.hosts[buyerId].position = { ...sourcePosition };
      const result = game.recordSourceRead(state, sourceId, maps, [], 'PHYSICAL_COPY');
      assert.equal(result.ok, true, `buyer can read ${sourceId} in-world (${result.reason ?? ''})`);
      Object.assign(state, result.state);
    }
  }
  return state;
}
function choose(source, actionId, readPassage = true) {
  const state = atCounter(source, readPassage), actionPosition = { x: receipt.x / 16, y: receipt.y / 16 };
  state.world.currentMapId = 'nevsky'; state.player.embodiment = state.world.livingEventStates.E22.buyerHostId;
  state.player.position = { ...actionPosition }; state.hosts[state.player.embodiment].position = { ...actionPosition };
  const result = game.performQuestAction(state, { questId: quest.id,
    hostId: state.world.livingEventStates.E22.buyerHostId, actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId} resolves at the physical counter (${result.reason ?? ''})`);
  return result.state;
}

const open = setup();
const unreadChoices = questChoices(quest, buyerId, ['OBJ-SOV-1847'], open);
assert.ok(unreadChoices.every(row => row.missingSourceId === 'LIT-TURGENEV-KHOR-KALYNYCH-1847'), 'all narrative choices require reading the actual excerpt first');
const unreadState = atCounter(open, false), actionPosition = { x: receipt.x / 16, y: receipt.y / 16 };
unreadState.world.currentMapId = 'nevsky'; unreadState.player.position = { ...actionPosition };
unreadState.hosts[buyerId].position = { ...actionPosition };
const blockedUntilRead = game.performQuestAction(unreadState, { questId: quest.id, hostId: buyerId,
  actionId: 'E22_KEEP_PRIVATE', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(blockedUntilRead.reason, 'host_lacks_knowledge', 'the reducer blocks consequential choices until the passage is read');
const choices = questChoices(quest, buyerId, ['OBJ-SOV-1847', 'LIT-TURGENEV-KHOR-KALYNYCH-1847'], open).map(row => row.action.id);
assert.deepEqual(choices, ['E22_READ_ALOUD', 'E22_COMPARE_SOURCE', 'E22_COMMENT', 'E22_KEEP_PRIVATE']);
assert.deepEqual(questChoices(quest, 'clerk_alexei', ['OBJ-SOV-1847', 'LIT-TURGENEV-KHOR-KALYNYCH-1847'], open), [], 'only the actual buyer can choose the reading response');
assert.equal(game.stateHash(game.loadGame(game.saveGame(open), { maps, hostCards: cards })), game.stateHash(open));
for (const [actionId, stage, scope] of [
  ['E22_READ_ALOUD', 'READ_ALOUD', 'FICTIONAL_READER_RESPONSE_TO_VERIFIED_LITERARY_EXCERPT'],
  ['E22_COMPARE_SOURCE', 'PASSAGE_DISCUSSION', 'FICTIONAL_READER_RESPONSE_TO_VERIFIED_LITERARY_EXCERPT'],
  ['E22_COMMENT', 'PUBLIC_COMMENT', 'FICTIONAL_READER_RESPONSE_TO_VERIFIED_LITERARY_EXCERPT'],
  ['E22_KEEP_PRIVATE', 'PRIVATE_READING', 'FICTIONAL_READER_RESPONSE_TO_VERIFIED_LITERARY_EXCERPT'],
]) {
  const result = choose(open, actionId);
  assert.equal(result.world.livingEventStates.E22.stage, stage);
  assert.equal(result.world.periodicalDiscussionRecords.at(-1).scope, scope);
  assert.equal(result.world.periodicalDiscussionRecords.at(-1).passageSourceId, 'LIT-TURGENEV-KHOR-KALYNYCH-1847');
  assert.equal(game.stateHash(game.loadGame(game.saveGame(result), { maps, hostCards: cards })), game.stateHash(result));
}
const unread = game.advanceNpcWorld(setup(), 61, maps);
assert.equal(unread.world.livingEventStates.E22.stage, 'AUTO_CLOSED', 'an unhandled sale remains in the buyer’s inventory and the discussion window closes');
assert.equal(unread.world.livingEventStates.E22.resolutionActionId, 'AUTO_ISSUE_LEFT_UNREAD');
assert.ok(unread.hosts[buyerId].inventory.includes('newspaper_1847_01'));
assert.equal(game.stateHash(game.loadGame(game.saveGame(unread), { maps, hostCards: cards })), game.stateHash(unread));
const away = setup(); away.world.currentMapId = 'printshop';
assert.equal(purchaseCityProduct(away, { hostId: buyerId, productId: 'newspaper_1847_01' }).reason, 'periodical_counter_unavailable');
const outOfStock = setup(); outOfStock.hosts.bookseller_lev.inventory = outOfStock.hosts.bookseller_lev.inventory.filter(item => item !== 'newspaper_1847_01');
assert.equal(purchaseCityProduct(outOfStock, { hostId: buyerId, productId: 'newspaper_1847_01' }).reason, 'periodical_out_of_stock');

const unattendedRelease = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'printshop' });
unattendedRelease.world.chapterId = 'V33_1847_PRINT'; unattendedRelease.world.date = '1847-06-01'; unattendedRelease.world.clockMinutes = 540;
const unattendedPrinter = unattendedRelease.hosts.printer_ekaterina;
unattendedPrinter.mapId = 'printshop'; unattendedPrinter.position = { x: 12, y: 10 };
unattendedPrinter.knownEvidenceIds.push('LIT-TURGENEV-KHOR-KALYNYCH-1847');
unattendedPrinter.inventory.push('newsprint_sheet', 'printing_ink');
unattendedRelease.player.embodiment = unattendedPrinter.id; unattendedRelease.player.position = { ...unattendedPrinter.position };
const unbought = publishNewspaperIssue(unattendedRelease, { hostId: unattendedPrinter.id, storyId: 'LITERARY_RURAL_LIFE_1847' });
assert.equal(unbought.state.world.livingEventStates.E22.stage, 'ISSUE_RELEASED');
const unattendedClose = game.advanceNpcWorld(unbought.state, 181, maps);
assert.equal(unattendedClose.world.livingEventStates.E22.stage, 'UNSOLD', 'the unbought release resolves without player intervention');
assert.equal(unattendedClose.world.livingEventStates.E22.resolutionActionId, 'AUTO_ISSUE_REMAINS_UNSOLD');
assert.ok(unattendedClose.hosts.printer_ekaterina.inventory.includes(`newspaper_issue:${unbought.issue.id}`),
  'an unattended release leaves the printed copy with its publisher');
assert.equal(game.stateHash(game.loadGame(game.saveGame(unattendedClose), { maps, hostCards: cards, quests: [quest] })),
  game.stateHash(unattendedClose), 'the unattended release resolution survives save/load');

console.log('V37 E22 newspaper issue: physical press release, counter sale, bilingual reading prerequisite, audience choices, unattended resolution, and save/load passed.');
