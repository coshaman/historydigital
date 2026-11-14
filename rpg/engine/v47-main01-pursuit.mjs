import { walkableTilesReachableFromArrivals } from '../data/walkable-placement.mjs';

export const MAIN01_PURSUIT_CHECKPOINTS = Object.freeze([
  { id: 'CANAL_END', labelKo: '운하 다리 아래', promptKo: '수레 자국이 젖은 포장길로 꺾인다.' },
  { id: 'PRINTSHOP_CORNER', labelKo: '인쇄소 모퉁이', promptKo: '바퀴 자국이 다시 큰길 쪽으로 이어진다.' },
  { id: 'BOOKSHOP_GATE', labelKo: '책방 뒤편 문', promptKo: '문 앞에 멈춘 수레에서 봉인된 소포를 찾는다.' },
]);

export function attachMain01PursuitObjects(maps) {
  const map = maps['bookshop-lane'];
  const layer = map?.layers?.find(item => item.name === 'Interactions');
  if (!map || !layer) throw new Error('MAIN01 pursuit requires the bookshop-lane interaction layer');
  const present = new Set(layer.objects.filter(object => object.properties?.some(item => item.name === 'v47PursuitCheckpoint'))
    .map(object => object.properties.find(item => item.name === 'v47PursuitCheckpoint').value));
  const collision = map.layers.find(item => item.name === 'Collision')?.data ?? [];
  const reachable = walkableTilesReachableFromArrivals(map.mapId, maps);
  const occupied = map.layers.flatMap(item => item.objects ?? []).map(object => ({ x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) }));
  const preferred = [{ x: 4, y: 5 }, { x: 15, y: 13 }, { x: 25, y: 6 }];
  let nextId = Math.max(map.nextobjectid ?? 1, ...map.layers.flatMap(item => (item.objects ?? []).map(object => object.id + 1)));
  for (let index = 0; index < MAIN01_PURSUIT_CHECKPOINTS.length; index += 1) {
    const checkpoint = MAIN01_PURSUIT_CHECKPOINTS[index];
    if (present.has(checkpoint.id)) continue;
    const candidates = [];
    for (let y = 1; y < map.height - 1; y += 1) for (let x = 1; x < map.width - 1; x += 1) {
      if (collision[y * map.width + x] !== 0 || !reachable.has(`${x},${y}`)
        || occupied.some(point => Math.abs(point.x - x) + Math.abs(point.y - y) <= 2)) continue;
      candidates.push({ x, y, distance: Math.abs(x - preferred[index].x) + Math.abs(y - preferred[index].y) });
    }
    candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    const tile = candidates[0];
    if (!tile) throw new Error(`MAIN01 pursuit checkpoint has no reachable position: ${checkpoint.id}`);
    layer.objects.push({ id: nextId++, name: checkpoint.labelKo, type: 'inspectable',
      x: tile.x * 16, y: tile.y * 16, width: 16, height: 16, visible: true,
      properties: [{ name: 'v47PursuitCheckpoint', type: 'string', value: checkpoint.id },
        { name: 'storyTextKo', type: 'string', value: checkpoint.promptKo }] });
    occupied.push(tile);
  }
  map.nextobjectid = nextId;
}

export function createMain01PursuitState() {
  return { schemaVersion: 'V47_MAIN01_PURSUIT_V1', status: 'NOT_STARTED', nextCheckpoint: 0, startedAtMinute: null, finishedAtMinute: null };
}

export function startMain01Pursuit(previousState, clockMinutes) {
  const state = structuredClone(previousState ?? createMain01PursuitState());
  if (!Number.isInteger(clockMinutes) || state.status === 'COMPLETE') return { accepted: false, state, reason: 'unavailable' };
  if (state.status !== 'ACTIVE') {
    state.status = 'ACTIVE'; state.nextCheckpoint = 0; state.startedAtMinute = clockMinutes; state.finishedAtMinute = null;
  }
  return { accepted: true, state, checkpoint: MAIN01_PURSUIT_CHECKPOINTS[state.nextCheckpoint] };
}

export function reachMain01PursuitCheckpoint(previousState, checkpointId, clockMinutes) {
  const state = structuredClone(previousState ?? createMain01PursuitState());
  if (state.status !== 'ACTIVE') return { accepted: false, state, reason: 'not_active' };
  if (!Number.isInteger(clockMinutes) || clockMinutes - state.startedAtMinute > 45) {
    state.status = 'MISSED'; state.finishedAtMinute = clockMinutes;
    return { accepted: false, state, reason: 'lost_trail' };
  }
  const checkpoint = MAIN01_PURSUIT_CHECKPOINTS[state.nextCheckpoint];
  if (!checkpoint || checkpoint.id !== checkpointId) return { accepted: false, state, reason: 'wrong_checkpoint' };
  state.nextCheckpoint += 1;
  if (state.nextCheckpoint === MAIN01_PURSUIT_CHECKPOINTS.length) {
    state.status = 'COMPLETE'; state.finishedAtMinute = clockMinutes;
  }
  return { accepted: true, state, checkpoint: MAIN01_PURSUIT_CHECKPOINTS[state.nextCheckpoint] ?? null };
}
