import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const mapDir = path.join(root, 'rpg/maps');
const read = async (name) => JSON.parse(await readFile(path.join(mapDir, `${name}.json`), 'utf8'));
const write = async (map) => writeFile(path.join(mapDir, `${map.mapId}.json`), `${JSON.stringify(map, null, 2)}\n`, 'utf8');
const sourceRegister = JSON.parse(await readFile(path.join(root,'docs/v36/historical-map-source-register.json'),'utf8'));
const sourceIds = new Set(sourceRegister.sources.map(item=>item.sourceId));
const sourcesRegisterId = id => sourceIds.has(id) ? id : sourceRegister.sources.find(item=>item.legacySourceIds?.includes(id))?.sourceId;
const objectsFor = map => map.layers.find(layer=>layer.name==='Interactions')?.objects ?? [];
const configs = [
  { id: 'bookshop-lane', template: 'nevsky', title: '책방 골목', districtId: 'BOOKS_AND_READING', type: 'street', basis: '1843년 도시 안내서의 상업 시설 조사 범주와 1845년 도시 문학의 거리 생활을 참고한 비지리 고정 재구성.' },
  { id: 'canal-road', template: 'market-quay', title: '운하와 하역 길', districtId: 'CANAL_TRANSPORT', type: 'street', basis: '1840년대 도시 평면의 수로 맥락과 콜만의 1840년대 운송·거리 풍경을 참고한 비지리 고정 재구성.' },
  { id: 'workyard', template: 'courtyard', title: '공동 뒤뜰 작업장', districtId: 'HOUSEHOLD_WORKYARD', type: 'street', basis: '1845년 도시 문학의 дворник·주거 골목 묘사를 참고한 가상 공동 뒤뜰. 실제 주소나 대표적 주거 형태라는 주장은 하지 않음.' },
  { id: 'bookshop-interior', template: 'printshop', title: '책방 안쪽', districtId: 'BOOKS_AND_READING', type: 'interior', basis: '1843년 안내서와 1845년 도시 문학을 참고해 구성한 가상 상점 실내. 특정 점포·실제 주소를 주장하지 않음.', estates: ['petty_bourgeois','urban_artisan','urban_literate_worker','gentry_household_tutor'], hostIds: ['bookseller_lev','reader_darya','student_vasily','teacher_lyubov'] },
  { id: 'bakery-interior', template: 'printshop', title: '작은 빵 굽는 방', districtId: 'MARKET_QUAY', type: 'interior', basis: '1840년대 도시 상업·운송 자료를 참고해 구성한 가상 제빵 작업실. 개별 점포의 사료 복원은 아님.', estates: ['petty_bourgeois','urban_artisan','urban_laborer','urban_service_worker','service_class'], hostIds: ['baker_fyodor','market_nadezhda','porter_gavrila','laundress_mariya'] },
  { id: 'inn-interior', template: 'courtyard', title: '하숙집 공동방', districtId: 'COURTYARD_HOUSEHOLD', type: 'interior', basis: '1845년 도시 문학의 하숙·주거 공간 묘사를 참고한 허구 공동방. 실제 여관이나 주소의 기록으로 제시하지 않음.', estates: ['urban_laborer','urban_service_worker','service_class','urban_literate_worker','gentry_household_tutor'], hostIds: ['innkeeper_irina','courier_pavel','teacher_lyubov','lodging_tatyana','tenant_mikhail'] },
  { id: 'sewing-room', template: 'printshop', title: '바느질 셋방', districtId: 'HOUSEHOLD_WORKYARD', type: 'interior', basis: '가사·수선 노동을 보여주기 위한 허구의 작업방. 방 배치와 소품은 게임 재구성이며 특정 가구의 사료 복원이 아님.', estates: ['urban_laborer','urban_artisan','service_class','urban_service_worker'], hostIds: ['seamstress_anna','laundress_mariya','housemaid_olga','servant_varvara'] },
  { id: 'communal-room', template: 'courtyard', title: '안뜰 공동 부엌', districtId: 'HOUSEHOLD_WORKYARD', type: 'interior', basis: '공동 주거와 물 사용을 다루는 허구의 부엌. 특정 1847년 건물·가구의 재현으로 주장하지 않음.', estates: ['urban_laborer','urban_service_worker','service_class','urban_artisan'], hostIds: ['yardkeeper_semyon','landlady_polina','watercarrier_luka','midwife_avdotya','housemaid_olga','tenant_mikhail'] },
];
const propsByMap = {
  'bookshop-lane': { floor:[43,44,46,47], objects:[['책을 내놓은 가판',27,6,8,'오늘 팔 책을 추려 놓았다. 값표가 없는 책은 주인에게 먼저 물어야 한다.'],['서점 간판',14,18,5,'간판은 가게의 이름만 알릴 뿐, 안쪽 장부까지 보여주지는 않는다.'],['배달 장부',21,22,10,'받은 책과 돌려보낼 책을 가르는 허구의 장부다.']] },
  'canal-road': { floor:[49,50,51,52], objects:[['짐 상자',31,7,8,'상자 옆에 받는 곳이 적혀 있다. 안의 물건이 도착했는지는 아직 확인되지 않았다.'],['운반 장부판',21,16,11,'하역 순서와 품삯을 적는 허구의 표다.'],['수레 짐칸',35,24,7,'빈 수레가 다음 짐을 기다린다. 어느 쪽으로 갈지는 마부에게 물어야 한다.']] },
  workyard: { floor:[54,55,56,57], objects:[['공용 물동이',34,5,5,'물을 함께 쓰는 자리가 비어 있다. 누가 먼저 길어 갈지는 정해져 있지 않다.'],['수선 작업대',22,15,5,'바느질감과 작은 공구가 놓이는 허구의 공동 작업대다.'],['뒷마당 관리함',27,18,11,'물과 장작을 나눠 쓴 표시가 남아 있다. 이름과 날짜는 적히지 않았다.']] },
  'bookshop-interior': { floor:[58,59,60], objects:[['책 선반',20,5,5,'팔리지 않은 책이 안쪽 칸에 남아 있다. 재고와 독자의 형편은 장부에서 따로 확인해야 한다.'],['서가 표지',14,17,5,'책을 찾는 손님이 보도록 둔 표지다. 실제 점포의 간판을 복원한 것은 아니다.'],['입고 책 묶음',24,9,10,'새로 들어온 책 묶음이다. 외상인지 완납인지 이 물건만으로는 알 수 없다.']] },
  'bakery-interior': { floor:[5,6], objects:[['빵 작업대',27,5,5,'반죽을 나누고 굽기 전 빵을 놓는 허구의 작업대다. 남은 밀가루는 장부와 함께 봐야 한다.'],['밀가루 자루',33,17,5,'자루의 무게와 품삯을 따로 적어 둔다. 표시된 수치는 게임을 위한 설정이다.'],['굽기 전 빵판',35,9,10,'오늘 구울 몫과 내일로 미룰 몫을 나누어 둔다.']] },
  'inn-interior': { floor:[49,50,51,52], objects:[['공용 침상',18,5,5,'사람이 머무는 자리를 표시한 허구의 소품이다. 빈자리와 사용료는 주인에게 확인해야 한다.'],['작은 공동 식탁',22,17,5,'식사와 대화를 나누는 탁자다. 누가 앉을지는 정해져 있지 않다.'],['숙박 장부',21,9,10,'방세를 적는 게임 속 장부다. 인물별 비용과 날짜는 실제 기록이 아니다.']] },
  'sewing-room': { floor:[5,6], objects:[['바느질 틀',32,5,5,'천을 고정해 꿰매는 허구의 작업 도구다. 오늘 맡은 수선감이 옆에 놓여 있다.'],['옷감 작업대',22,17,5,'옷감과 바늘을 펼쳐 놓는 자리다. 주문과 품삯은 따로 기록해야 한다.'],['실·단추 함',34,9,10,'작은 재료를 분류해 둔 함이다. 빌린 물건은 돌려줄 때 표시한다.']] },
  'communal-room': { floor:[54,55,56,57], objects:[['공용 식탁',22,5,5,'여럿이 함께 쓰는 탁자다. 자리를 차지하기 전에 다른 사람 몫을 살펴야 한다.'],['물통과 국자',34,17,5,'물을 받아 두는 허구의 공동 용기다. 남은 물과 길어 올 사람은 다르다.'],['공용 찬장',31,9,10,'그릇과 마른 식량을 나누어 두는 허구의 찬장이다.']] },
};

