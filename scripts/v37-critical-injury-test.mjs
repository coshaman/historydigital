import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(new URL(url, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/warehouse-injury-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);

function makeState() {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 0;
  state.hosts.porter_gavrila.mapId = 'market-quay'; state.hosts.porter_gavrila.position = { x: 12, y: 13 };
  state.hosts.midwife_avdotya.mapId = 'market-quay'; state.hosts.midwife_avdotya.position = { x: 13, y: 13 };
  state.player.embodiment = 'porter_gavrila'; state.player.position = { x: 12, y: 13 };
  state.world.livingEventStates.E12 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E12',
    status: 'ACTIVE', stage: 'INJURY', startedAtMinute: 0, autoResolveAtMinute: 1440,
    mapId: 'market-quay', position: { x: 12, y: 13 }, porterHostId: 'porter_gavrila', careHostId: 'midwife_avdotya',
    workActionId: 'V37_PORTER_UNLOAD_HEAVY_SACK', injuryId: 'GAVRILA_HEAVY_LOAD_SHOULDER_STRAIN', severity: 'CRITICAL',
    restedMinutes: 0, cargo: { itemKo: '밀가루 자루', status: 'FELL_TO_GROUND', position: { x: 12, y: 13 } },
    valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  state.hosts.porter_gavrila.healthState = { condition: 'INJURED', injury: { id: 'GAVRILA_HEAVY_LOAD_SHOULDER_STRAIN',
    severity: 'CRITICAL', onsetMinute: 0, care: 'AWAITING_DECISION' }, recoveryUntilMinute: null,
    valueStatus: 'FICTIONAL_CHARACTER_DESIGN' };
  return state;
}

const possessedWorker = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
possessedWorker.world.chapterId = 'V33_1847_PRINT';
possessedWorker.world.date = '1847-06-01';
possessedWorker.world.clockMinutes = 600;
possessedWorker.world.currentMapId = 'market-quay';
possessedWorker.hosts.porter_gavrila.mapId = 'market-quay';
possessedWorker.hosts.porter_gavrila.position = { x: 11, y: 13 };
possessedWorker.hosts.porter_gavrila.needs.fatigue = 90;
possessedWorker.player.embodiment = 'porter_gavrila';
possessedWorker.player.position = { x: 11, y: 13 };
const playerAtWork = game.advanceNpcWorld(possessedWorker, 1, maps);
assert.equal(playerAtWork.world.livingEventStates.E12?.status, 'ACTIVE',
  'the possessed porter can trigger the injury through his scheduled heavy-lifting work');
assert.equal(playerAtWork.hosts.porter_gavrila.healthState.condition, 'INJURED');
assert.ok(playerAtWork.ledger.some(row => row.livingEvents?.some(event => event.catalogEventId === 'E12' && event.stage === 'INJURY')),
  'the injury is recorded in the event ledger while the player controls its worker');

const unattended = game.advanceNpcWorld(makeState(), 1441, maps);
assert.equal(unattended.hosts.porter_gavrila.lifeStatus, 'DECEASED');
assert.equal(unattended.hosts.porter_gavrila.historicalAliveAndPresent, false);
assert.equal(unattended.world.livingEventStates.E12.stage, 'FATALITY');
assert.equal(unattended.world.deathRecords.length, 1);
assert.equal(unattended.world.livingEventStates.E28?.stage, 'FUNERAL_COSTS_DUE', 'a verified fictional kinship edge opens the funeral expense event');
assert.equal(unattended.world.livingEventStates.E28?.organizerHostId, 'courier_pavel');
assert.equal(unattended.player.embodiment, null, 'death releases the player from the host');
const restored = game.loadGame(game.saveGame(unattended), { maps, hostCards: cards, quests: [quest] });
assert.equal(restored.hosts.porter_gavrila.lifeStatus, 'DECEASED', 'death persists through save/load');
assert.equal(restored.world.deathRecords[0].causeId, 'GAVRILA_HEAVY_LOAD_SHOULDER_STRAIN');
assert.equal(restored.world.livingEventStates.E28.stage, 'FUNERAL_COSTS_DUE');

const treated = makeState();
const object = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === quest.entry.objectId);
const action = game.performQuestAction(treated, { questId: quest.id, hostId: 'porter_gavrila',
  actionId: 'GAVRILA_INJURY_MIDWIFE_CARE', objectId: object.id }, { quests: [quest], maps });
assert.equal(action.ok, true, `critical injury can be treated before the deadline (${action.reason ?? ''})`);
assert.equal(action.state.world.livingEventStates.E12.stage, 'TREATED');
assert.equal(game.advanceNpcWorld(action.state, 1441, maps).hosts.porter_gavrila.lifeStatus, undefined,
  'early care prevents the unattended fatal outcome');
console.log('V37 critical injury: deadline, intervention, fictional-only death, possession release, and save/load passed');
