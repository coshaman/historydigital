import { walkableTilesReachableFromArrivals } from '../data/walkable-placement.mjs';

export const MAIN01_STORAGE_SHELVES = Object.freeze([
  { id: 'SUBSCRIBERS', labelKo: '구독자 발송대', promptKo: '주소가 적힌 주문 묶음은 이 발송대에 둔다.' },
  { id: 'WORKSHOP', labelKo: '작업장 장부함', promptKo: '작업 시각과 품삯 장부를 이곳에 둔다.' },
  { id: 'CHANCERY', labelKo: '관청 문서함', promptKo: '접수한 금지 통지와 공문을 이곳에 둔다.' },
  { id: 'REWORK', labelKo: '재작업 선반', promptKo: '남은 종이와 제본 전 낱장 묶음은 재작업 선반에 둔다.' },
]);

export const MAIN01_STORAGE_PACKETS = Object.freeze([
  { id: 'SUBSCRIBER_ORDERS', labelKo: '주소가 적힌 구독자 주문 묶음', shelfId: 'SUBSCRIBERS' },
  { id: 'WAGE_LEDGER', labelKo: '작업 시간과 품삯 장부', shelfId: 'WORKSHOP' },
  { id: 'PROHIBITION_NOTICE', labelKo: '접수 시각이 적힌 출고 중지 통지', shelfId: 'CHANCERY' },
  { id: 'REMAINDER_STOCK', labelKo: '남은 종이와 제본 전 낱장 묶음', shelfId: 'REWORK' },
]);

export function attachMain01StorageShelves(maps) {
  const map = maps.printshop;
  const layer = map?.layers?.find(item => item.name === 'Interactions');
  if (!map || !layer) throw new Error('MAIN01 storage shelves require the printshop interaction layer');
  const attached = new Set(layer.objects.flatMap(object => object.properties ?? [])
    .filter(property => property.name === 'v47StorageShelf').map(property => property.value));
  const collision = map.layers.find(item => item.name === 'Collision')?.data ?? [];
  const reachable = walkableTilesReachableFromArrivals('printshop', maps);
  const npcTiles = new Set((map.layers.find(item => item.name === 'NPCs')?.objects ?? []).map(object =>
    `${Math.floor(object.x / map.tilewidth)},${Math.floor(object.y / map.tileheight)}`));
  const occupied = map.layers.flatMap(item => item.objects ?? []).map(object => ({
    x: Math.floor(object.x / map.tilewidth), y: Math.floor(object.y / map.tileheight),
  }));
  let nextId = Math.max(map.nextobjectid ?? 1,
    ...map.layers.flatMap(item => item.objects ?? []).map(object => object.id + 1));
  for (const shelf of MAIN01_STORAGE_SHELVES) {
    if (attached.has(shelf.id)) continue;
    const candidates = [];
    for (let y = 1; y < map.height - 1; y += 1) for (let x = 1; x < map.width - 1; x += 1) {
      if (collision[y * map.width + x] !== 0 || !reachable.has(`${x},${y}`) || npcTiles.has(`${x},${y}`)
        || occupied.some(point => Math.abs(point.x - x) + Math.abs(point.y - y) <= 2)) continue;
      candidates.push({ x, y });
    }
    if (!candidates.length) throw new Error(`No reachable tile for MAIN01 shelf ${shelf.id}`);
    const point = candidates[0];
    layer.objects.push({ id: nextId++, name: shelf.labelKo, type: 'inspectable', x: point.x * map.tilewidth,
      y: point.y * map.tileheight, width: map.tilewidth, height: map.tileheight, visible: true,
      properties: [{ name: 'v47StorageShelf', type: 'string', value: shelf.id },
        { name: 'availableDate', type: 'string', value: '1848-11-01' },
        { name: 'storyTextKo', type: 'string', value: shelf.promptKo }] });
    occupied.push(point);
  }
  map.nextobjectid = Math.max(map.nextobjectid ?? 1, nextId);
}

export function createMain01StorageState() {
  return { schemaVersion: 'V47_MAIN01_STORAGE_V1', status: 'IN_PROGRESS', placements: {}, risk: 0,
    riskedPacketIds: [], attempts: 0, startedDate: null, completedDate: null, completedBy: null };
}

export function placeMain01StoragePacket(previousState, shelfId, packetId, actorId, date) {
  const state = structuredClone(previousState ?? createMain01StorageState());
  if (state.status === 'COMPLETE') return { accepted: false, state, reason: 'already_complete' };
  const shelf = MAIN01_STORAGE_SHELVES.find(item => item.id === shelfId);
  const packet = MAIN01_STORAGE_PACKETS.find(item => item.id === packetId);
  if (!shelf || !packet || !actorId || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
    return { accepted: false, state, reason: 'storage_item_unavailable' };
  }

  state.startedDate ??= date;
  state.attempts += 1;
  delete state.placements[packetId];
  const displaced = Object.entries(state.placements).find(([, placement]) => placement.shelfId === shelfId)?.[0];
  if (displaced) delete state.placements[displaced];
  const correct = packet.shelfId === shelfId;
  state.placements[packetId] = { shelfId, correct, actorId, date };
  const riskDelta = !correct && !state.riskedPacketIds.includes(packetId) ? 1 : 0;
  if (riskDelta) state.riskedPacketIds.push(packetId);
  state.risk += riskDelta;
  const complete = MAIN01_STORAGE_PACKETS.every(item => state.placements[item.id]?.correct === true);
  const effects = { riskDelta, item: null };
  if (complete) {
    state.status = 'COMPLETE';
    state.completedDate = date;
    state.completedBy = actorId;
    effects.item = { hostId: actorId, itemKo: '연감 창고 분류표' };
  }
  return { accepted: true, state, correct, complete, effects };
}
