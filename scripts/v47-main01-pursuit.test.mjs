import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { walkableTilesReachableFromArrivals } from '../rpg/data/walkable-placement.mjs';
import { attachMain01PursuitObjects, createMain01PursuitState, MAIN01_PURSUIT_CHECKPOINTS, MAIN01_PURSUIT_LIMIT, reachMain01PursuitCheckpoint, startMain01Pursuit } from '../rpg/engine/v47-main01-pursuit.mjs';

test('MAIN01 pursuit requires following the trail and escaping through the side gate', () => {
  let state = createMain01PursuitState();
  const started = startMain01Pursuit(state, 540);
  assert.equal(started.accepted, true); state = started.state;
  assert.equal(reachMain01PursuitCheckpoint(state, 'PRINTSHOP_CORNER', 545).reason, 'wrong_checkpoint');
  for (const id of ['CANAL_END', 'PRINTSHOP_CORNER', 'BOOKSHOP_GATE', 'SIDE_GATE']) {
    const result = reachMain01PursuitCheckpoint(state, id, 550);
    assert.equal(result.accepted, true); state = result.state;
  }
  assert.equal(state.status, 'COMPLETE');
});

test('MAIN01 pursuit route attaches to walkable locations in the shipped bookshop map', async () => {
  const map = JSON.parse(await readFile(new URL('../rpg/maps/bookshop-lane.json', import.meta.url), 'utf8'));
  attachMain01PursuitObjects({ 'bookshop-lane': map });
  const reachable = walkableTilesReachableFromArrivals('bookshop-lane', { 'bookshop-lane': map });
  const checkpoints = map.layers.find(layer => layer.name === 'Interactions').objects
    .filter(object => object.properties.some(property => property.name === 'v47PursuitCheckpoint'));
  assert.equal(checkpoints.length, 4);
  assert.ok(checkpoints.every(object => reachable.has(`${Math.floor(object.x / 16)},${Math.floor(object.y / 16)}`)));
});

test('MAIN01 pursuit loses the trail after the deadline and can be restarted', () => {
  const started = startMain01Pursuit(createMain01PursuitState(), 100);
  const missed = reachMain01PursuitCheckpoint(started.state, 'CANAL_END', 101 + MAIN01_PURSUIT_LIMIT);
  assert.equal(missed.accepted, false); assert.equal(missed.state.status, 'MISSED');
  assert.equal(startMain01Pursuit(missed.state, 102 + MAIN01_PURSUIT_LIMIT).accepted, true);
});

test('MAIN01 pursuit checkpoints are real, reachable map interactions', () => {
  const map = { mapId: 'bookshop-lane', width: 30, height: 20, tilewidth: 16, tileheight: 16, nextobjectid: 1,
    metadata: { observerStart: { x: 1, y: 1 } },
    layers: [{ name: 'Collision', data: Array(600).fill(0) }, { name: 'Interactions', objects: [] }] };
  attachMain01PursuitObjects({ 'bookshop-lane': map });
  const objects = map.layers[1].objects;
  assert.deepEqual(objects.map(object => object.properties.find(property => property.name === 'v47PursuitCheckpoint').value),
    MAIN01_PURSUIT_CHECKPOINTS.map(checkpoint => checkpoint.id));
  assert.equal(new Set(objects.map(object => `${object.x},${object.y}`)).size, 4);
  assert.ok(objects.every(object => object.type === 'inspectable'));
});
