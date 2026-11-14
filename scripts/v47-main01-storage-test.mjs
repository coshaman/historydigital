import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MAIN01_STORAGE_PACKETS, MAIN01_STORAGE_SHELVES, attachMain01StorageShelves,
  createMain01StorageState, placeMain01StoragePacket,
} from '../rpg/engine/v47-main01-storage.mjs';

test('MAIN01 four physical printshop shelves attach to reachable map tiles', async () => {
  const map = JSON.parse(await readFile(new URL('../rpg/maps/printshop.json', import.meta.url), 'utf8'));
  attachMain01StorageShelves({ printshop: map });
  const objects = map.layers.find(layer => layer.name === 'Interactions').objects
    .filter(object => object.properties?.some(property => property.name === 'v47StorageShelf'));
  assert.equal(objects.length, 4);
  assert.deepEqual(objects.map(object => object.properties.find(property => property.name === 'v47StorageShelf').value),
    MAIN01_STORAGE_SHELVES.map(shelf => shelf.id));
  for (const object of objects) {
    assert.equal(object.mapId ?? 'printshop', 'printshop');
    assert.ok(object.width > 0 && object.height > 0);
  }
});

test('MAIN01 sorting accepts parcels in any order and completes only when each reaches its proper shelf', () => {
  let state = createMain01StorageState();
  for (const packet of [...MAIN01_STORAGE_PACKETS].slice(1).reverse()) {
    const result = placeMain01StoragePacket(state, packet.shelfId, packet.id, 'printer_ekaterina', '1848-11-02');
    assert.equal(result.accepted, true);
    assert.equal(result.state.status, 'IN_PROGRESS');
    state = result.state;
  }
  const finalPacket = MAIN01_STORAGE_PACKETS[0];
  const complete = placeMain01StoragePacket(state, finalPacket.shelfId, finalPacket.id, 'printer_ekaterina', '1848-11-02');
  assert.equal(complete.accepted, true);
  assert.equal(complete.state.status, 'COMPLETE');
  assert.equal(complete.effects.item.itemKo, '연감 창고 분류표');
  assert.equal(Object.keys(complete.state.placements).length, 4);
});

test('wrong placement leaves a physical misfile, raises risk, and can be corrected', () => {
  const state = createMain01StorageState();
  const packet = MAIN01_STORAGE_PACKETS[0];
  const wrongShelf = MAIN01_STORAGE_SHELVES.find(shelf => shelf.id !== packet.shelfId);
  const wrong = placeMain01StoragePacket(state, wrongShelf.id, packet.id, 'bookseller_lev', '1848-11-02');
  assert.equal(wrong.accepted, true);
  assert.equal(wrong.state.placements[packet.id].correct, false);
  assert.equal(wrong.effects.riskDelta, 1);
  const corrected = placeMain01StoragePacket(wrong.state, packet.shelfId, packet.id, 'bookseller_lev', '1848-11-02');
  assert.equal(corrected.accepted, true);
  assert.equal(corrected.state.placements[packet.id].correct, true);
  assert.equal(corrected.effects.riskDelta, 0);
});

test('MAIN01 shelf entries and packet labels describe distinct physical destinations', () => {
  assert.equal(MAIN01_STORAGE_SHELVES.length, 4);
  assert.equal(MAIN01_STORAGE_PACKETS.length, 4);
  assert.equal(new Set(MAIN01_STORAGE_PACKETS.map(packet => packet.shelfId)).size, 4);
  assert.ok(MAIN01_STORAGE_PACKETS.every(packet => packet.labelKo && packet.shelfId));
});
