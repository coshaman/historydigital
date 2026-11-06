import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { purchaseCityProduct } from '../rpg/engine/civic-life.mjs';
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
function setup() {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 540;
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
function atCounter(source, readCatalog = true) {
  const state = structuredClone(source), event = state.world.livingEventStates.E22, position = { ...event.scenePosition };
  state.world.currentMapId = 'nevsky'; state.player.embodiment = event.buyerHostId; state.player.position = { ...position };
  for (const id of event.actorHostIds) { state.hosts[id].mapId = 'nevsky'; state.hosts[id].position = { ...position }; }
  if (readCatalog) {
    const sourcePosition = { x: sourceCard.x / 16, y: sourceCard.y / 16 };
    state.player.position = { ...sourcePosition }; state.hosts[buyerId].position = { ...sourcePosition };
    const result = game.recordSourceRead(state, 'OBJ-SOV-1847', maps, [], 'PHYSICAL_COPY');
    assert.equal(result.ok, true, `buyer can read the checked bibliographic record in-world (${result.reason ?? ''})`);
    return result.state;
  }
  return state;
}
function choose(source, actionId, readCatalog = true) {
  const state = atCounter(source, readCatalog), actionPosition = { x: receipt.x / 16, y: receipt.y / 16 };
  state.world.currentMapId = 'nevsky'; state.player.embodiment = state.world.livingEventStates.E22.buyerHostId;
  state.player.position = { ...actionPosition }; state.hosts[state.player.embodiment].position = { ...actionPosition };
  const result = game.performQuestAction(state, { questId: quest.id,
    hostId: state.world.livingEventStates.E22.buyerHostId, actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId} resolves at the physical counter (${result.reason ?? ''})`);
  return result.state;
}

const open = setup();
const choices = questChoices(quest, buyerId, ['OBJ-SOV-1847'], open).map(row => row.action.id);
assert.deepEqual(choices, ['E22_READ_ALOUD', 'E22_COMPARE_SOURCE', 'E22_COMMENT', 'E22_KEEP_PRIVATE']);
assert.deepEqual(questChoices(quest, 'clerk_alexei', ['OBJ-SOV-1847'], open), [], 'only the actual buyer can choose the reading response');
assert.equal(game.stateHash(game.loadGame(game.saveGame(open), { maps, hostCards: cards })), game.stateHash(open));
for (const [actionId, stage, scope] of [
  ['E22_READ_ALOUD', 'READ_ALOUD', 'FICTIONAL_GAMEPLAY_RECONSTRUCTION'],
  ['E22_COMPARE_SOURCE', 'SOURCE_METADATA_COMPARED', 'BIBLIOGRAPHIC_METADATA_ONLY'],
  ['E22_COMMENT', 'PUBLIC_COMMENT', 'FICTIONAL_GAMEPLAY_RECONSTRUCTION'],
  ['E22_KEEP_PRIVATE', 'PRIVATE_READING', 'FICTIONAL_GAMEPLAY_RECONSTRUCTION'],
]) {
  const result = choose(open, actionId);
  assert.equal(result.world.livingEventStates.E22.stage, stage);
  assert.equal(result.world.periodicalDiscussionRecords.at(-1).scope, scope);
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

console.log('V37 E22 newspaper issue: physical sale, money transfer, role-gated metadata reading, comparison scope, private/public responses, unattended closure, and save/load passed.');
