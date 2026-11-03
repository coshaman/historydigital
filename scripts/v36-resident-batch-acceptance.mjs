import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const batchArgIndex = process.argv.indexOf('--batch');
const batchNumber = Number(process.argv.find(arg => arg.startsWith('--batch='))?.split('=')[1] ?? process.argv[batchArgIndex + 1] ?? process.env.npm_config_batch);
assert.ok(Number.isInteger(batchNumber) && batchNumber >= 1 && batchNumber <= 6, 'pass --batch=1 through --batch=6');
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const [registry, relationRegistry] = await Promise.all([
  readJson('rpg/data/city-districts-v36.json'), readJson('rpg/data/resident-relationships-v36.json'),
]);
const maps = Object.fromEntries(await Promise.all((await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const allIds = [...new Set(registry.districts.flatMap(district => district.residentIds ?? []))];
const relationBatch = relationRegistry.batches.find(batch => batch.id === batchNumber);
assert.equal(relationBatch?.residentIds.length, 6, `batch ${batchNumber} must contain six city residents`);
const ids = relationBatch.residentIds;
assert.ok(ids.every(id => allIds.includes(id)), 'each batch resident must be in the active city roster');
const cards = await Promise.all(allIds.map(id => readJson(`rpg/characters/${id}.json`)));
const cardById = new Map(cards.map(card => [card.id, card]));
const quests = (await Promise.all((await readdir(new URL('../rpg/quests/', import.meta.url))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/quests/${file}`)))).filter(quest => Array.isArray(quest.actions) && quest.historicalOutcome?.id);
const questsById = new Map(quests.map(quest => [quest.id, quest]));
function resolveQuestPrerequisites(state, quest, visited = new Set()) {
  for (const prerequisiteId of quest.prerequisiteQuestIds ?? []) {
    if (state.quests[prerequisiteId]?.status === 'resolved') continue;
    assert.ok(!visited.has(prerequisiteId), `quest prerequisite cycle at ${prerequisiteId}`);
    const prerequisite = questsById.get(prerequisiteId);
    assert.ok(prerequisite, `${quest.id} references missing prerequisite ${prerequisiteId}`);
    visited.add(prerequisiteId);
    state = resolveQuestPrerequisites(state, prerequisite, visited);
    visited.delete(prerequisiteId);
    const hostId = prerequisite.entry?.requiredHostId ?? prerequisite.actions[0]?.hostIds?.[0];
    const object = maps[prerequisite.entry?.mapId]?.layers.find(layer => layer.name === 'Interactions')?.objects.find(item => item.id === prerequisite.entry?.objectId);
    assert.ok(hostId && object, `${prerequisite.id} needs a playable host and physical interaction object`);
    state.world.chapterId = prerequisite.chapterId;
    state.world.date = prerequisite.date;
    state.world.currentMapId = prerequisite.entry.mapId;
    state.player.embodiment = hostId;
    state.hosts[hostId].mapId = prerequisite.entry.mapId;
    state.hosts[hostId].position = { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) };
    state.player.position = { ...state.hosts[hostId].position };
    const result = game.performQuestAction(state, { questId: prerequisite.id, hostId, actionId: prerequisite.actions[0].id, objectId: object.id }, { quests, maps });
    assert.equal(result.ok, true, `${prerequisite.id} must be completed before its follow-up: ${result.reason}`);
    state = result.state;
  }
  return state;
}
let questStagesResolved = 0;

for (const id of ids) {
  const card = cardById.get(id);
  assert.equal(card.kind, 'FICTIONAL');
  assert.equal(card.relationsStatus, relationRegistry.status, `${id} must label its authored relationship provenance`);
  assert.ok(Object.keys(card.relations ?? {}).length >= 2, `${id} needs at least two relationship contexts`);
  for (const [otherId, description] of Object.entries(card.relations)) {
    assert.ok(allIds.includes(otherId), `${id} relation target ${otherId} must be an active city resident`);
    assert.ok(description.length >= 12, `${id} relationship needs a meaningful description`);
    assert.ok(cardById.get(otherId)?.relations?.[id], `${id} ↔ ${otherId} should be reciprocal`);
  }
  assert.ok(card.schedule.length >= 4, `${id} needs at least four authored daily stops`);
  const destinations = new Set();
  for (const slot of card.schedule) {
    const map = maps[slot.mapId], collision = map?.layers.find(layer => layer.name === 'Collision')?.data;
    assert.ok(card.allowedMaps.includes(slot.mapId), `${id} is not allowed to work in ${slot.mapId}`);
    assert.ok(map && slot.position.x >= 0 && slot.position.y >= 0 && slot.position.x < map.width && slot.position.y < map.height, `${id} has an invalid schedule map/coordinate`);
    assert.equal(collision[slot.position.y * map.width + slot.position.x], 0, `${id} schedule target ${slot.mapId}:${slot.position.x},${slot.position.y} is blocked`);
    destinations.add(`${slot.mapId}:${slot.position.x}:${slot.position.y}`);
  }
  assert.ok(destinations.size >= 3, `${id} needs at least three distinct reachable work/rest locations`);

  const quest = quests.find(item => item.entry?.requiredHostId === id && item.actions.length >= 3 && item.actions.every(action => action.hostIds?.includes(id)));
  assert.ok(quest, `${id} needs an individually assigned three-choice life quest`);
  const chainQuests = quest.lifeChain ? quests.filter(item => item.lifeChain?.id === quest.lifeChain.id).sort((a,b) => a.lifeChain.stage - b.lifeChain.stage) : [quest];
  assert.equal(chainQuests.length, quest.lifeChain?.stageCount ?? 1, `${id} life chain must have all authored stages`);
  let questState = game.createInitialState({ maps, hostCards: cards, quests, startMapId: quest.entry.mapId });
  questState = resolveQuestPrerequisites(questState, chainQuests[0]);
  for (const stage of chainQuests) {
    const stageHostId = stage.entry.requiredHostId ?? stage.actions[0].hostIds[0];
    const object = maps[stage.entry.mapId]?.layers.find(layer => layer.name === 'Interactions')?.objects.find(item => item.id === stage.entry.objectId);
    assert.ok(object, `${stage.id} needs an actual interaction object`);
    questState.world.currentMapId = stage.entry.mapId;
    if (stage.chapterId === 'V33_1849_CIRCLE') { questState.world.chapterId = stage.chapterId; questState.world.date = stage.date; }
    questState.player.embodiment = stageHostId;
    questState.hosts[stageHostId].mapId = stage.entry.mapId;
    questState.player.position = { x: Math.max(0, Math.floor(object.x / 16) - 1), y: Math.floor(object.y / 16) };
    questState.hosts[stageHostId].position = { ...questState.player.position };
    const resolved = game.performQuestAction(questState, { questId: stage.id, hostId: stageHostId, actionId: stage.actions[0].id, objectId: stage.entry.objectId }, { quests, maps });
    assert.equal(resolved.ok, true, `${stage.id} must resolve in the actual engine: ${resolved.reason}`);
    assert.equal(resolved.state.quests[stage.id].status, 'resolved');
    questState = resolved.state;
    questStagesResolved += 1;
  }
  const placed = game.createInitialState({ maps, hostCards: cards, quests, startMapId: card.start.mapId });
  placed.world.currentMapId = card.start.mapId;
  placed.player.position = { ...placed.hosts[id].position };
  const possessed = game.possessHost(placed, id, maps[card.start.mapId]);
  assert.equal(possessed.ok, true, `${id} should be physically possessable`);
}

let replay = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
const legacyRelationSave = JSON.parse(game.saveGame(replay));
const migrationId = ids[0], migrationOther = Object.keys(cardById.get(migrationId).relations)[0];
delete legacyRelationSave.state.hosts[migrationId].relations[migrationOther];
legacyRelationSave.state.hosts[migrationId].relations.preserved_dynamic_relation = '플레이 중에 생긴 관계';
legacyRelationSave.checksum = game.stateHash(legacyRelationSave.state);
const migratedRelations = game.loadGame(JSON.stringify(legacyRelationSave), { maps, hostCards: cards, quests });
assert.equal(migratedRelations.hosts[migrationId].relations[migrationOther], cardById.get(migrationId).relations[migrationOther], 'old saves should receive new authored social context');
assert.equal(migratedRelations.hosts[migrationId].relations.preserved_dynamic_relation, '플레이 중에 생긴 관계', 'migration must preserve relationships created during play');
const startHash = game.stateHash(replay);
for (let tick = 0; tick < 12; tick += 1) {
  replay = game.advanceNpcWorld(replay, 5, maps);
  const occupied = new Set();
  for (const id of allIds) {
    const host = replay.hosts[id], key = `${host.mapId}:${host.position.x},${host.position.y}`;
    assert.ok(!occupied.has(key), `collision in batch ${batchNumber}: ${id} at ${key}`);
    occupied.add(key);
  }
}
assert.notEqual(game.stateHash(replay), startHash, 'the world state should advance during the one-hour batch replay');
assert.equal(replay.world.clockMinutes, 600, 'each batch exercises one full game hour');

const report = { schemaVersion: 'V36_RESIDENT_BATCH_ACCEPTANCE_1', status: 'PASS', batch: batchNumber, residents: ids,
  relationships: ids.map(id => ({ id, reciprocalLinks: Object.keys(cardById.get(id).relations).length })),
  scheduleTargetsChecked: ids.reduce((sum, id) => sum + cardById.get(id).schedule.length, 0),
  oneHourWorldReplay: true, collisionSnapshots: 12, questCompletions: ids.length, questStagesResolved, possessionChecks: ids.length,
  legacySaveRelationMigrationPreservedDynamicLinks: true,
  movementEvents: replay.ledger.flatMap(event => event.moves ?? []).length,
  finalStateHash: game.stateHash(replay) };
const auditDir = new URL('../docs/v36/current-audit/', import.meta.url);
await mkdir(auditDir, { recursive: true });
await writeFile(new URL(`RESIDENT_BATCH_${batchNumber}_AUDIT.json`, auditDir), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
