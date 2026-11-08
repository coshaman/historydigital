import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`))),
]);
const quests = (await Promise.all((await readdir(new URL('../rpg/quests/', import.meta.url)))
  .filter(file => file.endsWith('.json')).map(file => json(`../rpg/quests/${file}`))))
  .filter(quest => quest.historicalOutcome?.id);
const state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky', simulationSeed: 0 });
state.world.clockMinutes = 1020;
const innkeeper = state.hosts.innkeeper_irina, sister = state.hosts.landlady_polina;
innkeeper.mapId = 'courtyard'; innkeeper.position = { x: 18, y: 12 }; innkeeper.money.amount = 80;
innkeeper.marketStock['저녁 수프'] = 6;
innkeeper.completedWorkActionKeys = ['0:V36_INNKEEPER_EVENING_REGISTER'];
sister.mapId = 'courtyard'; sister.position = { x: 20, y: 13 }; sister.money.amount = 5;
const next = game.advanceNpcWorld(state, 5, maps), after = next.hosts.innkeeper_irina;
assert.equal(after.activeGoal.type, 'MARKET_SERVICE', 'an open, stocked supper shift takes precedence over a non-urgent family visit');
assert.equal(after.activeGoal.targetMapId, 'inn-interior');
assert.equal(after.activeGoal.reason, 'remain_at_food_service_during_authored_opening');
assert.equal(next.world.livingEventStates.E18?.status, undefined, 'taking the service post does not fabricate a customer transaction');
const afterClosing = game.advanceNpcWorld(next, 175, maps).hosts.innkeeper_irina;
assert.notEqual(afterClosing.activeGoal.type, 'MARKET_SERVICE', 'the keeper leaves the service post after the authored supper closing time');
console.log('V37 inn service shift: PASS (keeper remains available while family support waits for closing time)');
