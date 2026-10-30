import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readJson = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const map = readJson('../rpg/maps/nevsky.json');
const provenance = readJson('../rpg/assets/ASSET_PROVENANCE.json');

test('Nevsky renders a sourced sidewalk, wet gutter, and distinct carriageway surfaces', () => {
  const ground = map.layers.find(layer => layer.name === 'Ground');
  assert.ok(ground, 'the Tiled ground layer exists');
  const tileCount = map.tilesets[0].tilecount;
  assert.ok(tileCount >= 44, 'the tilesheet declares the four city-street surface tiles');

  const row = y => ground.data.slice(y * map.width, (y + 1) * map.width);
  for (const y of [8, 9]) {
    assert.ok(row(y).slice(1, 29).every(gid => gid === 43), `street-side paving fills row ${y}`);
  }
  assert.ok(row(10).slice(1, 29).every(gid => gid === 44), 'a gutter separates paving from the carriageway');
  const carriageway = [11, 12, 13, 14, 15, 16, 17].flatMap(y => row(y).slice(1, 29));
  assert.ok(carriageway.every(gid => gid === 41 || gid === 42), 'the center lane uses wet cobble variants');
  assert.ok(carriageway.includes(41) && carriageway.includes(42), 'wheel-worn and damp cobbles both appear');

  assert.ok(map.metadata.sourceIds.includes('OBJ-SADOVNIKOV-1835'));
  const asset = provenance.assets.find(entry => entry.path === 'rpg/assets/petersburg-tiles.png');
  assert.ok(asset?.sourceIds.includes('OBJ-SADOVNIKOV-1835'), 'the original pixel tiles retain their historical visual source');
  assert.ok(asset.sourceUrls.some(url => url.includes('/gr.-1929_15/')), 'the tile provenance links to the verified panorama record');
});
