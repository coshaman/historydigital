const clone = value => structuredClone(value);
const tileKey = point => `${point.x},${point.y}`;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const objectTile = object => ({ x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) });

function walkableTiles(map, origin) {
  const collision = map.layers.find(layer => layer.name === 'Collision')?.data ?? [];
  return Array.from({ length: map.width * map.height }, (_, index) => ({
    x: index % map.width, y: Math.floor(index / map.width),
  })).filter(point => collision[point.y * map.width + point.x] === 0)
    .sort((a, b) => distance(a, origin) - distance(b, origin) || a.y - b.y || a.x - b.x);
}

function pickTile(map, origin, reserved, minimumDistance = 1) {
  const point = walkableTiles(map, origin).find(candidate => !reserved.has(tileKey(candidate))
    && [...reserved].every(key => {
      const [x, y] = key.split(',').map(Number);
      return distance(candidate, { x, y }) >= minimumDistance;
    }));
  if (!point) throw new Error(`No collision-free historical event tile near ${tileKey(origin)} on ${map.mapId}`);
  reserved.add(tileKey(point));
  return point;
}

function pickNearbyTile(map, origin, reserved, maximumDistance = 4) {
  const point = walkableTiles(map, origin).find(candidate => distance(candidate, origin) <= maximumDistance
    && !reserved.has(tileKey(candidate)) && [...reserved].every(key => {
      const [x, y] = key.split(',').map(Number);
      return distance(candidate, { x, y }) >= 1;
    }));
  if (!point) throw new Error(`No distinct group standing tile near ${tileKey(origin)} on ${map.mapId}`);
  reserved.add(tileKey(point));
  return point;
}

function reservePoint(map, reserved, point, description) {
  const collision = map.layers.find(layer => layer.name === 'Collision')?.data ?? [];
  if (collision[point.y * map.width + point.x] !== 0)
    throw new Error(`Historical event ${description} is blocked on ${map.mapId}: ${tileKey(point)}`);
  reserved.add(tileKey(point));
}

