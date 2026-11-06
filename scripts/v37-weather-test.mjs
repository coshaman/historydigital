import assert from 'node:assert/strict';
import { atmosphereForMap, mapHasAtmosphere, weatherForDate } from '../rpg/engine/atmosphere.mjs';

for (const [date, allowed] of [
  ['1848-01-01', ['snow', 'fog', 'wind', 'overcast']],
  ['1847-04-20', ['drizzle', 'fog', 'overcast', 'clear']],
  ['1847-07-01', ['drizzle', 'overcast', 'clear', 'fog']],
  ['1847-10-01', ['drizzle', 'fog', 'overcast', 'wind']],
]) {
  const week = Array.from({ length: 14 }, (_, day) => weatherForDate(date, day));
  assert.ok(week.every(weather => allowed.includes(weather)), `${date}: weather must fit the season profile`);
  assert.deepEqual(week, Array.from({ length: 14 }, (_, day) => weatherForDate(date, day)), `${date}: weather replay is deterministic`);
  assert.ok(new Set(week).size > 1, `${date}: the simulation should vary weather across days`);
}
assert.equal(weatherForDate('1848-01-01', 2), weatherForDate('1848-01-01', 2));
assert.notEqual(weatherForDate('1848-01-01', 2), weatherForDate('1848-01-01', 3));

for (const mapId of ['nevsky', 'courtyard', 'market-quay', 'canal-road', 'workyard', 'bookshop-lane']) {
  assert.equal(mapHasAtmosphere(mapId), true);
  const snow = atmosphereForMap(mapId, 640, 360, 4000, false, 'snow');
  assert.equal(snow.kind, 'snow');
  assert.ok(snow.particles.every(flake => Number.isFinite(flake.x) && Number.isFinite(flake.y) && flake.size > 0));
  assert.deepEqual(atmosphereForMap(mapId, 640, 360, 0, true, 'snow'), atmosphereForMap(mapId, 640, 360, 9000, true, 'snow'),
    'reduced motion keeps weather particles stationary');
}
assert.equal(atmosphereForMap('market-quay', 640, 360, 0, false, 'clear'), null);
assert.equal(atmosphereForMap('dead-souls', 640, 360, 0, false, 'snow'), null, 'historical weather does not leak into a literary realm');
assert.equal(atmosphereForMap('printshop', 640, 360, 0, false, 'snow').kind, 'dust', 'indoor work atmosphere stays local');

console.log(JSON.stringify({ status: 'PASS', seasons: 4, daysSampledPerSeason: 14,
  weatherKinds: ['snow', 'fog', 'wind', 'overcast', 'drizzle', 'clear'], outdoorMaps: 6,
  reducedMotion: 'stationary', literaryRealm: 'isolated', indoorDust: 'preserved' }, null, 2));
