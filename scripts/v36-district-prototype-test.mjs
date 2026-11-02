import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { resolveQuestGuidance } from '../rpg/engine/quest-guidance.mjs';

const root = process.cwd();
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const [registry, sourceRegister, maps, characterFiles] = await Promise.all([
  readJson('rpg/data/city-districts-v36.json'),
  readJson('docs/v36/historical-map-source-register.json'),
  Promise.all(['nevsky','printshop','chancery','police-station','courtyard','market-quay','dead-souls','overcoat'].map(async id => [id, await readJson(`rpg/maps/${id}.json`)])),
  readdir(path.join(root, 'rpg/characters')),
]);
const mapById = new Map(maps);
const sourceById = new Map(sourceRegister.sources.map(source => [source.sourceId, source]));
const registeredLegacyIds = new Set(sourceRegister.sources.flatMap(source => source.legacySourceIds ?? []));
const characterRecords = await Promise.all(characterFiles.filter(file => file.endsWith('.json')).map(file => readJson(`rpg/characters/${file}`)));
const questRecords = await Promise.all(['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','yard-ledger-1847','laundry-wages-1847','bakery-flour-1847','market-prices-1847','porter-load-1847','coach-fare-1847','household-privacy-1847','midwife-care-cost-1847','apothecary-limits-1847','apprentice-authorship-1847','bookbinder-damage-1847','scribal-copy-1847'].map(id => readJson(`rpg/quests/${id}.json`)));
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

test('the three city-life prototypes are connected and clearly distinct from literary maps', () => {
  assert.equal(registry.districts.length, 3);
  const districtIds = new Set(registry.districts.map(district => district.id));
  assert.deepEqual([...districtIds], ['NEVSKY_COMMERCIAL','COURTYARD_HOUSEHOLD','MARKET_QUAY']);
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
    'courtyard:courtyard-nevsky-gate->nevsky', 'market-quay:market-nevsky-gate->nevsky',
    'nevsky:nevsky-courtyard-gate->courtyard', 'nevsky:nevsky-market-gate->market-quay',
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
  for (const id of registry.districts.find(district => district.id === 'MARKET_QUAY').residentIds) {
    const resident = cityResidents.get(id);
    assert.ok(resident.schedule?.length >= 4, `${id} needs a daily routine`);
    assert.ok(resident.speechRhythm && resident.worldview?.stanceKo, `${id} needs a voice and a point of view`);
  }
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
  const marketGate = mapById.get('nevsky').layers.find(layer => layer.name === 'Interactions').objects.find(object => object.type === 'map-exit' && object.properties.some(property => property.name === 'exitId' && property.value === 'nevsky-market-gate'));
  const marketGatePoint = { x: Math.floor(marketGate.x / 16), y: Math.floor(marketGate.y / 16) };
  const marketGatePath = walkTo(returned.state, runtimeMaps.nevsky, marketGatePoint);
  assert.ok(marketGatePath, 'market gate must be walk-reachable');
  let atMarketGate = returned.state;
  for (const direction of marketGatePath) {
    const result = game.moveActor(atMarketGate, direction, runtimeMaps.nevsky, runtimeMaps);
    assert.equal(result.moved, true, `walk to market gate blocked at ${direction}`);
    atMarketGate = result.state;
  }
  const toMarket = game.transitionMap(atMarketGate, 'nevsky-market-gate', runtimeMaps);
  assert.equal(toMarket.ok, true, toMarket.reason);
  assert.equal(toMarket.state.world.currentMapId, 'market-quay');
  const marketExit = runtimeMaps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects.find(object => object.type === 'map-exit' && object.properties.some(property => property.name === 'exitId' && property.value === 'market-nevsky-gate'));
  const returnPoint = { x: Math.floor(marketExit.x / 16), y: Math.floor(marketExit.y / 16) };
  const returnPath = walkTo(toMarket.state, runtimeMaps['market-quay'], returnPoint);
  assert.ok(returnPath, 'market return gate must be walk-reachable');
  let atReturnGate = toMarket.state;
  for (const direction of returnPath) {
    const result = game.moveActor(atReturnGate, direction, runtimeMaps['market-quay'], runtimeMaps);
    assert.equal(result.moved, true, `walk to market return gate blocked at ${direction}`);
    atReturnGate = result.state;
  }
  const toNevsky = game.transitionMap(atReturnGate, 'market-nevsky-gate', runtimeMaps);
  assert.equal(toNevsky.ok, true, toNevsky.reason);
  assert.equal(toNevsky.state.world.currentMapId, 'nevsky');
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

test('market arrival surfaces a local personal quest and a resident receives their own next action', () => {
  const runtimeMaps = Object.fromEntries(maps.filter(([id]) => !['dead-souls','overcoat'].includes(id)));
  const state = game.createInitialState({ maps: runtimeMaps, hostCards: [...cityResidents.values()], quests: questRecords, startMapId: 'market-quay' });
  const observer = resolveQuestGuidance({ state, quests: questRecords, maps: runtimeMaps, hostCards: [...cityResidents.values()] });
  assert.equal(observer.questId, 'YARD_LEDGER_1847');
  assert.match(observer.questTitleKo, /장작 장부/);
  const embodied = structuredClone(state);
  embodied.player.embodiment = 'baker_fyodor';
  embodied.player.position = { ...embodied.hosts.baker_fyodor.position };
  const baker = resolveQuestGuidance({ state: embodied, quests: questRecords, maps: runtimeMaps, hostCards: [...cityResidents.values()] });
  assert.equal(baker.questId, 'BAKERY_FLOUR_1847');
  assert.match(baker.actionKo, /밀가루|표도르|남은 밀가루/);
});

test('all six neighborhood residents have a reachable physical work record and disclosed choices', () => {
  const runtimeMaps = Object.fromEntries(maps.filter(([id]) => !['dead-souls','overcoat'].includes(id)));
  const ids=['housemaid_olga','midwife_avdotya','apothecary_yakov','print_apprentice_stepan','bookbinder_elizaveta','scribal_yuri'];
  const state=game.createInitialState({maps:runtimeMaps,hostCards:[...cityResidents.values()],quests:questRecords,startMapId:'nevsky'});
  for(const id of ids){
    const quest=questRecords.find(item=>item.actions[0].hostIds.includes(id));
    const actor=state.hosts[id];
    const embodied=structuredClone(state);
    embodied.world.currentMapId=quest.entry.mapId;
    embodied.player.embodiment=id;
    embodied.player.position={...actor.position};
    const guidance=resolveQuestGuidance({state:embodied,quests:questRecords,maps:runtimeMaps,hostCards:[...cityResidents.values()]});
    assert.equal(guidance.questId,quest.id,`${id} should see their own task first in its district`);
    assert.equal(guidance.blocked,false,`${id} task must be reachable`);
    for(const action of quest.actions){
      assert.ok(action.labelKo && action.subcopyKo,`${action.id} must disclose its immediate direction and risk`);
      assert.ok(action.hostIds.includes(id));
    }
  }
});
