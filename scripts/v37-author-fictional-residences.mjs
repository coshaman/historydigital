import fs from 'node:fs';
import path from 'node:path';

const characterDir = path.resolve('rpg/characters');
const mapDir = path.resolve('rpg/maps');
const cards = fs.readdirSync(characterDir).filter(file => file.endsWith('.json'))
  .map(file => ({ file, card: JSON.parse(fs.readFileSync(path.join(characterDir, file), 'utf8')) }))
  .filter(({ card }) => card.kind === 'FICTIONAL')
  .sort((a, b) => a.card.id.localeCompare(b.card.id));
const maps = Object.fromEntries(fs.readdirSync(mapDir).filter(file => file.endsWith('.json'))
  .map(file => {
    const map = JSON.parse(fs.readFileSync(path.join(mapDir, file), 'utf8'));
    return [map.mapId, map];
  }));
const preferredMaps = {
  editor_sofia: 'printshop',
  police_sergeant_ivan: 'police-station',
  senior_clerk_konstantin: 'nevsky',
  reader_darya: 'nevsky',
  warehouse_pyotr: 'market-quay',
};
const streetSleeperId = 'street_vendor_matryona';
const occupiedByMap = new Map();
const positionsByMap = new Map();

function layer(map, name) { return map.layers.find(item => item.name === name); }
function tileFree(map, x, y) {
  const collision = layer(map, 'Collision');
  return Number.isInteger(x) && Number.isInteger(y) && x > 0 && y > 0 && x < map.width - 1 && y < map.height - 1
    && collision?.data[y * map.width + x] === 0;
}
function nextResidentialTile(mapId) {
  const map = maps[mapId];
  const occupied = occupiedByMap.get(mapId) ?? new Set();
  const positions = positionsByMap.get(mapId) ?? [];
  const objectTiles = (layer(map, 'Interactions')?.objects ?? []).map(item => ({ x: Math.floor(item.x / 16), y: Math.floor(item.y / 16) }));
  const npcTiles = (layer(map, 'NPCs')?.objects ?? []).map(item => ({ x: Math.floor(item.x / 16), y: Math.floor(item.y / 16) }));
  const candidates = [];
  for (let y = 1; y < map.height - 1; y += 1) for (let x = 1; x < map.width - 1; x += 1) {
    const key = `${x},${y}`;
    if (!tileFree(map, x, y) || occupied.has(key)) continue;
    if ([...objectTiles, ...npcTiles].some(point => Math.abs(point.x - x) + Math.abs(point.y - y) <= 1)) continue;
    const crowded = positions.reduce((sum, point) => sum + (Math.abs(point.x - x) + Math.abs(point.y - y) < 3 ? 1 : 0), 0);
    const centerBias = Math.abs(x - Math.floor(map.width / 2)) + Math.abs(y - Math.floor(map.height / 2));
    candidates.push({ x, y, score: crowded * 50 + centerBias });
  }
  candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
  const point = candidates[0];
  if (!point) throw new Error(`No unoccupied residential tile remains on ${mapId}`);
  occupied.add(`${point.x},${point.y}`);
  positions.push({ x: point.x, y: point.y });
  occupiedByMap.set(mapId, occupied);
  positionsByMap.set(mapId, positions);
  return { x: point.x, y: point.y };
}
function residenceKind(card) {
  if (card.id === 'police_sergeant_ivan') return ['BARRACKS_BED', '관할 숙소의 병영 침상'];
  if (card.id === 'warehouse_pyotr') return ['WAREHOUSE_BUNK', '부두 창고 위층의 허구 잠자리'];
  if (card.wealthBracket === 'dependent_on_employer') return ['LIVE_IN_ROOM', '고용주 집의 허구 거처'];
  if (card.wealthBracket === 'comfortable') return ['PRIVATE_RENTED_ROOM', '허구의 단독 셋방'];
  if (['poor', 'precarious'].includes(card.wealthBracket)) return ['TENEMENT_ROOM', '허구의 공동주택 셋방'];
  return ['BOARDING_ROOM', '허구의 하숙방'];
}

