const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function nearestWalkable(map, origin) {
  const collision = map.layers.find(layer => layer.name === 'Collision')?.data ?? [];
  const open = (x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height
    && collision[y * map.width + x] === 0;
  const queue = [{ x: origin.x, y: origin.y, distance: 0 }], seen = new Set([`${origin.x},${origin.y}`]);
  while (queue.length) {
    const point = queue.shift();
    if (open(point.x, point.y)) return { x: point.x, y: point.y };
    for (const [dx, dy] of directions) {
      const x = point.x + dx, y = point.y + dy, key = `${x},${y}`;
      if (point.distance >= 6 || seen.has(key) || x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      seen.add(key); queue.push({ x, y, distance: point.distance + 1 });
    }
  }
  return null;
}

export function walkableTilesReachableFromArrivals(mapId, maps) {
  const map = maps[mapId];
  if (!map) return new Set();
  const collision = map.layers.find(layer => layer.name === 'Collision')?.data ?? [];
  const open = (x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height
    && collision[y * map.width + x] === 0;
  const starts = [];
  if (map.metadata?.observerStart) {
    const start = nearestWalkable(map, map.metadata.observerStart);
    if (start) starts.push(start);
  }
  for (const source of Object.values(maps)) for (const layer of source.layers ?? []) for (const exit of layer.objects ?? []) {
    if (exit.type !== 'map-exit') continue;
    const props = Object.fromEntries((exit.properties ?? []).map(property => [property.name, property.value]));
    if (props.targetMapId !== mapId) continue;
    const arrivalX = Number(props.arrivalX), arrivalY = Number(props.arrivalY);
    if (!Number.isFinite(arrivalX) || !Number.isFinite(arrivalY)) continue;
    const start = nearestWalkable(map, { x: arrivalX, y: arrivalY });
    if (start) starts.push(start);
  }
  const queue = starts, reachable = new Set(starts.map(point => `${point.x},${point.y}`));
  while (queue.length) {
    const point = queue.shift();
    for (const [dx, dy] of directions) {
      const x = point.x + dx, y = point.y + dy, key = `${x},${y}`;
      if (!open(x, y) || reachable.has(key)) continue;
      reachable.add(key); queue.push({ x, y });
    }
  }
  return reachable;
}
