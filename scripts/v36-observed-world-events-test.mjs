import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
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

const mainSource = await readFile(new URL('../rpg/main.js', import.meta.url), 'utf8');
assert.match(mainSource, /personalContacts \?\? \[\]\)\.filter\(contact => contact\.witnessedByPlayer\)/,
  'the journal must filter social reactions to witnessed contacts');
assert.match(mainSource, /deliveries \?\? \[\]\)\.filter\(delivery => delivery\.witnessedByPlayer\)/,
  'the journal must filter deliveries to witnessed events');
assert.match(mainSource, /exchanges \?\? \[\]\)\.filter\(exchange => exchange\.witnessedByPlayer\)/,
  'the journal must filter exchanges to witnessed events');
assert.match(mainSource, /meals \?\? \[\]\)\.filter\(meal => meal\.witnessedByPlayer\)/,
  'the journal must filter meals to witnessed events');
assert.match(mainSource, /restRecoveries \?\? \[\]\)\.filter\(rest => rest\.witnessedByPlayer\)/,
  'the journal must filter rest to witnessed events');

console.log(JSON.stringify({ status: 'PASS', currentDistrictAndRangeRequired: true,
  embodiedPlayerPositionUsed: true, witnessedDelivery: true, remoteDeliveryWithheld: true, journalEventFamiliesFiltered: 5 }));