if (cards.length !== 36) throw new Error(`Expected 36 fictional runtime residents, received ${cards.length}`);
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ status: 'PREVIEW_ONLY', fictionalResidents: cards.length,
    existingAuthored: cards.filter(({ card }) => Boolean(card.housing || card.household)).length,
    residenceRecordsToDesign: cards.filter(({ card }) => !card.housing && !card.household).length,
    note: 'No files changed. Pass --apply to regenerate explicitly labeled fictional scenario residences.' }, null, 2));
  process.exit(0);
}
let authored = 0, clearedRedundant = 0;
for (const { file, card } of cards) {
  if (card.residence?.valueStatus === 'FICTIONAL_GAMEPLAY_DESIGN') {
    delete card.residence;
    fs.writeFileSync(path.join(characterDir, file), `${JSON.stringify(card, null, 2)}\n`);
    clearedRedundant += 1;
  }
}
for (const { file, card } of cards) {
  if (card.housing || card.household || card.residence) continue;
  if (card.id === streetSleeperId) {
    const sleepLocation = { mapId: 'nevsky', position: { x: 8, y: 16 } };
    const lastDutyMinute = Math.max(...card.schedule.map(slot => slot.atMinute));
    const preferredSleepMinute = Math.max(1020, Math.min(1260, lastDutyMinute + 120));
    const sleepMinute = [preferredSleepMinute, preferredSleepMinute - 60, preferredSleepMinute + 60, 1140, 1200, 1260]
      .find(minute => minute >= 1020 && minute <= 1380 && !card.schedule.some(slot => slot.atMinute === minute));
    if (!Number.isInteger(sleepMinute)) throw new Error(`No outdoor sleep schedule slot for ${card.id}`);
    card.residence = {
      kind: 'STREET_SLEEPER',
      homeLocation: null,
      sleepLocation,
      sleepMinute,
      unitLabelKo: '정해진 방 없이 거리에서 잠을 청함',
      status: 'FICTIONAL_CHARACTER_DESIGN',
      valueStatus: 'FICTIONAL_GAMEPLAY_DESIGN',
      designBasisKo: '역사적 주민 사실이 아닌 허구 생활 시뮬레이션 설정. 고정 거처 없이 공개 거리에서 잠을 청하며, 지도 위치는 게임 장면 배치다.',
    };
  } else {
    const mapId = preferredMaps[card.id] ?? 'courtyard';
    const map = maps[mapId];
    if (!map || !['REAL_WORLD_RECONSTRUCTION', 'FICTIONAL_CIVIC_RECONSTRUCTION'].includes(map.metadata?.mapClass)) {
      throw new Error(`Invalid residence map for ${card.id}: ${mapId}`);
    }
    const position = nextResidentialTile(mapId);
    const [kind, unitLabelKo] = residenceKind(card);
    const lastDutyMinute = Math.max(...card.schedule.map(slot => slot.atMinute));
    const typeOffset = kind === 'PRIVATE_RENTED_ROOM' ? 210 : kind === 'BARRACKS_BED' ? 120 : 150;
    const preferredSleepMinute = Math.max(1020, Math.min(1320, lastDutyMinute + typeOffset));
    const sleepMinute = [preferredSleepMinute, preferredSleepMinute - 60, preferredSleepMinute + 60, 1140, 1380]
      .find(minute => minute >= 1020 && minute <= 1380 && !card.schedule.some(slot => slot.atMinute === minute));
    if (!Number.isInteger(sleepMinute)) throw new Error(`No free overnight schedule slot for ${card.id}`);
    card.residence = {
      kind,
      homeLocation: { mapId, position },
      sleepLocation: { mapId, position },
      sleepMinute,
      unitLabelKo,
      status: 'FICTIONAL_CHARACTER_DESIGN',
      valueStatus: 'FICTIONAL_GAMEPLAY_DESIGN',
      designBasisKo: '역사적 주소나 실제 동거 관계가 아닌 허구 생활 시뮬레이션용 거처. 지도 타일은 게임 내 귀가·취침 동선의 목적지다.',
    };
    card.allowedMaps ??= [];
    if (!card.allowedMaps.includes(mapId)) card.allowedMaps.push(mapId);
  }
  fs.writeFileSync(path.join(characterDir, file), `${JSON.stringify(card, null, 2)}\n`);
  authored += 1;
}
console.log(JSON.stringify({ status: 'PASS', fictionalResidents: cards.length, authoredResidenceRecords: authored, clearedRedundant,
  streetSleepers: cards.filter(({ card }) => card.residence?.kind === 'STREET_SLEEPER').map(({ card }) => card.id),
  mapCounts: Object.fromEntries([...positionsByMap].map(([mapId, positions]) => [mapId, positions.length])) }, null, 2));
