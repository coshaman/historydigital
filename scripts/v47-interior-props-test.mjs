import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import provenance from '../rpg/assets/ASSET_PROVENANCE.json' with { type: 'json' };
import sourceRegister from '../rpg/data/source-register.json' with { type: 'json' };
import printshop from '../rpg/maps/printshop.json' with { type: 'json' };
import bookshop from '../rpg/maps/bookshop-interior.json' with { type: 'json' };
import salon from '../rpg/maps/sofiya-salon.json' with { type: 'json' };

const maps = [printshop, bookshop, salon];
const assetsByPath = new Map(provenance.assets.map(asset => [asset.path, asset]));
const registeredSourceIds = new Set(sourceRegister.sources.map(source => source.sourceId));

test('37 authored Russian-period-inspired props are integrated into the three interiors', async () => {
  const decorations = maps.flatMap(map => map.layers.find(layer => layer.name === 'Interactions').objects
    .filter(object => object.type === 'decoration'));
  const assetPaths = new Set(decorations.map(object => object.properties.find(item => item.name === 'displayAsset')?.value));
  const doorPaths = maps.map(map => map.layers.find(layer => layer.name === 'Interactions').objects
    .find(object => object.type === 'map-exit')?.properties.find(item => item.name === 'displayAsset')?.value);
  doorPaths.forEach(path => assetPaths.add(path));
  assert.equal(decorations.length, 36);
  assert.equal(assetPaths.size, 37);
  for (const assetPath of assetPaths) {
    assert.ok(assetPath, 'every display prop has an image path');
    const repoPath = `rpg/assets/${assetPath.replace('../assets/', '')}`;
    assert.ok(assetsByPath.has(repoPath), `provenance missing for ${repoPath}`);
    const record = assetsByPath.get(repoPath);
    assert.ok(record.sha256, `missing integrity hash for ${repoPath}`);
    assert.ok(record.sourceIds.length > 0 && record.sourceIds.every(id => registeredSourceIds.has(id)), `unregistered source ID for ${repoPath}`);
    assert.ok(record.sourceUrls.length > 0);
    const svg = await readFile(resolve(repoPath), 'utf8');
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.match(svg, /<svg[^>]+viewBox=/);
  }
});

test('props stay decorative and entrances render on actual map exits', () => {
  for (const map of maps) {
    const interactions = map.layers.find(layer => layer.name === 'Interactions').objects;
    const decorations = interactions.filter(object => object.type === 'decoration');
    assert.equal(decorations.length, 12, `${map.mapId} should have a balanced set of 12 visible props`);
    assert.ok(decorations.every(object => object.properties.some(item => item.name === 'shadowElevation' && Number(item.value) > 0)));
    const exits = interactions.filter(object => object.type === 'map-exit');
    assert.ok(exits.length > 0);
    assert.ok(exits.every(exit => exit.properties.some(item => item.name === 'displayAsset' && item.value.endsWith('/paneled-entry-door.svg'))));
    for (const exit of exits) {
      const props = Object.fromEntries(exit.properties.map(item => [item.name, item.value]));
      const bottom = exit.y + Number(props.displayOffsetY) + Number(props.displayHeight);
      assert.ok(Math.abs(bottom - map.height * 16) <= 1, `${map.mapId} entrance should meet the bottom wall`);
      assert.equal(props.castShadow, false, `${map.mapId} door should read as wall-mounted architecture`);
    }
    assert.ok(decorations.every(object => object.x >= 0 && object.y >= 0 && object.x < map.width * 16 && object.y < map.height * 16));
  }
  assert.ok(bookshop.layers.find(layer => layer.name === 'Interactions').objects.every(object => object.name !== '골목 쪽 문'));
});
