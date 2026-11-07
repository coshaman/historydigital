import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/canal-traffic-response-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const map = maps['canal-road'];
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === quest.entry.objectId);
assert.ok(object, 'the detour choice uses the existing canal-side scene');

const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'canal-road' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 600;
state.world.currentMapId = 'canal-road'; state.player.embodiment = 'coachman_timofey';
const position = { x: object.x / 16, y: object.y / 16 };
state.player.position = { ...position };
state.quests[quest.id] = { status: 'open' };
for (const [id, hostPosition] of Object.entries({ coachman_timofey: position,
  watercarrier_luka: { x: position.x + 1, y: position.y }, carter_roman: { x: position.x - 1, y: position.y } })) {
  state.hosts[id].mapId = 'canal-road'; state.hosts[id].position = hostPosition;
}
state.hosts.coachman_timofey.schedule = [{ atMinute: 600, mapId: 'canal-road', position: { x: 11, y: 10 }, activityKo: '다음 운송을 향해 간다' }];
state.world.livingEventStates.E11 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E11', status: 'ACTIVE',
  stage: 'BOAT_TRAFFIC', startedAtMinute: 590, clearsAtMinute: 611, actorHostIds: ['coachman_timofey', 'watercarrier_luka'],
  triggerHostId: 'coachman_timofey', waitMinutesByHost: {}, valueStatus: 'fictional_gameplay_balance',
  validationStatus: 'DESIGN_SEED_NOT_VERIFIED', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION' };

assert.equal(objectIsPresent(object, state, [quest]), true, 'the scene appears during actual boat traffic');
assert.deepEqual(questChoices(quest, 'coachman_timofey', [], state).map(row => row.action.id),
  quest.actions.map(action => action.id), 'the driver can choose how to handle the live delay');
const beforeTraffic = structuredClone(state);
delete beforeTraffic.world.livingEventStates.E11;
assert.equal(objectIsPresent(object, beforeTraffic, [quest]), false, 'the choice is hidden before the boat blocks the route');
const stillWaiting = structuredClone(state);
stillWaiting.world.livingEventStates.E11.stage = 'WAITING_FOR_PARTNER';
assert.equal(objectIsPresent(object, stillWaiting, [quest]), false, 'the crossing choice waits until the boat arrives');
assert.deepEqual(questChoices(quest, 'coachman_timofey', [], stillWaiting), [], 'no action appears before the blocked crossing');

const result = game.performQuestAction(state, { questId: quest.id, hostId: 'coachman_timofey',
  actionId: 'E11_TAKE_CONFIRMED_DETOUR', objectId: object.id }, { quests: [quest], maps });
assert.equal(result.ok, true, `a verified detour can be chosen at the canal (${result.reason ?? ''})`);
assert.deepEqual(result.state.world.livingEventStates.E11.reroutedHostIds, ['coachman_timofey'],
  'the route decision is stored on the live canal event');

let released = game.releaseHost(result.state, map).state;
released.world.currentMapId = 'canal-road';
released.player.position = { x: 20, y: 5 };
released = game.advanceNpcWorld(released, 1, maps);
assert.notEqual(released.hosts.coachman_timofey.currentActivityKo, '배가 지나는 동안 운하 길목에서 기다린다',
  'the driver resumes a routine after choosing the alternate route while the boat remains');
assert.equal(released.world.livingEventStates.E11.stage, 'BOAT_TRAFFIC', 'rerouting does not erase the boat or its passage');
const restored = game.loadGame(game.saveGame(released), { maps, hostCards: cards, quests: [quest] });
assert.deepEqual(restored.world.livingEventStates.E11, released.world.livingEventStates.E11,
  'the live event and chosen route survive save/load');
assert.equal(restored.hosts.coachman_timofey.currentActivityKo, released.hosts.coachman_timofey.currentActivityKo);
console.log('V37 E11 canal intervention: scene gating, witnessed detour, resumed travel during boat passage, and save/load passed.');