const originals = Object.fromEntries(await Promise.all(['nevsky','market-quay','courtyard'].map(async id => [id, await read(id)])));
const uniqueWalkable = (map, preferred, occupied = []) => {
  const collision = map.layers.find(layer => layer.name === 'Collision');
  const interaction = map.layers.find(layer => layer.name === 'Interactions');
  const taken = [...occupied, ...(interaction?.objects ?? []).filter(object => object.type === 'map-exit').map(object => ({ x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) }))];
  const candidates = [];
  for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
    if (collision.data[y * map.width + x] !== 0 || taken.some(point => Math.abs(point.x - x) + Math.abs(point.y - y) < 4)) continue;
    const dist = Math.abs(x - preferred.x) + Math.abs(y - preferred.y);
    const npcs = (map.layers.find(layer => layer.name === 'NPCs')?.objects ?? []).map(object => ({ x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) }));
    if (npcs.some(point => Math.abs(point.x - x) + Math.abs(point.y - y) < 3)) continue;
    candidates.push({ x, y, dist });
  }
  candidates.sort((a,b) => a.dist - b.dist || a.y - b.y || a.x - b.x);
  if (!candidates.length) throw new Error(`no free door tile in ${map.mapId}`);
  return { x: candidates[0].x, y: candidates[0].y };
};
const addExit = (map, { name, id, target, arrival, returnId, publicAccess, doorId, districtId }) => {
  const layer = map.layers.find(item => item.name === 'Interactions');
  const tile = uniqueWalkable(map, map.metadata.observerStart);
  const objectId = Math.max(0, ...map.layers.flatMap(item => item.objects ?? []).map(object => object.id ?? 0)) + 1;
  layer.objects.push({ id: objectId, name, type: 'map-exit', x: tile.x * 16, y: tile.y * 16, width: 16, height: 16, visible: true, properties: [
    { name: 'exitId', type: 'string', value: id }, { name: 'targetMapId', type: 'string', value: target },
    { name: 'arrivalX', type: 'int', value: arrival.x }, { name: 'arrivalY', type: 'int', value: arrival.y },
    { name: 'returnExitId', type: 'string', value: returnId }, { name: 'publicAccess', type: 'bool', value: publicAccess },
    { name: 'doorId', type: 'string', value: doorId }, { name: 'districtId', type: 'string', value: districtId },
  ] });
  map.nextobjectid = Math.max(map.nextobjectid ?? 1, objectId + 1);
  return tile;
};
const syncProperties = map => {
  for (const property of map.properties ?? []) {
    if (property.name === 'mapId') property.value = JSON.stringify(map.mapId);
    if (property.name === 'displayNameKo') property.value = JSON.stringify(map.metadata.displayNameKo);
    if (property.name === 'observerStart') property.value = JSON.stringify(map.metadata.observerStart);
    if (property.name === 'districtId') property.value = JSON.stringify(map.metadata.districtId);
  }
};
const setTileObjectScene = (map, mapId) => {
  const layout=propsByMap[mapId], interaction=map.layers.find(layer=>layer.name==='Interactions'), collision=map.layers.find(layer=>layer.name==='Collision');
  if(!layout)return;
  interaction.objects=[];
  for(const [index,[name,assetTileId,x,y,storyTextKo]] of layout.objects.entries()){
    const cell=y*map.width+x;
    collision.data[cell]=1;
    interaction.objects.push({id:4000+index,name,type:'inspectable',x:x*16,y:y*16,width:16,height:16,visible:true,properties:[
      {name:'assetTileId',type:'int',value:assetTileId},{name:'scope',type:'string',value:'fictional_scene_prop'},{name:'storyTextKo',type:'string',value:storyTextKo},
    ]});
  }
  map.nextobjectid=Math.max(map.nextobjectid??1,4000+layout.objects.length);
};
const configureInterior = (map,mapId) => {
  const layout=propsByMap[mapId], ground=map.layers.find(layer=>layer.name==='Ground'), architecture=map.layers.find(layer=>layer.name==='Architecture'), collision=map.layers.find(layer=>layer.name==='Collision');
  if(!layout)return;
  for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
    const index=y*map.width+x, edge=x===0||y===0||x===map.width-1||y===map.height-1;
    const floors=layout.floor;
    if(!edge){ground.data[index]=floors[(x+y*2)%floors.length];architecture.data[index]=0;collision.data[index]=0;}
    if(edge)collision.data[index]=1;
  }
  map.metadata.observerStart={x:11,y:14};
  const propCells=layout.objects.map(item=>({x:item[2],y:item[3]}));
  for(const point of propCells)collision.data[point.y*map.width+point.x]=1;
};

