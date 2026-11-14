import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atmosphereForMap } from '../rpg/engine/atmosphere.mjs';

test('Petersburg outdoor weather changes street surfaces without changing indoor workshop atmosphere', () => {
  const rain = atmosphereForMap('market-quay', 640, 360, 1200, false, 'drizzle');
  const snow = atmosphereForMap('bookshop-lane', 640, 360, 1200, false, 'snow');
  const fog = atmosphereForMap('nevsky', 640, 360, 1200, false, 'fog');
  const laterFog = atmosphereForMap('nevsky', 640, 360, 9000, false, 'fog');
  const workshop = atmosphereForMap('printshop', 640, 360, 1200, false, 'snow');

  assert.equal(rain.surfaceEffect, 'wet-paving', 'drizzle catches light on exposed Petersburg paving');
  assert.ok(rain.pavingGlints.length >= 10, 'wet pavement receives scattered, restrained highlights');
  assert.ok(rain.pavingGlints.every(glint => glint.alpha >= 0.2), 'wet highlights remain visible against dark stone');
  assert.equal(snow.surfaceEffect, 'snow-edge', 'winter snow settles along outdoor street edges');
  assert.ok(snow.snowBands.length >= 10, 'snow appears across the street map, not only on Nevsky');
  assert.ok(snow.snowBands.every(band => band.height >= 4 && band.alpha >= 0.4), 'curb snow reaches visible pixel size and contrast');
  assert.equal(fog.fogBanks.length, 4, 'winter fog has layered banks across the Petersburg street');
  assert.ok(fog.fogBanks.every(bank => bank.alpha >= 0.38), 'fog banks are visible against the dark city map');
  assert.notEqual(fog.fogBanks[0].x, laterFog.fogBanks[0].x, 'fog drifts across the street over time');
  assert.deepEqual(atmosphereForMap('nevsky', 640, 360, 0, true, 'fog').fogBanks,
    atmosphereForMap('nevsky', 640, 360, 9999, true, 'fog').fogBanks,
    'reduced motion fixes fog in place without removing the weather cue');
  assert.equal(workshop.kind, 'dust', 'indoor print work remains separate from outside weather');
  assert.equal(workshop.surfaceEffect, undefined, 'outside weather never paints the printshop floor');

  const stillSnow = atmosphereForMap('bookshop-lane', 640, 360, 9999, true, 'snow');
  assert.deepEqual(stillSnow.snowBands, snow.snowBands, 'reduced motion preserves static snow placement');
}
);
