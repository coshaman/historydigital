import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { formatObservedNpcReactions } from '../rpg/engine/world-reaction-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const quest = await json('../rpg/quests/pavel-missing-parcel-1847.json');
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const cardFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.map(file => json(`../rpg/maps/${file}`))).then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.map(file => json(`../rpg/characters/${file}`))),
]);
const parcelObject = maps.printshop.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === quest.entry.objectId);
assert.ok(parcelObject, 'the late parcel has a physical interaction object at the printshop');
assert.deepEqual({ x: Math.floor(parcelObject.x / 16), y: Math.floor(parcelObject.y / 16) }, { x: 10, y: 13 });
const initial = () => game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });

const onTime = game.advanceNpcWorld(initial(), 120, maps);
assert.equal(onTime.world.livingEventStates.E05, undefined, 'the authored route completes its handoff before the deadline');
assert.ok(onTime.ledger.flatMap(entry => entry.deliveries ?? []).some(row => row.taskId === 'PAVEL_DELIVER_SEALED_ENVELOPE_01'));

const delayedStart = initial();
delayedStart.player.position = { ...delayedStart.hosts.courier_pavel.position };
const possessed = game.possessHost(delayedStart, 'courier_pavel', maps.nevsky);
assert.equal(possessed.ok, true);
const missed = game.advanceNpcWorld(possessed.state, 120, maps);
const event = missed.world.livingEventStates.E05;
assert.equal(event?.status, 'ACTIVE', 'missing the handoff as the courier starts E05');
assert.equal(event.stage, 'PARCEL_MISSING');
assert.equal(event.itemLocation, 'LOST_ON_DELIVERY_ROUTE');
assert.equal(event.mapId, quest.entry.mapId);
assert.deepEqual(event.position, { x: 10, y: 13 });
assert.equal(missed.hosts.courier_pavel.inventory.includes('밀봉 봉투'), false, 'the dropped object leaves the courier inventory');
assert.equal(objectIsPresent(parcelObject, missed, [quest]), true, 'the parcel appears only after its missed-delivery trigger');
assert.equal(game.stateHash(game.loadGame(game.saveGame(missed), { maps, hostCards: cards, quests: [quest] })), game.stateHash(missed),
  'the active parcel, delivery failure, and quest survive save/load');
const continued = game.advanceNpcWorld(structuredClone(missed), 1440, maps);
assert.equal(continued.world.livingEventStates.E05.stage, 'UNCLAIMED', 'the city advances and records the parcel left unclaimed for a day');
assert.equal(continued.world.livingEventStates.E05.status, 'RESOLVED');
assert.ok(continued.ledger.flatMap(entry => entry.livingEvents ?? []).some(row => row.catalogEventId === 'E05' && row.stage === 'UNCLAIMED'));
assert.equal(game.stateHash(game.loadGame(game.saveGame(continued), { maps, hostCards: cards, quests: [quest] })), game.stateHash(continued));

const actionCases = [
  { actionId: 'PAVEL_RECOVER_MISSING_PARCEL', hostId: 'courier_pavel', stage: 'RECOVERED_BY_COURIER', itemOwner: 'courier_pavel' },
  { actionId: 'EKATERINA_ACCEPT_MISSING_PARCEL', hostId: 'printer_ekaterina', stage: 'ACCEPTED_BY_RECIPIENT', itemOwner: 'printer_ekaterina' },
  { actionId: 'PAVEL_REPORT_MISSING_PARCEL', hostId: 'courier_pavel', stage: 'LOSS_REPORTED', itemOwner: null },
];
for (const actionCase of actionCases) {
  const state = structuredClone(missed);
  state.world.currentMapId = 'printshop';
  state.hosts[actionCase.hostId].mapId = 'printshop';
  state.hosts[actionCase.hostId].position = { x: 10, y: 13 };
  state.player.embodiment = actionCase.hostId;
  state.player.position = { x: 10, y: 13 };
  const result = game.performQuestAction(state, { questId: quest.id, hostId: actionCase.hostId,
    actionId: actionCase.actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionCase.actionId} is available at the physical parcel (${result.reason ?? 'unknown reason'})`);
  const resolved = result.state.world.livingEventStates.E05;
  assert.equal(resolved.stage, actionCase.stage);
  assert.equal(resolved.status, 'RESOLVED');
  if (actionCase.itemOwner) assert.ok(result.state.hosts[actionCase.itemOwner].inventory.includes('밀봉 봉투'));
  else assert.equal(resolved.itemLocation, 'UNRECOVERED_AFTER_REPORT');
  assert.equal(result.state.quests[quest.id].status, 'resolved');
  assert.ok(result.state.ledger.at(-1).livingEvents.some(row => row.catalogEventId === 'E05' && row.stage === actionCase.stage));
  assert.equal(game.stateHash(game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] })), game.stateHash(result.state));
}

const witnessedEvent = missed.ledger.flatMap(row => row.livingEvents ?? []).find(row => row.catalogEventId === 'E05' && row.stage === 'PARCEL_MISSING');
assert.ok(witnessedEvent, 'the missed-delivery trigger remains in the event ledger after later ticks');
const witnessedRow = { ...missed.ledger.find(row => row.livingEvents?.includes(witnessedEvent)),
  livingEvents: [{ ...witnessedEvent, witnessedByPlayer: true }] };
assert.ok(formatObservedNpcReactions([witnessedRow], cards).some(line => line.includes('배달 봉투가 인쇄소 문 앞에 남음')));
console.log(JSON.stringify({ status: 'PASS', normalDelivery: 'ON_TIME_NO_EVENT', missedDelivery: event.stage,
  unattended: continued.world.livingEventStates.E05.stage, playerResolutions: actionCases.map(row => row.stage), saveLoad: true }));
