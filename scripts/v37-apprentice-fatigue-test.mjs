import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest, catalog] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  json('../rpg/quests/apprentice-fatigue-1847.json'), json('../data/event_catalog_45.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`))),
]);
assert.equal(catalog.find(event => event.event_id === 'E33')?.validation_status, 'DESIGN_SEED_NOT_VERIFIED');
const map = maps.printshop, object = map.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
const tile = { x: object.x / 16, y: object.y / 16 };
assert.equal(map.layers.find(layer => layer.name === 'Collision').data[tile.y * map.width + tile.x], 0, 'the rest point beside the press is reachable');
const start = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'printshop' });
const ready = structuredClone(start), student = ready.hosts.print_apprentice_stepan;
ready.world.clockMinutes = 960; ready.world.currentMapId = 'printshop';
student.mapId = 'printshop'; student.position = { x: 10, y: 10 }; student.needs.fatigue = 48;
student.workActionProgress = { '0:V36_APPRENTICE_ORDER_WORK': 7 };
const triggered = game.advanceNpcWorld(ready, 1, maps), event = triggered.world.livingEventStates.E33;
assert.equal(event.status, 'ACTIVE'); assert.equal(event.stage, 'FATIGUE_LIMIT_REACHED');
assert.equal(event.workProgressAtTrigger, 7, 'work progress is preserved at the fatigue threshold');
assert.equal(objectIsPresent(object, triggered, [quest]), true, 'the physical worksite interaction appears only during the event');
assert.equal(game.advanceNpcWorld(triggered, 1, maps).hosts.print_apprentice_stepan.activeGoal?.reason,
  'apprentice_pauses_work_at_authored_rest_threshold', 'the apprentice autonomously moves to rest');
const possessed = structuredClone(ready); possessed.player.embodiment = 'print_apprentice_stepan';
possessed.player.position = { x: 10, y: 10 };
assert.equal(game.advanceNpcWorld(possessed, 1, maps).world.livingEventStates.E33?.status, 'ACTIVE', 'the fatigue event can occur while the player inhabits the apprentice');

const atScene = (source, actorId) => {
  const state = structuredClone(source), otherId = actorId === 'print_apprentice_stepan' ? 'printer_ekaterina' : 'print_apprentice_stepan';
  state.world.currentMapId = 'printshop'; state.player.embodiment = actorId; state.player.position = { ...tile };
  state.hosts[actorId].mapId = 'printshop'; state.hosts[actorId].position = { ...tile };
  state.hosts[otherId].mapId = 'printshop'; state.hosts[otherId].position = { x: tile.x + 1, y: tile.y };
  return state;
};
assert.deepEqual(questChoices(quest, 'print_apprentice_stepan', [], atScene(triggered, 'print_apprentice_stepan')).map(row => row.action.id), ['E33_REST_NOW', 'E33_KEEP_WORKING']);
assert.deepEqual(questChoices(quest, 'printer_ekaterina', [], atScene(triggered, 'printer_ekaterina')).map(row => row.action.id), ['E33_COWORKER_COVERS', 'E33_STOP_SHIFT']);

const rested = game.performQuestAction(atScene(triggered, 'print_apprentice_stepan'),
  { questId: quest.id, hostId: 'print_apprentice_stepan', actionId: 'E33_REST_NOW', objectId: object.id }, { quests: [quest], maps });
assert.equal(rested.ok, true); assert.equal(rested.state.world.livingEventStates.E33.stage, 'REST_REQUESTED');
const restCompleted = game.advanceNpcWorld(rested.state, 31, maps);
assert.equal(restCompleted.world.livingEventStates.E33.stage, 'RESTED_AFTER_BREAK');
assert.ok(restCompleted.hosts.print_apprentice_stepan.needs.fatigue < student.needs.fatigue);
assert.ok(restCompleted.hosts.print_apprentice_stepan.workActionProgress['0:V36_APPRENTICE_ORDER_WORK'] >= 7, 'unfinished work resumes after rest');