for (const config of configs) {
  const map = structuredClone(await read(config.template));
  const actualEstates = config.hostIds ? await Promise.all(config.hostIds.map(async id => JSON.parse(await readFile(path.join(root,'rpg/characters',`${id}.json`),'utf8')).socialEstate)) : [];
  map.name = config.id; map.mapId = config.id;
  map.metadata = { ...map.metadata, mapId: config.id, displayNameKo: config.title, districtId: config.districtId,
    geography: config.type === 'interior' ? `fictional ${config.title} interior; no specific historical address or room is claimed` : `fictional, non-georeferenced ${config.title} street scene`,
    mapClass: 'REAL_WORLD_RECONSTRUCTION', basisKo: config.basis,
    access: config.type === 'interior' ? { doorId: `door-${config.id}`, districtId: config.districtId, subLocationId: config.id,
      allowedEstates: [...new Set([...config.estates,...actualEstates])], allowedCharacterIds: config.hostIds, opensMinute: 360, closesMinute: 1200, openHours: { opensMinute: 360, closesMinute: 1200 },
      openingHoursBasis: '게임 시뮬레이션 가정; 특정 1840년대 업소의 영업시간을 주장하지 않음', sourceEvidenceIds: config.districtId === 'MARKET_QUAY' ? ['V36-ART-RUSSIAN-MUSEUM-COLLMANN-1840S','V36-GUIDE-PUSHKAREV-1843'] : ['V36-PHYSIOLOGY-PETERSBURG-1845','V36-GUIDE-PUSHKAREV-1843'], ambientSoundId: config.districtId === 'MARKET_QUAY' ? 'indoor-market' : 'indoor-household', validFrom: '1847-06-01', validTo: '1849-05-31', reconstructionBasis: config.basis } : undefined,
    sourceIds: config.districtId === 'MARKET_QUAY' ? ['V36-ART-RUSSIAN-MUSEUM-COLLMANN-1840S','V36-GUIDE-PUSHKAREV-1843'] : ['V36-PHYSIOLOGY-PETERSBURG-1845','V36-GUIDE-PUSHKAREV-1843'] };
  for (const layer of map.layers) if (layer.name === 'NPCs') layer.objects = [];
  configureInterior(map,config.id);
  setTileObjectScene(map,config.id);
  const interactions = map.layers.find(layer => layer.name === 'Interactions');
  for (const layer of map.layers.filter(item => item.type === 'tilelayer')) { layer.width = map.width; layer.height = map.height; }
  syncProperties(map);
  await write(map);
}

