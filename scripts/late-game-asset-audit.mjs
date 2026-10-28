import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const manifest = JSON.parse(await readFile(join(root, 'assets/late-game/ASSET_PROVENANCE.json'), 'utf8'));
const scenarios = JSON.parse(await readFile(join(root, 'narrative/LATE_GAME_SCENARIOS.json'), 'utf8'));
const ids = new Set(manifest.assets.map(asset => asset.id));
assert.equal(ids.size, manifest.assets.length, 'asset manifest IDs are unique');
assert.ok(manifest.assets.filter(asset => asset.role === 'location_background').length >= 6, 'six location backgrounds are documented');
assert.ok(manifest.assets.filter(asset => asset.role === 'event_still').length >= 4, 'four event stills are documented');
const references = new Set(scenarios.scenes.flatMap(scene => [scene.backgroundId, scene.cgId].filter(id => id && id !== 'none')));
const results = [];
for (const asset of manifest.assets) {
  assert.match(asset.file, /^[a-z0-9_]+\.webp$/i, `${asset.id} uses optimized WebP`);
  const path = join(root, 'assets/late-game', asset.file);
  const bytes = await readFile(path);
  const info = await stat(path);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${asset.id} RIFF signature`);
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${asset.id} WebP signature`);
  assert.ok(info.size > 1000 && info.size <= 300_000, `${asset.id} is within delivery size limit`);
  assert.ok(asset.prompt?.length > 30, `${asset.id} retains generation provenance`);
  results.push({ id: asset.id, role: asset.role, bytes: info.size, referencedByScenario: references.has(asset.id) });
}
for (const id of references) assert.ok(ids.has(id), `scenario art reference ${id} has provenance`);
const output = { status: 'PASS', backgrounds: results.filter(item => item.role === 'location_background').length, eventStills: results.filter(item => item.role === 'event_still').length, totalBytes: results.reduce((total, item) => total + item.bytes, 0), assets: results };
await mkdir(join(root, 'artifacts/v32/logs'), { recursive: true });
await writeFile(join(root, 'artifacts/v32/logs/asset-audit.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(`late-game-asset-audit: ${output.backgrounds} backgrounds, ${output.eventStills} event stills, ${output.totalBytes} optimized bytes — PASS`);
