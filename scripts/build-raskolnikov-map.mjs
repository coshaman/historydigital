import { readFile, writeFile } from 'node:fs/promises';

const basePath = new URL('../rpg/maps/inn-interior.json', import.meta.url);
const outputPath = new URL('../rpg/maps/raskolnikov-tavern.json', import.meta.url);
const map = JSON.parse(await readFile(basePath, 'utf8'));
const realmId = 'LITERARY_RASKOLNIKOV_1866';
const sourceId = 'LIT-DOSTOEVSKY-CRIME-PUNISHMENT-1866-CH2';
map.name = 'raskolnikov-tavern';
map.mapId = 'raskolnikov-tavern';
map.metadata.mapId = 'raskolnikov-tavern';
map.metadata.displayNameKo = '술집 안쪽 자리';
map.metadata.observerStart = { x: 10, y: 10 };
map.metadata.date = '1866-01-01';
map.metadata.datePrecision = 'YEAR';
map.metadata.dateDisplayKo = '1866년';
map.metadata.mapClass = 'LITERARY_REALM';
map.metadata.realmId = realmId;
delete map.metadata.districtId;
delete map.metadata.access;
delete map.metadata.basisKo;
map.metadata.geography = 'A literary tavern scene in Dostoevsky’s Crime and Punishment.';
map.metadata.sourceIds = [sourceId];
map.metadata.note = 'Standalone 1860s literary instance.';
map.tilesets[0].name = 'petersburg-literary-tiles';
for (const property of map.properties ?? []) {
  if (property.name === 'mapId') property.value = '"raskolnikov-tavern"';
  if (property.name === 'displayNameKo') property.value = '"술집 안쪽 자리"';
  if (property.name === 'observerStart') property.value = '{"x":10,"y":10}';
  if (property.name === 'date') property.value = '"1866-01-01"';
  if (property.name === 'mapClass') property.value = '"LITERARY_REALM"';
  if (property.name === 'geography') property.value = '"A literary tavern scene in Dostoevsky’s Crime and Punishment."';
  if (property.name === 'sourceIds') property.value = JSON.stringify([sourceId]);
  if (property.name === 'note') property.value = '"Standalone 1860s literary instance."';
}
map.properties.push(
  { name: 'datePrecision', type: 'string', value: '"YEAR"' },
  { name: 'dateDisplayKo', type: 'string', value: '"1866년"' },
  { name: 'realmId', type: 'string', value: JSON.stringify(realmId) }
);
const interactions = map.layers.find(layer => layer.name === 'Interactions').objects;
interactions.splice(0, interactions.length,
  { id: 80, name: '제1부 제2장의 술집 대화', type: 'source', x: 112, y: 160, width: 16, height: 16, rotation: 0, visible: true, properties: [{ name: 'sourceId', type: 'string', value: sourceId }] },
  { id: 81, name: '마르멜라도프의 이야기', type: 'quest-object', x: 176, y: 160, width: 16, height: 16, rotation: 0, visible: true, properties: [{ name: 'questId', type: 'string', value: 'LITERARY_RASKOLNIKOV_TAVERN_1866' }] }
);
const npcs = map.layers.find(layer => layer.name === 'NPCs').objects;
npcs.splice(0, npcs.length,
  { id: 83, name: '로지온 라스콜리니코프', type: 'npc', x: 160, y: 160, width: 16, height: 16, rotation: 0, visible: true, properties: [{ name: 'hostId', type: 'string', value: 'literary_raskolnikov' }] },
  { id: 84, name: '세묜 마르멜라도프', type: 'npc', x: 208, y: 144, width: 16, height: 16, rotation: 0, visible: true, properties: [{ name: 'hostId', type: 'string', value: 'literary_marmeladov' }] }
);
map.nextobjectid = 85;
await writeFile(outputPath, `${JSON.stringify(map, null, 2)}\n`);
