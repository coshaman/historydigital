import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { objectIsPresent, interactionTile, isActionableInteraction, ambientBubbleFor } from '../rpg/engine/world-presentation.mjs';
import { addVisibleBoundaries } from './v33-map-boundaries.mjs';
import { ambientConversations } from '../rpg/data/ambient-conversations.mjs';

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

test('interaction emphasis excludes unavailable quest props, self, and exits the current body cannot use', () => {
  const active = state('V33_1847_PRINT', '1847-06-01');
  active.world.currentMapId = 'printshop';
  active.player = { embodiment: 'printer_ekaterina', position: { x: 1, y: 1 } };
  active.hosts = { printer_ekaterina: { id: 'printer_ekaterina', mapId: 'printshop', historicalAliveAndPresent: true, allowedMaps: ['printshop'] },
    street_vendor_matryona: { id: 'street_vendor_matryona', mapId: 'printshop', historicalAliveAndPresent: true, allowedMaps: ['printshop'] } };
  active.quests = { 'PRINTSHOP_PROOF_1847': { status: 'open' } };
  const map = maps.find(item => item.mapId === 'printshop');
  const proof = map.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.type === 'quest-object');
  assert.equal(isActionableInteraction(proof, active, map, quests), true);
  active.player.embodiment = 'street_vendor_matryona';
  assert.equal(isActionableInteraction(proof, active, map, quests), false, 'a different body cannot perform the action');
  const npc = { type: 'npc', properties: [{ name: 'hostId', value: 'street_vendor_matryona' }] };
  assert.equal(isActionableInteraction(npc, active, map, quests), false, 'the embodied character is not an interaction target');
  const exit = { type: 'map-exit', properties: [{ name: 'targetMapId', value: 'chancery' }, { name: 'publicAccess', value: false }] };
  assert.equal(isActionableInteraction(exit, active, map, quests), false, 'the current body has no access to that map');
});

test('ambient speech is infrequent, local to present residents, and pauses during player dialogue', () => {
  const world = state('V33_1847_PRINT', '1847-06-01');
  world.world.currentMapId = 'printshop';
  world.player = { embodiment: 'clerk_alexei' };
  world.hosts = { clerk_alexei: { mapId: 'printshop' }, printer_ekaterina: { mapId: 'printshop', historicalAliveAndPresent: true } };
  const roster = [{ id: 'clerk_alexei', ambientLines: ['I am the player'] }, { id: 'printer_ekaterina', ambientLines: ['잉크가 묻었어.'] }];
  const map = { mapId: 'printshop' };
  assert.deepEqual(ambientBubbleFor(world, roster, map, 1000), { hostId: 'printer_ekaterina', line: '잉크가 묻었어.' });
  assert.equal(ambientBubbleFor(world, roster, map, 4000), null, 'bubble stays absent for most of the interval');
  assert.equal(ambientBubbleFor(world, roster, map, 1000, true), null, 'never overlaps player conversation');
  world.hosts.printer_ekaterina.mapId = 'chancery';
  assert.equal(ambientBubbleFor(world, roster, map, 1000), null, 'off-screen residents cannot speak here');
});

test('ambient exchanges show two nearby residents responding to each other with authored mood', () => {
  const world = state('V33_1847_PRINT', '1847-06-01');
  world.world.currentMapId = 'market-quay';
  world.player = { embodiment: 'clerk_alexei', position: { x: 2, y: 2 } };
  world.hosts = {
    market_nadezhda: { mapId: 'market-quay', position: { x: 2, y: 2 }, historicalAliveAndPresent: true },
    porter_gavrila: { mapId: 'market-quay', position: { x: 7, y: 2 }, historicalAliveAndPresent: true },
    fishseller_klavdiya: { mapId: 'market-quay', position: { x: 21, y: 13 }, historicalAliveAndPresent: true },
  };
  const roster = [{ id: 'market_nadezhda' }, { id: 'porter_gavrila' }, { id: 'fishseller_klavdiya' }];
  const exchange = { mapIds: ['market-quay'], speakers: [
    { hostId: 'market_nadezhda', lineKo: '로만이 수레를 빼면 다시 물건을 펴겠어요.', mood: 'focused' },
    { hostId: 'porter_gavrila', lineKo: '그럼 자루부터 이쪽으로 옮깁시다.', mood: 'helpful' },
  ] };
  assert.deepEqual(ambientBubbleFor(world, roster, { mapId: 'market-quay' }, 1000, false, [exchange]), {
    exchange: exchange.speakers,
  });
  world.hosts.porter_gavrila.mapId = 'nevsky';
  assert.equal(ambientBubbleFor(world, roster, { mapId: 'market-quay' }, 1000, false, [exchange]), null,
    'both speakers must be present together');
  world.hosts.porter_gavrila.mapId = 'market-quay';
  world.hosts.porter_gavrila.position = { x: 18, y: 13 };
  assert.equal(ambientBubbleFor(world, roster, { mapId: 'market-quay' }, 1000, false, [exchange]), null,
    'distant residents do not exchange a visible line');
  const authored = ambientConversations.find(item => item.mapIds.includes('market-quay')
    && item.speakers.every(speaker => ['market_nadezhda', 'porter_gavrila'].includes(speaker.hostId)));
  assert.ok(authored, 'the shipped city includes at least one authored market exchange');
  world.hosts.porter_gavrila.position = { x: 3, y: 2 };
  assert.deepEqual(ambientBubbleFor(world, roster, { mapId: 'market-quay' }, 1000, false, [authored]), { exchange: authored.speakers });
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
