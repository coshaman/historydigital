import { readFile, writeFile } from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const source = await read('../rpg/maps/inn-interior.json');
const mapId = 'alyosha-snegiryov-room';
const realmId = 'LITERARY_KARAMAZOV_1879';
const sourceId = 'LIT-DOSTOEVSKY-BROTHERS-KARAMAZOV-1879-ILYUSHA';
const questId = 'LITERARY_ALYOSHA_ILYUSHA_1879';
source.name = mapId;
source.mapId = mapId;
source.metadata = {
  displayNameKo: '이유샤 스네기료프의 방',
  observerStart: { x: 6, y: 5 },
  date: '1879-01-01',
  datePrecision: 'YEAR',
  dateDisplayKo: '1879년',
  mapClass: 'LITERARY_REALM',
  geography: 'A literary room in The Brothers Karamazov; not a historical address.',
  sourceIds: [sourceId],
  mapId,
  realmId,
};
source.properties = source.properties.filter(property => !['access', 'districtId', 'basisKo', 'reconstructionBasis'].includes(property.name));
const valueByName = {
  mapId,
  displayNameKo: source.metadata.displayNameKo,
  observerStart: source.metadata.observerStart,
  date: source.metadata.date,
  datePrecision: source.metadata.datePrecision,
  dateDisplayKo: source.metadata.dateDisplayKo,
  mapClass: source.metadata.mapClass,
  geography: source.metadata.geography,
  sourceIds: source.metadata.sourceIds,
  realmId,
};
for (const [name, value] of Object.entries(valueByName)) {
  const existing = source.properties.find(property => property.name === name);
  const property = { name, type: 'string', value: JSON.stringify(value) };
  if (existing) Object.assign(existing, property); else source.properties.push(property);
}
const interactions = source.layers.find(layer => layer.name === 'Interactions');
const bed = interactions.objects.find(object => object.id === 4000);
bed.name = '이유샤의 침상 곁';
bed.properties = [
  { name: 'assetTileId', type: 'int', value: 18 },
  { name: 'scope', type: 'string', value: 'literary_scene_prop' },
  { name: 'questId', type: 'string', value: questId },
  { name: 'realmId', type: 'string', value: realmId },
  { name: 'storyTextKo', type: 'string', value: '콜랴가 이유샤의 침상 곁에 앉았다.' },
];
interactions.objects = [bed];
interactions.objects.push({
  id: 4001,
  name: '콜랴가 읽던 책',
  type: 'source',
  x: 96,
  y: 96,
  width: 16,
  height: 16,
  visible: true,
  properties: [
    { name: 'sourceId', type: 'string', value: sourceId },
    { name: 'actionId', type: 'string', value: 'READ_KARAMAZOV_PASSAGE' },
    { name: 'scope', type: 'string', value: 'literary' },
  ],
});
await writeFile(new URL('../rpg/maps/alyosha-snegiryov-room.json', import.meta.url), `${JSON.stringify(source, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', mapId, realmId, questId, focalObject: bed.name }));
