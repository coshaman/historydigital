import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const generated = spawnSync(process.execPath, ['scripts/v36-baseline-inventory.mjs'], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
});
assert.equal(generated.status, 0, `baseline inventory must generate successfully:\n${generated.stderr || generated.stdout}`);

const audit = JSON.parse(await readFile(path.join(root, 'docs/v36/current-audit/HEAD_AUDIT.json'), 'utf8'));
const ledger = (await readFile(path.join(root, 'rpg/assets/ASSET_USAGE_V36.csv'), 'utf8')).trim().split(/\r?\n/).slice(1);
const declaredGids = new Set(ledger.map(line => Number(line.match(/^"(\d+)"/)?.[1])).filter(Number.isInteger));
assert.equal(audit.counts.environmentAtlasTilesDeclared, declaredGids.size, 'audit must derive declared tile count from the current ledger');
assert.ok(audit.counts.environmentAtlasTilesDeclared >= audit.counts.environmentAtlasTilesMinimum, 'declared environment assets must meet the V36 minimum');
assert.equal(audit.counts.distinctEnvironmentAtlasTilesUsed, declaredGids.size, 'every declared GID must be used in a city map');
assert.deepEqual(audit.counts.unresolvedEnvironmentAtlasGids, [], 'city maps must not reference undeclared tile GIDs');

const extensions = new Set(['.png', '.svg', '.jpg', '.jpeg', '.webp', '.gif']);
let visualFileCount = 0;
async function countVisualFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await countVisualFiles(file);
    else if (extensions.has(path.extname(entry.name).toLowerCase())) visualFileCount++;
  }
}
await countVisualFiles(path.join(root, 'rpg/assets'));
assert.equal(audit.counts.visualAssetsAudited, visualFileCount, 'asset audit must inventory visual files only');

const assetAudit = await readFile(path.join(root, 'docs/v36/current-audit/ASSET_AUDIT.csv'), 'utf8');
assert.ok(!assetAudit.includes('NO_PROVENANCE_RECORD'), 'every visual asset needs a provenance record');
assert.ok(!assetAudit.includes('rpg/assets/ASSET_PROVENANCE.json'), 'the provenance manifest is not itself a visual asset');
assert.ok(!assetAudit.includes('rpg/assets/ASSET_USAGE_V36.csv'), 'the tile usage ledger is not itself a visual asset');

console.log(JSON.stringify({
  status: 'PASS',
  declaredEnvironmentTiles: declaredGids.size,
  usedEnvironmentTiles: audit.counts.distinctEnvironmentAtlasTilesUsed,
  unresolvedTileGids: audit.counts.unresolvedEnvironmentAtlasGids.length,
  visualAssetsAudited: visualFileCount,
}));
