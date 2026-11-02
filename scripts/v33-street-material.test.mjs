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
  assert.ok(carriageway.every(gid => gid >= 46 && gid <= 49), 'the center lane uses the V36 street-stone variants');
  assert.deepEqual([...new Set(carriageway)].sort((a, b) => a - b), [46, 47, 48, 49], 'all four wheel-worn and damp cobble tiles appear');

  assert.ok(map.metadata.sourceIds.includes('OBJ-SADOVNIKOV-1835'), 'the Nevsky reconstruction retains its earlier panorama reference');
  const asset = provenance.assets.find(entry => entry.path === 'rpg/assets/petersburg-tiles.png');
  assert.ok(asset?.sourceIds.includes('V36-GUIDE-PUSHKAREV-1843'), 'the expanded atlas cites the verified 1843 Petersburg guide');
  assert.ok(asset.sourceUrls.some(url => url === 'https://www.prlib.ru/item/441202'), 'the tile provenance links to the guide record');
});
