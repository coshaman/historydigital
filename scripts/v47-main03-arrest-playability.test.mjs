import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { attachV47StoryObjects, v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { atmosphereForMap, mapHasAtmosphere } from '../rpg/engine/atmosphere.mjs';
import { streetLifeFrame } from '../rpg/engine/petersburg-street-life.mjs';
import { walkableTilesReachableFromArrivals } from '../rpg/data/walkable-placement.mjs';

const arrest = [...v47StoryQuests, ...toV47StoryQuests()].find(quest => quest.id === 'V47_MAIN03_ARRESTS');
assert.ok(arrest, 'MAIN03 includes its fixed historical arrest event');
assert.equal(arrest.date, '1849-05-05', 'the April 23 Julian arrest is represented on its Gregorian date');
assert.equal(arrest.sourceIds?.includes('OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'), true,
  'the player can consult the contemporary arrest order');
assert.ok(arrest.actions.length >= 4, 'the arrest scene offers multiple consequential ways to take part');
assert.ok(new Set(arrest.actions.flatMap(action => action.hostIds)).size >= 8,
  'the arrest event draws on at least eight characters with different stakes');
assert.ok(arrest.actions.some(action => action.effects?.v47WorldChange?.moves?.length >= 2),
  'arrest choices move NPCs through the live city map');
assert.ok(arrest.actions.some(action => action.effects?.v47WorldChange?.inventory?.length),
  'documents or belongings change hands in the arrest scene');
assert.ok(arrest.actions.some(action => action.effects?.v47WorldChange?.relationships?.length),
  'the event changes relationships as well as quest flags');
assert.ok(arrest.actions.some(action => action.effects?.v47WorldChange?.flags?.V47_HISTORICAL_ARRESTS_REMAIN_FIXED),
  'fictional interventions preserve the documented arrests of historical participants');
assert.ok(arrest.actions.some(action => action.effects?.v47WorldChange?.moves?.some(move => move.mapId === 'nevsky')),
  'the arrest choices send fictional characters into the outdoor Petersburg street scene');
assert.equal(mapHasAtmosphere('nevsky'), true, 'the street route has seasonal weather effects');
assert.equal(atmosphereForMap('nevsky', 320, 240, 900, false, 'drizzle')?.kind, 'drizzle',
  'rain particles can render on the MAIN03 outdoor route');
assert.ok(streetLifeFrame('nevsky', 900, false).cartX !== streetLifeFrame('nevsky', 0, false).cartX,
  'the outdoor route has moving Petersburg street traffic');

const arrestStreet = JSON.parse(await readFile(new URL('../rpg/maps/morskaya-intersection.json', import.meta.url), 'utf8'));
const nevsky = JSON.parse(await readFile(new URL('../rpg/maps/nevsky.json', import.meta.url), 'utf8'));
const policeStation = JSON.parse(await readFile(new URL('../rpg/maps/police-station.json', import.meta.url), 'utf8'));
const provenance = JSON.parse(await readFile(new URL('../rpg/assets/ASSET_PROVENANCE.json', import.meta.url), 'utf8'));
assert.equal(arrest.entry.mapId, 'morskaya-intersection', 'the main operation takes place at the address in the arrest order');
assert.equal(arrestStreet.metadata.displayNameKo, '말라야 모르스카야 교차로');
assert.equal(arrestStreet.metadata.date, '1849-05-05');
assert.match(arrestStreet.metadata.geography, /stylized|stylised|양식화|간략화/i,
  'the street depicts the documented junction without claiming exact building reconstruction');
const lanternExit = arrestStreet.layers.flatMap(layer => layer.objects ?? []).find(object => object.properties
  ?.some(property => property.name === 'displayAsset' && property.value === '../assets/v47/street-oil-lantern.svg'));
assert.ok(lanternExit, 'the arrest street includes a period-inspired lantern as visible scene dressing');
const lanternAsset = provenance.assets.find(asset => asset.path === 'rpg/assets/v47/street-oil-lantern.svg');
assert.ok(lanternAsset?.sourceIds.includes('V36-ART-SADOVNIKOV-NEVSKY-PANORAMA'),
  'the authored street prop records its verified period visual reference');
assert.equal(createHash('sha256').update(await readFile(new URL('../rpg/assets/v47/street-oil-lantern.svg', import.meta.url))).digest('hex').toUpperCase(),
  lanternAsset.sha256, 'the authored street prop matches its source-controlled checksum');
const warningBeat = v47StoryQuests.find(quest => quest.id === 'V47_MAIN03_ARRESTS');
const hideChoice = warningBeat?.actions.find(action => action.id === 'V47_P07_WARN_FICTIONAL');
assert.match(hideChoice?.labelKo ?? '', /몸을 피하/);
assert.ok(hideChoice?.effects?.v47WorldChange?.moves?.some(move => move.hostId === 'student_vasily'
  && move.mapId === 'communal-room'), 'the warning choice sends the fictional student toward an actual shelter by route');
const exits = map => map.layers.flatMap(layer => layer.objects ?? []).filter(object => object.type === 'map-exit');
assert.ok(exits(nevsky).some(object => object.properties.some(property => property.name === 'targetMapId' && property.value === arrestStreet.mapId)),
  'the new operation map is physically reachable from the city street');
assert.ok(exits(policeStation).some(object => object.properties.some(property => property.name === 'targetMapId' && property.value === arrestStreet.mapId)),
  'the player can travel from the dispatch room to the operation address');
assert.ok(exits(arrestStreet).some(object => object.properties.some(property => property.name === 'targetMapId' && property.value === 'police-station')),
  'the operation street returns to the dispatch room');
const isWalkable = (map, x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height
  && map.layers.find(layer => layer.name === 'Collision')?.data?.[y * map.width + x] === 0;
for (const sourceMap of [nevsky, policeStation]) {
  const exit = exits(sourceMap).find(object => object.properties.some(property => property.name === 'targetMapId'
    && property.value === arrestStreet.mapId));
  const properties = Object.fromEntries(exit.properties.map(property => [property.name, property.value]));
  assert.ok(isWalkable(arrestStreet, properties.arrivalX, properties.arrivalY),
    `${sourceMap.mapId} exit leads to walkable ground on the arrest street`);
}
const mapFiles = await readdir(new URL('../rpg/maps/', import.meta.url));
const maps = Object.fromEntries(await Promise.all(mapFiles.filter(name => name.endsWith('.json')).map(async name => {
  const map = JSON.parse(await readFile(new URL(`../rpg/maps/${name}`, import.meta.url), 'utf8'));
  return [map.mapId, map];
})));
attachV47StoryObjects(maps);
const arrestObject = maps[arrest.entry.mapId].layers.find(layer => layer.name === 'Interactions').objects
  .find(object => object.id === arrest.entry.objectId);
assert.ok(arrestObject,
  'the arrest order and choice object appears on the operation street itself');
const eventReachable = walkableTilesReachableFromArrivals(arrest.entry.mapId, maps);
const objectTile = { x: Math.floor(arrestObject.x / maps[arrest.entry.mapId].tilewidth), y: Math.floor(arrestObject.y / maps[arrest.entry.mapId].tileheight) };
assert.ok([[objectTile.x - 1, objectTile.y], [objectTile.x + 1, objectTile.y], [objectTile.x, objectTile.y - 1], [objectTile.x, objectTile.y + 1]]
  .some(([x, y]) => eventReachable.has(`${x},${y}`)), 'the choice can be reached from an open world door');

const index = JSON.parse(await readFile(new URL('../rpg/data/source-reader-index.json', import.meta.url), 'utf8'));
const order = index.records.find(record => record.sourceId === 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849');
assert.equal(order?.accessibleToPlayerAt, '1849-05-04', 'the arrest order is available the day before the operation');

console.log('MAIN03 arrest scene: historical anchor, cast size, physical movement, material consequences and source date passed.');
