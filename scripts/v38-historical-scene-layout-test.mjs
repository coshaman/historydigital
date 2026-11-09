import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildHistoricalSceneLayout } from '../rpg/engine/historical-scene-layout.mjs';

const read = path => fs.readFile(new URL(path, import.meta.url), 'utf8');
const catalog = JSON.parse(await read('../rpg/data/v38-historical-events.json'));
const play = JSON.parse(await read('../rpg/data/historical-scene-play.json')).events;
const sourceMapCache = new Map();
const readMap = async id => {
  if (!sourceMapCache.has(id)) sourceMapCache.set(id, JSON.parse(await read(`../rpg/maps/${id}.json`)));
  return sourceMapCache.get(id);
};
const tileKey = point => `${point.x},${point.y}`;
const objectTile = object => ({ x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) });

for (const sourceScene of play) {
  const scene = structuredClone(sourceScene), event = catalog.events.find(item => item.id === scene.eventId);
  assert.ok(scene.fieldActions.filter(action => action.groupEncounter).length >= 6,
    `${scene.eventId} should stage at least six group decisions across its three playable areas`);
  for (const [mapIndex, mapId] of scene.maps.entries()) {
    const localCast = scene.actors.filter((_actor, index) => index % scene.maps.length === mapIndex).map(actor => actor.id);
    const localGroupActions = scene.fieldActions.filter(action => action.mapId === mapId && action.groupEncounter);
    assert.ok(localGroupActions.length >= 2, `${scene.eventId}/${mapId} stages at least two group scenes`);
    for (const action of localGroupActions) for (const actorId of localCast)
      assert.ok(action.gatherActorIds.includes(actorId), `${scene.eventId}/${action.id} includes local participant ${actorId}`);
  }
  for (const action of scene.fieldActions.filter(item => item.groupEncounter)) {
    assert.ok(action.gatherActorIds?.length >= 6, `${scene.eventId}/${action.id} brings a full local group into the scene`);
    assert.ok(action.options.every(option => option.groupReactionKo?.length >= 60), `${scene.eventId}/${action.id} records a concrete group response for every choice`);
  }
  const sources = Object.fromEntries(await Promise.all(scene.backgrounds.map(async id => [id, await readMap(id)])));
  const layout = buildHistoricalSceneLayout(scene, event, sources);
  assert.deepEqual(layout.mapIds, scene.maps);
  for (let mapIndex = 0; mapIndex < scene.maps.length; mapIndex++) {
    const mapId = scene.maps[mapIndex], map = layout.maps[mapId], source = sources[scene.backgrounds[mapIndex]];
    const collision = map.layers.find(layer => layer.name === 'Collision')?.data ?? [];
    const interactions = map.layers.find(layer => layer.name === 'Interactions')?.objects ?? [];
    const sceneActions = scene.fieldActions.filter(action => action.mapId === mapId);
    const sceneActors = scene.actors.filter(actor => actor.mapId === mapId);
    for (const action of sceneActions.filter(item => item.groupEncounter)) {
      assert.equal(action.gatherPositions?.length, action.gatherActorIds.length, `${scene.eventId}/${action.id} assigns each arriving resident a distinct standing spot`);
      assert.equal(new Set(action.gatherPositions.map(item => tileKey(item.position))).size, action.gatherPositions.length,
        `${scene.eventId}/${action.id} keeps the crowd from stacking on one tile`);
    }
    const entryAndActorPoints = [...(mapIndex === 0 ? [scene.entryPosition] : []), ...sceneActors.map(actor => actor.position)];
    for (const point of entryAndActorPoints) assert.equal(collision[point.y * map.width + point.x], 0, `${scene.eventId}/${mapId} entry or actor must be walkable`);
    const generatedActions = interactions.filter(object => object.properties?.some(property => property.name === 'historicalActionId'));
    assert.equal(generatedActions.length, sceneActions.length, `${scene.eventId}/${mapId} retains every authored event action`);
    const originalInteractables = (source.layers.find(layer => layer.name === 'Interactions')?.objects ?? [])
      .filter(object => (scene.keepBackgroundInteractionIds ?? []).includes(object.id));
    for (const object of originalInteractables) assert.ok(interactions.some(item => item.id === object.id), `${scene.eventId}/${mapId} keeps explicitly selected background interaction ${object.name}`);
    const unexpectedCampaignProps = interactions.filter(object => object.type !== 'map-exit'
      && !object.properties?.some(property => property.name === 'historicalActionId')
      && !(scene.keepBackgroundInteractionIds ?? []).includes(object.id));
    assert.deepEqual(unexpectedCampaignProps, [], `${scene.eventId}/${mapId} must not expose unrelated campaign props during the event`);
    const exits = interactions.filter(object => object.type === 'map-exit');
    assert.equal(exits.length, (mapIndex > 0 ? 1 : 0) + (mapIndex < scene.maps.length - 1 ? 1 : 0));
    const incomingPoints = [];
    if (mapIndex > 0) {
      const previous = sources[scene.backgrounds[mapIndex - 1]];
      const previousStart = mapIndex - 1 === 0 ? scene.entryPosition : previous.metadata.observerStart;
      incomingPoints.push({ x: Math.max(1, Math.min(previous.width - 2, Math.floor(previous.width / 2) - 3)), y: previousStart.y });
    }
    if (mapIndex < scene.maps.length - 1) {
      const following = sources[scene.backgrounds[mapIndex + 1]];
      incomingPoints.push({ x: Math.max(1, Math.min(following.width - 2, Math.floor(following.width / 2) + 3)), y: following.metadata.observerStart.y });
    }
    const physicalPoints = [
      ...sceneActions.map(action => action.position),
      ...sceneActions.flatMap(action => action.gatherPositions?.map(item => item.position) ?? []),
      ...sceneActors.map(actor => actor.position),
      ...interactions.filter(object => object.type === 'map-exit').map(objectTile),
      ...originalInteractables.map(objectTile),
      ...(mapIndex === 0 ? [scene.entryPosition] : []),
      ...incomingPoints,
    ];
    const duplicated = physicalPoints.map(tileKey).filter((key, pointIndex, all) => all.indexOf(key) !== pointIndex);
    assert.equal(new Set(physicalPoints.map(tileKey)).size, physicalPoints.length,
      `${scene.eventId}/${mapId} actors, actions, arrivals, exits, and existing objects never overlap: ${[...new Set(duplicated)].join(' ')}`);
    for (const actor of sceneActors) for (const stop of actor.stops ?? []) {
      assert.equal(collision[stop.y * map.width + stop.x], 0, `${scene.eventId}/${mapId} actor schedule stays on walkable tiles`);
      assert.ok(!physicalPoints.some(point => tileKey(point) === tileKey(stop) && tileKey(point) !== tileKey(actor.position)),
        `${scene.eventId}/${mapId} actor route avoids reserved scene objects`);
    }
  }
}

console.log('Historical event maps reserve entry, arrival, exit, background interaction, event prop, and actor route tiles without overlaps.');
