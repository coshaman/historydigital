import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { objectIsPresent, interactionTile } from '../rpg/engine/world-presentation.mjs';
import { addVisibleBoundaries } from './v33-map-boundaries.mjs';

const read = async file => JSON.parse(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
const maps = await Promise.all(['nevsky', 'printshop', 'chancery', 'courtyard', 'dead-souls', 'overcoat'].map(id => read(`rpg/maps/${id}.json`)));
const quests = await Promise.all(['printshop-article', 'public-discourse-1848', 'circle-investigation-1849', 'circle-letter-1849-may', 'literary-dead-souls', 'literary-overcoat'].map(id => read(`rpg/quests/${id}.json`)));
const objects = maps.flatMap(map => map.layers.find(l => l.name === 'Interactions').objects);
const byName = name => objects.find(o => o.name === name);
const state = (chapterId, date, realmId) => ({ world: { chapterId, date, activeRealm: realmId ? { id: realmId } : null } });

test('map cues follow chapter/date gates, including May letter and literary scope', () => {
  const first = state('V33_1847_PRINT', '1847-06-01');
  assert.equal(objectIsPresent(byName('교정쇄가 놓인 작업대'), first, quests), true);
  assert.equal(objectIsPresent(byName('1848년 편집부 공고'), first, quests), false);
  assert.equal(objectIsPresent(byName('지방행 우편 묶음'), first, quests), false);
  const second = state('V33_1848_PUBLIC', '1848-01-01');
  assert.equal(objectIsPresent(byName('1848년 편집부 공고'), second, quests), true);
  assert.equal(objectIsPresent(byName('지방행 우편 묶음'), second, quests), true);
  const april = state('V33_1849_CIRCLE', '1849-04-23');
  const may = state('V33_1849_CIRCLE', '1849-05-05');
  for (const name of ['두벨트의 비밀 편지', '편지 전달 경로를 적는 사본 대장']) {
    assert.equal(objectIsPresent(byName(name), april, quests), false, name);
    assert.equal(objectIsPresent(byName(name), may, quests), true, name);
  }
  assert.equal(objectIsPresent(byName('닳아 해진 외투'), first, quests), false);
  assert.equal(objectIsPresent(byName('닳아 해진 외투'), state('V33_1847_PRINT', '1847-06-01', 'LITERARY_OVERCOAT'), quests), true);
  assert.equal(objectIsPresent({ ...byName('신문 가판대'), visible: false }, first, quests), false);
});

test('paper, drawer and door cues use distinct authored tile silhouettes', () => {
  assert.notEqual(interactionTile(byName('신문 가판대')), interactionTile(byName('인쇄소 문')));
  assert.notEqual(interactionTile(byName('활자 서랍')), interactionTile(byName('작업 장부')));
});

test('all blocked tiles have visible architecture or set dressing in the shipped maps', () => {
  for (const map of maps) {
    const layer = name => map.layers.find(l => l.name === name).data;
    layer('Collision').forEach((blocked, i) => {
      if (blocked) assert.ok(layer('Architecture')[i] || layer('StreetDetail')[i], `${map.mapId}: invisible obstacle ${i % map.width},${Math.floor(i / map.width)}`);
    });
    assert.deepEqual(addVisibleBoundaries(structuredClone(map)), map, 'repair is idempotent');
  }
});

test('visual repair preserves movement, existing artwork and interactions', () => {
  const map = { mapId: 'printshop', width: 3, height: 3, layers: [
    { name: 'Collision', data: [1,1,1,1,1,1,1,1,1] },
    { name: 'Architecture', data: [10,0,0,0,0,0,0,0,0] },
    { name: 'StreetDetail', data: [0,11,0,0,0,0,0,0,0] },
    { name: 'Interactions', objects: [{ id: 1, x: 16, y: 16 }] },
  ] };
  const original = structuredClone(map);
  addVisibleBoundaries(map);
  assert.deepEqual(map.layers[0], original.layers[0]);
  assert.deepEqual(map.layers[2], original.layers[2]);
  assert.deepEqual(map.layers[3], original.layers[3]);
  assert.equal(map.layers[1].data[0], 10);
  assert.equal(map.layers[1].data[1], 0, 'preserve tile already covered by decoration');
  assert.equal(map.layers[1].data[4], 25, 'table marks interior obstacle');
});
