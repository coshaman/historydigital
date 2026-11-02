import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readdir } from 'node:fs/promises';

const root = process.cwd();
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const [registry, sourceRegister, maps, characterFiles] = await Promise.all([
  readJson('rpg/data/city-districts-v36.json'),
  readJson('docs/v36/historical-map-source-register.json'),
  Promise.all(['nevsky','printshop','chancery','police-station','courtyard','dead-souls','overcoat'].map(async id => [id, await readJson(`rpg/maps/${id}.json`)])),
  readdir(path.join(root, 'rpg/characters')),
]);
const mapById = new Map(maps);
const sourceById = new Map(sourceRegister.sources.map(source => [source.sourceId, source]));
const registeredLegacyIds = new Set(sourceRegister.sources.flatMap(source => source.legacySourceIds ?? []));
const characterRecords = await Promise.all(characterFiles.filter(file => file.endsWith('.json')).map(file => readJson(`rpg/characters/${file}`)));
const cityResidents = new Map(characterRecords.filter(person => person.kind === 'FICTIONAL').map(person => [person.id, person]));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const steps = [{ direction: 'up', x: 0, y: -1 }, { direction: 'right', x: 1, y: 0 }, { direction: 'down', x: 0, y: 1 }, { direction: 'left', x: -1, y: 0 }];

function walkTo(state, map, target) {
  const start = state.player.position, key = point => `${point.x},${point.y}`;
  const queue = [{ ...start, path: [] }], visited = new Set([key(start)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    if (point.x === target.x && point.y === target.y) return point.path;
    for (const step of steps) {
      const next = { x: point.x + step.x, y: point.y + step.y }, nextKey = key(next);
      if (visited.has(nextKey) || !game.canOccupy(map, next.x, next.y, null, state.hosts)) continue;
      visited.add(nextKey); queue.push({ ...next, path: [...point.path, step.direction] });
    }
  }
  return null;
}

test('the first two city-life prototypes are connected and clearly distinct from literary maps', () => {
  assert.equal(registry.districts.length, 2);
  const districtIds = new Set(registry.districts.map(district => district.id));
  assert.deepEqual([...districtIds], ['NEVSKY_COMMERCIAL','COURTYARD_HOUSEHOLD']);
  for (const district of registry.districts) {
    assert.ok(district.mapIds.length > 0);
    assert.ok(district.residentIds.length > 0);
    assert.equal(district.mapIds.every(mapId => mapById.has(mapId)), true);
    for (const mapId of district.mapIds) assert.equal(mapById.get(mapId).metadata.districtId, district.id, `${mapId} district metadata mismatch`);
    for (const mapId of district.mapIds) for (const sourceId of mapById.get(mapId).metadata.sourceIds ?? []) {
      if (['OBJ-PETERSBURG-PLAN-1840','OBJ-SADOVNIKOV-1835'].includes(sourceId)) assert.equal(registeredLegacyIds.has(sourceId), true, `legacy map source is not cross-referenced: ${sourceId}`);
    }
    for (const id of district.residentIds) assert.ok(cityResidents.has(id), `${id} is not a fictional city resident in this slice`);
  }
  const links = registry.districts.flatMap(district => district.connections.filter(link => link.districtTransition));
  assert.deepEqual(links.map(link => `${link.fromMapId}:${link.exitId}->${link.toMapId}`).sort(), [
    'courtyard:courtyard-nevsky-gate->nevsky', 'nevsky:nevsky-courtyard-gate->courtyard',
  ]);
  for (const link of links) {
    const exit = mapById.get(link.fromMapId).layers.find(layer => layer.name === 'Interactions').objects
      .find(object => object.type === 'map-exit' && object.properties?.some(property => property.name === 'exitId' && String(property.value).replaceAll('"','') === link.exitId));
    assert.ok(exit, `missing route exit ${link.exitId}`);
    const target = exit.properties.find(property => property.name === 'targetMapId');
    assert.equal(String(target.value).replaceAll('"',''), link.toMapId);
  }
  const residentsAcrossSlice = new Set(registry.districts.flatMap(district => district.residentIds));
  assert.deepEqual([...residentsAcrossSlice].sort(), [...cityResidents.keys()].sort());
  assert.equal(registry.districts.some(district => district.mapIds.includes('dead-souls') || district.mapIds.includes('overcoat')), false);
});

test('a player can physically traverse the declared district connection in both directions', () => {
  const runtimeMaps = Object.fromEntries(maps.filter(([id]) => !['dead-souls','overcoat'].includes(id)));
  const runtimeHosts = [...cityResidents.values()];
  const state = game.createInitialState({ maps: runtimeMaps, hostCards: runtimeHosts, startMapId: 'nevsky' });
  const firstExit = mapById.get('nevsky').layers.find(layer => layer.name === 'Interactions').objects.find(object => object.type === 'map-exit' && object.properties.some(property => property.name === 'exitId' && property.value === 'nevsky-courtyard-gate'));
  state.player.position = { x: Math.floor(firstExit.x / 16), y: Math.floor(firstExit.y / 16) };
  const entered = game.transitionMap(state, 'nevsky-courtyard-gate', runtimeMaps);
  assert.equal(entered.ok, true, entered.reason);
  assert.equal(entered.state.world.currentMapId, 'courtyard');
  let stateAtGate = entered.state;
  const courtyard = runtimeMaps.courtyard;
  const reverseExit = courtyard.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.type === 'map-exit' && object.properties.some(property => property.name === 'exitId' && property.value === 'courtyard-nevsky-gate'));
  const path = walkTo(stateAtGate, courtyard, { x: Math.floor(reverseExit.x / 16), y: Math.floor(reverseExit.y / 16) });
  assert.ok(path, 'return exit must be walk-reachable');
  for (const direction of path) {
    const result = game.moveActor(stateAtGate, direction, courtyard, runtimeMaps);
    assert.equal(result.moved, true, `walk to return gate blocked at ${direction}`);
    stateAtGate = result.state;
  }
  const returned = game.transitionMap(stateAtGate, 'courtyard-nevsky-gate', runtimeMaps);
  assert.equal(returned.ok, true, returned.reason);
  assert.equal(returned.state.world.currentMapId, 'nevsky');
});

test('every prototype source label names its evidence class and reconstruction limits', () => {
  for (const district of registry.districts) {
    assert.match(district.gameTransformation, /fictional|stylized|reconstruct/i);
    assert.ok(district.sourceEvidence.length >= 2);
    for (const source of district.sourceEvidence) {
      assert.ok(['PERIOD_MAP','PERIOD_PAINTING','PERIOD_PRINT','PERIOD_TEXT','LATER_REFERENCE','MODERN_SCHOLARSHIP','CREATIVE_RECONSTRUCTION'].includes(source.sourceType));
      assert.equal(sourceById.get(source.sourceId)?.sourceType, source.sourceType, `unresolved/mismatched source record: ${source.sourceId}`);
    }
  }
  assert.match(registry.reconstructionPolicy, /not claims|not georeferenced/i);
});
