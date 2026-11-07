import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { weatherForDate } from '../rpg/engine/atmosphere.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const [maps, hostCards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(row => [row.mapId, row]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);

function runExposure({ date, mapId, hostId, clockMinutes, position }) {
  const state = game.createInitialState({ maps, hostCards, startMapId: mapId });
  state.world.date = date;
  state.world.clockMinutes = clockMinutes;
  for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = false;
  const host = state.hosts[hostId];
  host.historicalAliveAndPresent = true;
  host.mapId = mapId;
  host.position = { ...position };
  const before = host.needs.fatigue;
  const result = game.advanceNpcWorld(state, 60, maps);
  return result.hosts[hostId].needs.fatigue - before;
}

assert.equal(weatherForDate('1848-01-01', 0), 'snow');
assert.equal(weatherForDate('1847-06-01', 0), 'clear');
const outdoorWeatherFixtures = [
  ['1848-01-01', 'snow', 1.5], ['1847-10-04', 'wind', 1.2], ['1847-07-01', 'drizzle', 0.6],
  ['1847-06-03', 'fog', 0.24], ['1847-07-02', 'overcast', 0.12], ['1847-06-01', 'clear', 0],
];
const outdoorClearFatigue = runExposure({ date: '1847-06-01', mapId: 'market-quay', hostId: 'porter_gavrila',
  clockMinutes: 480, position: { x: 22, y: 12 } });
const outdoorFatigue = new Map([['clear', outdoorClearFatigue]]);
for (const [date, weather, expectedExposure] of outdoorWeatherFixtures) {
  assert.equal(weatherForDate(date, 0), weather);
  outdoorFatigue.set(weather, runExposure({ date, mapId: 'market-quay', hostId: 'porter_gavrila',
    clockMinutes: 480, position: { x: 22, y: 12 } }));
  assert.ok(Math.abs(outdoorFatigue.get(weather) - outdoorClearFatigue - expectedExposure) < 1e-6,
    `${weather} should add its deterministic outdoor fatigue (${outdoorFatigue.get(weather)} vs ${outdoorClearFatigue})`);
}

const indoorSnowFatigue = runExposure({ date: '1848-01-01', mapId: 'bookshop-interior', hostId: 'bookseller_lev',
  clockMinutes: 660, position: { x: 11, y: 14 } });
const indoorClearFatigue = runExposure({ date: '1847-06-01', mapId: 'bookshop-interior', hostId: 'bookseller_lev',
  clockMinutes: 660, position: { x: 11, y: 14 } });
assert.equal(indoorSnowFatigue, indoorClearFatigue, 'outdoor weather does not affect a sheltered interior shift');
console.log(JSON.stringify({ status: 'PASS', outdoorWeatherFatigueByKind: Object.fromEntries(outdoorFatigue), indoorSnowFatigue }));