const newMaps = Object.fromEntries(await Promise.all(configs.map(async config => [config.id, await read(config.id)])));
const streetLinks = [
  { from: originals.nevsky, to: newMaps['bookshop-lane'], outward: 'nevsky-bookshop-lane', inward: 'bookshop-lane-nevsky', districtId: 'BOOKS_AND_READING', title: '책방 골목으로 가는 길' },
  { from: originals['market-quay'], to: newMaps['canal-road'], outward: 'market-canal-road', inward: 'canal-road-market', districtId: 'CANAL_TRANSPORT', title: '운하 하역 길' },
  { from: originals.courtyard, to: newMaps.workyard, outward: 'courtyard-workyard', inward: 'workyard-courtyard', districtId: 'HOUSEHOLD_WORKYARD', title: '뒤뜰 작업장 문' },
];
for (const map of [...Object.values(originals), ...Object.values(newMaps)]) {
  const interaction = map.layers.find(layer => layer.name === 'Interactions');
  interaction.objects = interaction.objects.filter(object => !['nevsky-bookshop-lane','bookshop-lane-nevsky','market-canal-road','canal-road-market','courtyard-workyard','workyard-courtyard','bookshop-lane-bookshop','bookshop-interior-lane','market-bakery','bakery-market','courtyard-inn','inn-courtyard','workyard-sewing','sewing-workyard','workyard-communal','communal-workyard'].includes(Object.fromEntries((object.properties ?? []).map(property => [property.name, property.value])).exitId));
}
for (const link of streetLinks) {
  const outsideArrival = uniqueWalkable(link.from, link.from.metadata.observerStart);
  const streetDoor = addExit(link.from, { name: link.title, id: link.outward, target: link.to.mapId,
    arrival: link.to.metadata.observerStart, returnId: link.inward, publicAccess: true, doorId: `door-${link.outward}`, districtId: link.districtId });
  addExit(link.to, { name: '기존 거리로 돌아가기', id: link.inward, target: link.from.mapId,
    arrival: outsideArrival, returnId: link.outward, publicAccess: true, doorId: `door-${link.outward}`, districtId: link.districtId });
  link.streetDoor = streetDoor;
}
const roomLinks = [
  ['bookshop-lane','bookshop-interior','bookshop-lane-bookshop','bookshop-interior-lane'],
  ['market-quay','bakery-interior','market-bakery','bakery-market'],
  ['courtyard','inn-interior','courtyard-inn','inn-courtyard'],
  ['workyard','sewing-room','workyard-sewing','sewing-workyard'],
  ['workyard','communal-room','workyard-communal','communal-workyard'],
];
for (const [outsideId, roomId, outId, backId] of roomLinks) {
  const outside = newMaps[outsideId] ?? originals[outsideId];
  const room = newMaps[roomId];
  const outsideArrival = uniqueWalkable(outside, outside.metadata.observerStart);
  addExit(outside, { name: `${room.metadata.displayNameKo} 출입문`, id: outId, target: roomId,
    arrival: room.metadata.observerStart, returnId: backId, publicAccess: false, doorId: `door-${roomId}`, districtId: room.metadata.districtId });
  const roomDoorTile = addExit(room, { name: '거리로 나가는 문', id: backId, target: outsideId,
    arrival: outsideArrival, returnId: outId, publicAccess: false, doorId: `door-${roomId}`, districtId: room.metadata.districtId });
  room.metadata.access.tileCoord = roomDoorTile;
}
for (const map of Object.values(originals)) await write(map);
for (const map of Object.values(newMaps)) await write(map);

