import { readFile, writeFile } from 'node:fs/promises';

const read = async file => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
const write = async (file, value) => writeFile(new URL(`../${file}`, import.meta.url), `${JSON.stringify(value, null, 2)}\n`);
const setTiledProperty = (properties, name, value) => {
  const found = properties.find(property => property.name === name);
  if (found) found.value = JSON.stringify(value);
  else properties.push({ name, type: 'string', value: JSON.stringify(value) });
};
const prop = (name, value, type = typeof value === 'boolean' ? 'bool' : 'string') => ({ name, type, value });
const object = (id, name, x, y, properties, type = 'inspectable') => ({
  id, name, type, x, y, width: 16, height: 16, visible: true, properties,
});
const imageProps = (asset, width, height, offsetX, offsetY) => [
  prop('assetTileId', 1, 'int'), prop('scope', 'fictional_scene_prop'),
  prop('displayAsset', asset), prop('displayWidth', width, 'int'), prop('displayHeight', height, 'int'),
  prop('displayOffsetX', offsetX, 'int'), prop('displayOffsetY', offsetY, 'int'),
];

const map = structuredClone(await read('rpg/maps/bookshop-interior.json'));
map.name = map.mapId = 'sofiya-salon';
map.metadata = {
  displayNameKo: '소피야의 응접실',
  observerStart: { x: 12, y: 14 },
  cameraZoom: 1,
  date: '1848-10-21',
  mapClass: 'FICTIONAL_STYLIZED_INTERIOR',
  districtId: 'BOOKS_AND_READING',
  geography: '네프스키 인근을 배경으로 한 허구 응접실. 특정 주소나 실존 가구 배치를 주장하지 않는다.',
  canvasGutterColor: '#47362d',
  sourceIds: [],
  note: 'The room, household, and furnishings are original fictional game art.',
  access: {
    doorId: 'door-sofiya-salon', districtId: 'BOOKS_AND_READING', subLocationId: 'sofiya-salon',
    tileCoord: { x: 5, y: 9 },
    allowedEstates: ['fictional urban gentry household', 'urban_literate_worker', 'urban_laborer', 'gentry_household_tutor', 'petty_bourgeois', 'service_class'],
    allowedCharacterIds: ['sofiya_salon_1848', 'reader_darya', 'editor_sofia', 'panaeva_1848', 'panaev_1848', 'bookseller_lev', 'courier_pavel', 'printer_ekaterina', 'seamstress_anna'],
    opensMinute: 360, closesMinute: 1439,
    openHours: { opensMinute: 360, closesMinute: 1439 },
    openingHoursBasis: '게임 진행을 위한 허구 설정',
    sourceEvidenceIds: [], ambientSoundId: 'indoor-household', validFrom: '1848-10-21', validTo: '1849-05-05',
    reconstructionBasis: '시나리오의 허구 살롱. 실존 주소·가구·영업 시간의 복원이 아니다.',
  },
};
map.properties = map.properties.filter(item => !['mapId', 'displayNameKo', 'observerStart', 'date', 'mapClass', 'geography', 'sourceIds', 'note'].includes(item.name));
for (const [name, value] of Object.entries({
  mapId: 'sofiya-salon', displayNameKo: '소피야의 응접실', observerStart: { x: 12, y: 14 },
  date: '1848-10-21', mapClass: 'FICTIONAL_STYLIZED_INTERIOR', geography: map.metadata.geography,
  sourceIds: [], note: map.metadata.note,
})) setTiledProperty(map.properties, name, value);

