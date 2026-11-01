import assert from 'node:assert/strict';
import test from 'node:test';
import { atmosphereForMap, mapHasAtmosphere } from '../rpg/engine/atmosphere.mjs';

test('street drizzle and indoor dust are confined to the intended Petersburg maps', () => {
  assert.equal(atmosphereForMap('nevsky', 600, 300, 1000).kind, 'drizzle');
  assert.equal(atmosphereForMap('courtyard', 600, 300, 1000).kind, 'drizzle');
  assert.equal(atmosphereForMap('printshop', 600, 300, 1000).kind, 'dust');
  assert.equal(atmosphereForMap('chancery', 600, 300, 1000).kind, 'dust');
  assert.equal(atmosphereForMap('overcoat', 600, 300, 1000), null);
  assert.equal(mapHasAtmosphere('overcoat'), false);
});

test('ambient particles stay inside map bounds and movement stops under reduced motion', () => {
  for (const mapId of ['nevsky', 'printshop']) {
    const frame = atmosphereForMap(mapId, 600, 300, 1000);
    assert.ok(frame.particles.length <= 48);
    for (const particle of frame.particles) {
      assert.ok(particle.x >= 0 && particle.x < 600);
      assert.ok(particle.y >= 0 && particle.y < 300);
    }
    assert.deepEqual(atmosphereForMap(mapId, 600, 300, 1000, true), atmosphereForMap(mapId, 600, 300, 9000, true));
    assert.notDeepEqual(atmosphereForMap(mapId, 600, 300, 1000), atmosphereForMap(mapId, 600, 300, 9000));
  }
});