const registryPath = path.join(root, 'rpg/data/city-districts-v36.json');
const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const districtConfig = [
  { id: 'BOOKS_AND_READING', nameKo: '책방과 읽을거리 골목', mapIds: ['bookshop-lane','bookshop-interior'], entryMapId: 'bookshop-lane', interiorMapIds: ['bookshop-interior'], residentIds: ['bookseller_lev','reader_darya','student_vasily','teacher_lyubov'], sourceEvidence: [{ sourceId:'V36-GUIDE-PUSHKAREV-1843', sourceType:'PERIOD_TEXT', use:'도시의 시설과 상업을 조사하는 동시대 안내서. 개별 가게 주소는 검증 전까지 주장하지 않음.' },{ sourceId:'V36-PHYSIOLOGY-PETERSBURG-1845', sourceType:'PERIOD_TEXT', use:'독서·거리 생활의 문학적 참고 자료이며 대표 통계로 사용하지 않음.' }], gameTransformation:'가상 책방 골목과 점포 내부. 지도상 위치·주소와 개별 상인은 창작 재구성.' },
  { id: 'CANAL_TRANSPORT', nameKo: '운하와 하역 길', mapIds: ['canal-road'], entryMapId: 'canal-road', interiorMapIds: [], residentIds: ['carter_roman','coachman_timofey','porter_gavrila','warehouse_pyotr','fishseller_klavdiya','watercarrier_luka'], sourceEvidence: [{ sourceId:'V36-MAP-NLR-19C-PLANS', sourceType:'PERIOD_MAP', use:'수로와 도시의 넓은 맥락만 참고. 정확한 인게임 지점은 주장하지 않음.' },{ sourceId:'V36-ART-RUSSIAN-MUSEUM-COLLMANN-1840S', sourceType:'PERIOD_PAINTING', use:'운송·거리 활동의 시각 참고이며 개별 장면의 고증으로 제시하지 않음.' },{ sourceId:'V36-GUIDE-PUSHKAREV-1843', sourceType:'PERIOD_TEXT', use:'시설과 이동 수단 조사 범주 참고.' }], gameTransformation:'비지리 고정 가상 운송 지구. 특정 운하 구간·부두의 정확한 복원이 아님.' },
  { id: 'HOUSEHOLD_WORKYARD', nameKo: '공동 뒤뜰의 일터', mapIds: ['workyard','sewing-room','communal-room'], entryMapId: 'workyard', interiorMapIds: ['sewing-room','communal-room'], residentIds: ['seamstress_anna','laundress_mariya','housemaid_olga','servant_varvara','yardkeeper_semyon','tenant_mikhail','landlady_polina','midwife_avdotya'], sourceEvidence: [{ sourceId:'V36-PHYSIOLOGY-PETERSBURG-1845', sourceType:'PERIOD_TEXT', use:'도시 주거·일상의 문학적 관찰이며 대표 통계가 아님.' },{ sourceId:'V36-GUIDE-PUSHKAREV-1843', sourceType:'PERIOD_TEXT', use:'도시 시설의 동시대 안내서. 특정 가구의 실내 배치를 입증하지 않음.' },{ sourceId:'V36-MAP-NLR-19C-PLANS', sourceType:'PERIOD_MAP', use:'도시 블록의 넓은 맥락만 참고하고 주소·건물은 창작함.' }], gameTransformation:'가상 뒤뜰과 공동 작업 공간. 이름 있는 실제 건물이나 세입자 구성의 복원이라는 주장은 없음.' },
];
const expansionDistrictIds = new Set(districtConfig.map(item => item.id));
registry.districts = registry.districts.filter(district => !expansionDistrictIds.has(district.id));
const expansionExitIds = new Set(['nevsky-bookshop-lane','bookshop-lane-nevsky','market-canal-road','canal-road-market','courtyard-workyard','workyard-courtyard','bookshop-lane-bookshop','bookshop-interior-lane','market-bakery','bakery-market','courtyard-inn','inn-courtyard','workyard-sewing','sewing-workyard','workyard-communal','communal-workyard']);
for (const district of registry.districts) district.connections = (district.connections ?? []).filter(connection => !expansionExitIds.has(connection.exitId));
const metadataFor = id => configs.find(config => config.id === id);
for (const district of registry.districts) {
  const additions = district.id === 'MARKET_QUAY' ? ['bakery-interior'] : district.id === 'COURTYARD_HOUSEHOLD' ? ['inn-interior'] : [];
  district.mapIds = [...new Set([...district.mapIds, ...additions])];
  district.interiorMapIds = [...new Set([...(district.interiorMapIds ?? []), ...additions.filter(id => id.endsWith('interior'))])];
}
const connections = [
  ['NEVSKY_COMMERCIAL','nevsky','nevsky-bookshop-lane','bookshop-lane'],
  ['MARKET_QUAY','market-quay','market-canal-road','canal-road'],
  ['COURTYARD_HOUSEHOLD','courtyard','courtyard-workyard','workyard'],
  ['MARKET_QUAY','market-quay','market-bakery','bakery-interior'],
  ['COURTYARD_HOUSEHOLD','courtyard','courtyard-inn','inn-interior'],
];
for (const [districtId, fromMapId, exitId, toMapId] of connections) registry.districts.find(item => item.id === districtId).connections.push({ fromMapId, exitId, toMapId, districtTransition: (newMaps[toMapId] ?? originals[toMapId])?.metadata?.districtId !== districtId });
for (const district of districtConfig) {
  const outward = district.id === 'BOOKS_AND_READING' ? 'bookshop-lane-nevsky' : district.id === 'CANAL_TRANSPORT' ? 'canal-road-market' : 'workyard-courtyard';
  const back = district.id === 'BOOKS_AND_READING' ? 'nevsky-bookshop-lane' : district.id === 'CANAL_TRANSPORT' ? 'market-canal-road' : 'courtyard-workyard';
  district.connections = [{ fromMapId: district.entryMapId, exitId: outward, toMapId: district.id === 'BOOKS_AND_READING' ? 'nevsky' : district.id === 'CANAL_TRANSPORT' ? 'market-quay' : 'courtyard', districtTransition: true }, ...roomLinks.filter(link => link[0] === district.entryMapId).map(link => ({ fromMapId: link[0], exitId: link[2], toMapId: link[1] }))];
  registry.districts.push({ ...district, prototypeStatus: 'PHASE_2_PLAYABLE_DISTRICT' });
}
await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