const width = map.width, height = map.height;
const layer = name => map.layers.find(item => item.name === name);
layer('Ground').data = Array.from({ length: width * height }, (_, index) => {
  const x = index % width, y = Math.floor(index / width);
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return (x + y) % 2 ? 54 : 55;
  return 49 + ((x + y) % 4);
});
layer('Architecture').data = Array.from({ length: width * height }, (_, index) => {
  const x = index % width, y = Math.floor(index / width);
  if (y === 0 || x === 0 || x === width - 1) return 7;
  if (y === height - 1 && !(x >= 10 && x <= 13)) return 7;
  return 0;
});
layer('Collision').data = Array.from({ length: width * height }, (_, index) => {
  const x = index % width, y = Math.floor(index / width);
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return 1;
  return 0;
});
layer('StreetDetail').data = Array(width * height).fill(0);
layer('Interactions').objects = [
  object(6100, '네프스키 쪽 출입문', 176, 224, [
    prop('exitId', 'sofiya-salon-lane'), prop('targetMapId', 'bookshop-lane'),
    prop('arrivalX', 5, 'int'), prop('arrivalY', 9, 'int'), prop('returnExitId', 'bookshop-lane-sofiya-salon'),
    prop('publicAccess', false, 'bool'), prop('doorId', 'door-sofiya-salon'), prop('districtId', 'BOOKS_AND_READING'),
  ], 'map-exit'),
  object(6101, '거리 쪽 창과 커튼', 208, 16, [...imageProps('../assets/v47/sofiya-curtained-window.svg', 64, 64, -24, -8),
    prop('storyTextKo', '두 겹의 커튼 사이로 네프스키 쪽 불빛이 희미하게 들어온다. 창문 너머의 방과 거리는 보이지만, 안에서 나눈 말까지 들리지는 않는다.')]),
  object(6102, '황동 사모바르', 160, 144, [...imageProps('../assets/v47/sofiya-samovar.svg', 40, 56, -12, -40),
    prop('ambientEffect', 'samovar-steam'),
    prop('storyTextKo', '사모바르 옆에는 찻잔이 몇 개 놓여 있다. 손님을 맞을 준비는 해 두었지만, 누구를 부를지는 아직 정하지 않았다.')]),
  object(6103, '초대 명단', 128, 128, [prop('assetTileId', 21, 'int'), prop('scope', 'fictional_scene_prop'),
    prop('storyTextKo', '이름을 적으면 누가 초대를 받았는지는 남는다. 집 안에서 한 말을 집 밖까지 감출 수 있다는 뜻은 아니다.')]),
  object(6104, '기하무늬 융단', 64, 160, [...imageProps('../assets/v47/sofiya-reading-rug.svg', 128, 56, -16, -40),
    prop('storyTextKo', '낮은 독서대와 의자를 둘 자리를 비워 둔 융단이다.')]),
  object(6105, '작가들의 풍자화', 208, 64, [...imageProps('../assets/v47/nekrasov-panaev-caricature.jpg', 42, 52, -13, -42),
    prop('storyTextKo', '두 편집자를 그린 1848년 풍자화다. 연감의 본문이나 파나예바의 삽화로 오인하지 않도록 따로 보관했다.')]),
  object(6107, '응접실의 낮은 탁자와 의자', 64, 144, [...imageProps('../assets/v47/sofiya-parlor-furniture.svg', 160, 88, -16, -64),
    prop('storyTextKo', '낮은 탁자 둘레에 의자를 놓았다. 책을 읽는 자리와 차를 나누는 자리를 함께 마련했다.')]),
];
layer('NPCs').objects = [];
await write('rpg/maps/sofiya-salon.json', map);

const lane = await read('rpg/maps/bookshop-lane.json');
const exits = lane.layers.find(item => item.name === 'Interactions').objects;
if (!exits.some(item => item.name === '소피야의 응접실 문')) exits.push(object(6106, '소피야의 응접실 문', 96, 144, [
  prop('exitId', 'bookshop-lane-sofiya-salon'), prop('targetMapId', 'sofiya-salon'),
  prop('arrivalX', 11, 'int'), prop('arrivalY', 14, 'int'), prop('returnExitId', 'sofiya-salon-lane'),
  prop('publicAccess', false, 'bool'), prop('doorId', 'door-sofiya-salon'), prop('districtId', 'BOOKS_AND_READING'),
], 'map-exit'));
await write('rpg/maps/bookshop-lane.json', lane);
