import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url);
const readJson = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const districts = await readJson('rpg/data/city-districts-v36.json');
const ids = [...new Set(districts.districts.flatMap(district => district.residentIds ?? [])), 'street_musician_ivan'];
const maps = Object.fromEntries(await Promise.all((await readdir(new URL('../rpg/maps/', import.meta.url))
  ).filter(file => file.endsWith('.json')).map(async file => {
    const map = await readJson(`rpg/maps/${file}`);
    return [map.mapId, map];
  })));
const cards = await Promise.all(ids.map(id => readJson(`rpg/characters/${id}.json`)));
const quests = (await Promise.all((await readdir(new URL('../rpg/quests/', import.meta.url))
  ).filter(file => file.endsWith('.json')).map(file => readJson(`rpg/quests/${file}`))))
  .filter(quest => quest.historicalOutcome?.id);
let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky', simulationSeed: 0 });
let recipientAtDeliveryPreparation = null;
let deliveryAtClockMinute = null;

for (let minute = 0; minute < 24; minute += 1) {
  state = game.advanceNpcWorld(state, 5, maps);
  if (deliveryAtClockMinute === null && state.ledger.flatMap(entry => entry.deliveries ?? [])
    .some(row => row.taskId === 'PAVEL_DELIVER_SEALED_ENVELOPE_01')) deliveryAtClockMinute = state.world.clockMinutes;
  if (state.world.clockMinutes === 600) {
    const receiver = state.hosts.printer_ekaterina;
    recipientAtDeliveryPreparation = { mapId: receiver.mapId, goalType: receiver.activeGoal?.type };
  }
}

const delivery = state.ledger.flatMap(entry => entry.deliveries ?? [])
  .find(row => row.taskId === 'PAVEL_DELIVER_SEALED_ENVELOPE_01');
assert.equal(recipientAtDeliveryPreparation?.goalType, 'RECEIVE_DELIVERY',
  'the recipient must receive a deterministic rendezvous goal for an incoming courier handoff');
assert.equal(recipientAtDeliveryPreparation?.mapId, 'printshop',
  'the recipient should remain at her authored workplace as the handoff approaches');
assert.ok(delivery, 'Pavel and Ekaterina must meet at the authored printshop handoff before the deadline');
assert.ok(deliveryAtClockMinute <= 660, 'the courier must complete the handoff before E05 deadline');
assert.notEqual(state.world.livingEventStates?.E05?.stage, 'PARCEL_MISSING', 'a timely handoff must not create the lost-parcel event');

console.log(JSON.stringify({ status: 'PASS', deliveryAtClockMinute,
  mapId: delivery.mapId, receiver: delivery.recipientHostId, residents: ids.length }));