const allowedUpdates = {
  bookseller_lev: ['bookshop-lane','bookshop-interior'], reader_darya: ['bookshop-lane','bookshop-interior'], student_vasily: ['bookshop-lane','bookshop-interior'], teacher_lyubov: ['bookshop-lane','bookshop-interior','inn-interior'],
  carter_roman: ['canal-road'], coachman_timofey: ['canal-road'], porter_gavrila: ['canal-road'], warehouse_pyotr: ['canal-road'], fishseller_klavdiya: ['canal-road'], watercarrier_luka: ['canal-road'],
  baker_fyodor: ['bakery-interior'], market_nadezhda: ['bakery-interior'], porter_gavrila: ['canal-road','bakery-interior'], laundress_mariya: ['bakery-interior','workyard','sewing-room'],
  innkeeper_irina: ['inn-interior'], courier_pavel: ['inn-interior'], lodging_tatyana: ['inn-interior'], tenant_mikhail: ['inn-interior','communal-room','workyard'],
  seamstress_anna: ['workyard','sewing-room'], housemaid_olga: ['workyard','sewing-room','communal-room'], servant_varvara: ['workyard','sewing-room'], yardkeeper_semyon: ['workyard','communal-room'], landlady_polina: ['workyard','communal-room'], midwife_avdotya: ['workyard','communal-room'],
};
const scheduleUpdates = { bookseller_lev: ['bookshop-interior',660], teacher_lyubov:['bookshop-interior',780], baker_fyodor:['bakery-interior',780], market_nadezhda:['bakery-interior',780], innkeeper_irina:['inn-interior',960], seamstress_anna:['sewing-room',900], yardkeeper_semyon:['workyard',840], watercarrier_luka:['canal-road',780] };
for (const [id, additions] of Object.entries(allowedUpdates)) {
  const file = path.join(root, 'rpg/characters', `${id}.json`), card = JSON.parse(await readFile(file,'utf8'));
  card.allowedMaps = [...new Set([...card.allowedMaps, ...additions])];
  if (scheduleUpdates[id]) {
    const [mapId, atMinute] = scheduleUpdates[id], map = newMaps[mapId];
    card.schedule = card.schedule.filter(slot => slot.atMinute !== atMinute);
    card.schedule.push({ atMinute, mapId, position: { ...map.metadata.observerStart }, activityKo: `새 생활권에서 맡은 일을 이어간다` });
    card.schedule.sort((a,b) => a.atMinute - b.atMinute);
  }
  await writeFile(file, `${JSON.stringify(card,null,2)}\n`, 'utf8');
}
for (const mapId of ['printshop','chancery','police-station']) {
  const map = await read(mapId), exits = objectsFor(map).filter(object => object.type === 'map-exit');
  const existingDoor = exits[0], doorTile = { x: Math.floor(existingDoor.x / 16), y: Math.floor(existingDoor.y / 16) };
  const allowedCards = await (await import('node:fs/promises')).readdir(path.join(root,'rpg/characters'));
  const hosts=[];
  for (const file of allowedCards.filter(name=>name.endsWith('.json'))) { const card=JSON.parse(await readFile(path.join(root,'rpg/characters',file),'utf8')); if(card.allowedMaps?.includes(mapId)) hosts.push(card); }
  const evidence=map.metadata.sourceIds ?? [];
  const mappedSources=evidence.map(id=>sourcesRegisterId(id)).filter(Boolean);
  map.metadata.access={ doorId:`door-${mapId}`,districtId:map.metadata.districtId,subLocationId:mapId,tileCoord:doorTile,
    allowedEstates:[...new Set(hosts.map(card=>card.socialEstate).filter(Boolean))],allowedCharacterIds:hosts.map(card=>card.id),
    opensMinute:360,closesMinute:1200,openHours:{opensMinute:360,closesMinute:1200},
    openingHoursBasis:'게임 시뮬레이션 가정; 특정 1840년대 기관이나 업소의 영업시간을 주장하지 않음.',
    sourceEvidenceIds:mappedSources,ambientSoundId:mapId==='police-station'?'institution-hall':'workroom',
    validFrom:'1847-06-01',validTo:'1849-05-31',reconstructionBasis:map.metadata.note ?? map.metadata.geography };
  await write(map);
}
console.log(JSON.stringify({ cityDistricts: registry.districts.length, addedMaps: configs.map(item => item.id), addedInteriorCount: configs.filter(item => item.type === 'interior').length, reciprocalDoorPairs: streetLinks.length + roomLinks.length, assignedResidents: Object.keys(allowedUpdates).length }, null, 2));
