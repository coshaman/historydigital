import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const [registry, maps] = await Promise.all([
  readJson('rpg/data/city-districts-v36.json'),
  Promise.all(['nevsky','printshop','chancery','police-station','courtyard','dead-souls','overcoat'].map(async id => [id, await readJson(`rpg/maps/${id}.json`)])),
]);
const mapById = new Map(maps);
const residentIds = new Set(['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','senior_clerk_konstantin','reader_darya','editor_sofia','police_sergeant_ivan']);

test('the first two city-life prototypes are connected and clearly distinct from literary maps', () => {
  assert.equal(registry.districts.length, 2);
  const districtIds = new Set(registry.districts.map(district => district.id));
  assert.deepEqual([...districtIds], ['NEVSKY_COMMERCIAL','COURTYARD_HOUSEHOLD']);
  for (const district of registry.districts) {
    assert.ok(district.mapIds.length > 0);
    assert.ok(district.residentIds.length > 0);
    assert.equal(district.mapIds.every(mapId => mapById.has(mapId)), true);
    for (const mapId of district.mapIds) assert.equal(mapById.get(mapId).metadata.districtId, district.id, `${mapId} district metadata mismatch`);
    for (const id of district.residentIds) assert.ok(residentIds.has(id), `${id} is not a city resident in this slice`);
  }
  const links = registry.districts.flatMap(district => district.connections.filter(link => link.districtTransition));
  assert.deepEqual(links.map(link => `${link.fromMapId}:${link.exitId}->${link.toMapId}`).sort(), [
    'courtyard:courtyard-nevsky-gate->nevsky', 'nevsky:nevsky-courtyard-gate->courtyard',
  ]);
  for (const link of links) {
    const exit = mapById.get(link.fromMapId).layers.find(layer => layer.name === 'Interactions').objects
      .find(object => object.type === 'map-exit' && object.properties?.some(property => property.name === 'exitId' && String(property.value).replaceAll('"','') === link.exitId));
    assert.ok(exit, `missing route exit ${link.exitId}`);
    const target = exit.properties.find(property => property.name === 'targetMapId');
    assert.equal(String(target.value).replaceAll('"',''), link.toMapId);
  }
  const residentsAcrossSlice = new Set(registry.districts.flatMap(district => district.residentIds));
  assert.deepEqual([...residentsAcrossSlice].sort(), [...residentIds].sort());
  assert.equal(registry.districts.some(district => district.mapIds.includes('dead-souls') || district.mapIds.includes('overcoat')), false);
});

test('every prototype source label names its evidence class and reconstruction limits', () => {
  for (const district of registry.districts) {
    assert.match(district.gameTransformation, /fictional|stylized|reconstruct/i);
    assert.ok(district.sourceEvidence.length >= 2);
    for (const source of district.sourceEvidence) assert.ok(['PERIOD_MAP','PERIOD_PAINTING','PERIOD_TEXT','LATER_REFERENCE','MODERN_SCHOLARSHIP','CREATIVE_RECONSTRUCTION'].includes(source.sourceType));
  }
  assert.match(registry.reconstructionPolicy, /not claims|not georeferenced/i);
});