export function buildHistoricalSceneLayout(scene, event, sourceMaps) {
  const maps = {}, reservedByMap = {}, mapIds = [...scene.maps];
  for (let index = 0; index < mapIds.length; index++) {
    const mapId = mapIds[index], map = clone(sourceMaps[scene.backgrounds[index]]);
    if (!map) throw new Error(`Missing historical event background: ${scene.backgrounds[index]}`);
    map.mapId = mapId;
    map.name = mapId;
    map.metadata = { ...map.metadata, displayNameKo: scene.zoneTitlesKo[index], date: event.date,
      observerStart: index === 0 ? clone(scene.entryPosition) : map.metadata.observerStart,
      mapClass: 'HISTORICAL_EVENT_SCENE', historicalEventId: event.id,
      districtId: null, sourceIds: [], access: undefined, note: undefined };
    map.properties = (map.properties ?? []).filter(property => property.name !== 'mapId' && property.name !== 'date');
    map.properties.push({ name: 'mapId', type: 'string', value: JSON.stringify(mapId) },
      { name: 'date', type: 'string', value: JSON.stringify(event.date) });
    let interactions = map.layers.find(layer => layer.name === 'Interactions');
    if (!interactions) {
      interactions = { id: map.layers.length + 1, name: 'Interactions', type: 'objectgroup', draworder: 'topdown', objects: [] };
      map.layers.push(interactions);
    }
    const keptIds = new Set(scene.keepBackgroundInteractionIds ?? []);
    interactions.objects = (interactions.objects ?? []).filter(object => object.type !== 'map-exit' && keptIds.has(object.id));
    maps[mapId] = map;
    const reserved = new Set(interactions.objects.map(object => tileKey(objectTile(object))));
    reservedByMap[mapId] = reserved;
    if (index === 0) reservePoint(map, reserved, map.metadata.observerStart, 'entry point');
  }

  const arrivalPoints = [];
  for (let index = 0; index < mapIds.length; index++) {
    const mapId = mapIds[index], map = maps[mapId], interactions = map.layers.find(layer => layer.name === 'Interactions');
    const exits = index < mapIds.length - 1 ? [[mapIds[index + 1], '계속 걷기', 1]] : [];
    if (index > 0) exits.unshift([mapIds[index - 1], '되돌아가기', -1]);
    for (const [targetMapId, label, direction] of exits) {
      const x = direction > 0 ? map.width - 3 : 1, y = map.height - 3;
      const arrival = { x: Math.max(1, Math.min(map.width - 2, Math.floor(map.width / 2) - direction * 3)),
        y: map.metadata.observerStart.y };
      const exitPoint = { x, y };
      reservePoint(map, reservedByMap[mapId], exitPoint, 'exit');
      arrivalPoints.push({ mapId: targetMapId, point: arrival, description: `entry from ${mapId}` });
      interactions.objects.push({ id: 7000 + index * 10 + direction, name: `${label} · ${scene.zoneTitlesKo[mapIds.indexOf(targetMapId)]}`,
        type: 'map-exit', x: x * 16, y: y * 16, width: 16, height: 16, properties: [
          { name: 'exitId', type: 'string', value: `${mapId}:${targetMapId}` }, { name: 'targetMapId', type: 'string', value: targetMapId },
          { name: 'arrivalX', type: 'int', value: arrival.x }, { name: 'arrivalY', type: 'int', value: arrival.y },
          { name: 'publicAccess', type: 'bool', value: true },
        ] });
    }
  }
  for (const { mapId, point, description } of arrivalPoints) reservePoint(maps[mapId], reservedByMap[mapId], point, description);

  const actorsByMap = Object.fromEntries(mapIds.map(mapId => [mapId, []]));
  scene.actors.forEach((actor, actorIndex) => {
    actor.mapId = mapIds[actorIndex % mapIds.length];
    actorsByMap[actor.mapId].push(actor);
  });
  for (const [index, mapId] of mapIds.entries()) {
    const map = maps[mapId], reserved = reservedByMap[mapId], origin = map.metadata.observerStart;
    const actions = scene.fieldActions.filter(action => action.mapId === mapId);
    for (const action of actions) {
      action.position = pickTile(map, origin, reserved, 3);
      map.layers.find(layer => layer.name === 'Interactions').objects.push({ id: 7200 + index * 100 + actions.indexOf(action),
        name: action.propKo, type: 'inspectable', x: action.position.x * 16, y: action.position.y * 16, width: 16, height: 16,
        properties: [{ name: 'historicalEventId', type: 'string', value: scene.eventId },
          { name: 'historicalActionId', type: 'string', value: action.id },
          { name: 'storyTextKo', type: 'string', value: action.promptKo }] });
    }
    for (const action of actions) {
      const roster = action.groupEncounter ? action.gatherActorIds
        : scene.actors.filter(actor => actor.mapId === mapId && actor.objectiveId === action.objectiveId).map(actor => actor.id);
      action.gatherPositions = [...new Set(roster ?? [])].map(actorId => ({ actorId,
        position: pickNearbyTile(map, action.position, reserved) }));
    }
    for (const actor of actorsByMap[mapId]) {
      actor.position = pickTile(map, origin, reserved, 2);
      const nearby = walkableTiles(map, actor.position).filter(point => distance(point, actor.position) <= 2
        && !reserved.has(tileKey(point)));
      const stops = [actor.position];
      for (const candidate of nearby) {
        if (stops.every(point => distance(candidate, point) >= 1)) {
          stops.push(candidate); reserved.add(tileKey(candidate));
        }
        if (stops.length === 3) break;
      }
      while (stops.length < 3) stops.push(actor.position);
      actor.stops = stops;
    }
  }
  return { maps, mapIds, actors: scene.actors };
}