const coverState = atScene(triggered, 'printer_ekaterina'), studentMoney = coverState.hosts.print_apprentice_stepan.money.amount;
const coworkerMoney = coverState.hosts.printer_ekaterina.money.amount;
const covered = game.performQuestAction(coverState,
  { questId: quest.id, hostId: 'printer_ekaterina', actionId: 'E33_COWORKER_COVERS', objectId: object.id }, { quests: [quest], maps });
assert.equal(covered.ok, true, `coworker cover action succeeds (${covered.reason ?? ''})`);
assert.ok(covered.state.hosts.print_apprentice_stepan.completedWorkActionKeys.includes('0:V36_APPRENTICE_ORDER_WORK'));
assert.equal(covered.state.hosts.print_apprentice_stepan.money.amount, studentMoney + 1);
assert.equal(covered.state.hosts.printer_ekaterina.money.amount, coworkerMoney - 1);
assert.ok(covered.state.hosts.printer_ekaterina.workRecords.some(row => row.completedByHostId === 'printer_ekaterina'));
assert.equal(covered.state.world.livingEventStates.E33.workOutputTransferred, true);
const restored = game.loadGame(game.saveGame(covered.state), { maps, hostCards: cards, quests: [quest] });
assert.equal(game.stateHash(restored), game.stateHash(covered.state), 'wages, work transfer, rest state and event log survive save/load');

const stopped = game.performQuestAction(atScene(triggered, 'printer_ekaterina'),
  { questId: quest.id, hostId: 'printer_ekaterina', actionId: 'E33_STOP_SHIFT', objectId: object.id }, { quests: [quest], maps });
assert.equal(stopped.ok, true); assert.ok(stopped.state.hosts.print_apprentice_stepan.cancelledWorkActionKeys.includes('0:V36_APPRENTICE_ORDER_WORK'));
assert.equal(stopped.state.hosts.print_apprentice_stepan.money.amount, studentMoney, 'stopping the shift pays no output wage');
assert.equal(game.advanceNpcWorld(stopped.state, 31, maps).world.livingEventStates.E33.stage, 'RESTED_AFTER_SHIFT_STOP');

const continued = game.performQuestAction(atScene(triggered, 'print_apprentice_stepan'),
  { questId: quest.id, hostId: 'print_apprentice_stepan', actionId: 'E33_KEEP_WORKING', objectId: object.id }, { quests: [quest], maps });
assert.equal(continued.ok, true); assert.equal(continued.state.world.livingEventStates.E33.status, 'RESOLVED');
assert.equal(continued.state.hosts.print_apprentice_stepan.needs.fatigue, student.needs.fatigue + 12, 'continuing work has a persistent fatigue cost');

const unattended = game.advanceNpcWorld(structuredClone(triggered), 46, maps);
assert.equal(unattended.world.livingEventStates.E33.stage, 'RESTED_UNATTENDED', 'the no-intervention case reaches a real rest outcome');
assert.ok(unattended.hosts.print_apprentice_stepan.needs.fatigue < student.needs.fatigue);
assert.ok(unattended.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E33' && row.stage === 'RESTED_UNATTENDED'));
const naturalStart = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'printshop' });
for (const host of Object.values(naturalStart.hosts)) if (!['print_apprentice_stepan', 'printer_ekaterina'].includes(host.id)) host.historicalAliveAndPresent = false;
const naturalDay = game.advanceNpcWorld(naturalStart, 720, maps);
assert.ok(naturalDay.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E33' && row.stage === 'FATIGUE_LIMIT_REACHED'),
  `ordinary authored work naturally reaches the fatigue threshold without a test-only trigger (fatigue=${naturalDay.hosts.print_apprentice_stepan.needs.fatigue}, threshold=${naturalDay.hosts.print_apprentice_stepan.needs.restThreshold})`);
console.log('V37 E33 apprentice fatigue: PASS (needs trigger, NPC rest, four choices, transferred work and wages, unattended recovery, save/load)');
