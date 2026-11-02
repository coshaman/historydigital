import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const atlasPath = path.join(root, 'rpg/assets/petersburg-tiles.png');
const atlasBytes = await fs.readFile(atlasPath);
const atlasDataUrl = `data:image/png;base64,${atlasBytes.toString('base64')}`;
const browser = await chromium.launch({ headless: true });
let tilePixels;
try {
  const page = await browser.newPage();
  tilePixels = await page.evaluate(async dataUrl => {
    const image = new Image(); image.src = dataUrl; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, tiles: Array.from({ length: 60 }, (_, gid) => {
      const x0 = gid % 16 * 16, y0 = Math.floor(gid / 16) * 16, pixels = [];
      for (let y = y0; y < y0 + 16; y++) for (let x = x0; x < x0 + 16; x++) {
        const at = (y * canvas.width + x) * 4; pixels.push(data[at], data[at + 1], data[at + 2], data[at + 3]);
      }
      return pixels;
    }) };
  }, atlasDataUrl);
} finally { await browser.close(); }

assert.equal(tilePixels.width, 256, 'atlas keeps 16 columns of 16px tiles');
assert.equal(tilePixels.height, 160, 'atlas height includes all 60 declared tiles');
const tileHashes = tilePixels.tiles.map(pixels => createHash('sha256').update(Buffer.from(pixels)).digest('hex'));
const uniqueHashes = new Set(tileHashes);
const duplicateGroups = [...new Set(tileHashes)].map(hash => ({ hash, gids: tileHashes.flatMap((value, index) => value === hash ? [index + 1] : []) })).filter(group => group.gids.length > 1);

const mapIds = ['nevsky','market-quay','printshop','courtyard','chancery','police-station','dead-souls','overcoat'];
const maps = Object.fromEntries(await Promise.all(mapIds.map(async id => [id, JSON.parse(await fs.readFile(path.join(root, `rpg/maps/${id}.json`), 'utf8'))])));
for (const [id, map] of Object.entries(maps)) {
  const tileset = map.tilesets.find(item => item.image?.endsWith('petersburg-tiles.png'));
  assert.equal(tileset?.tilecount, 60, `${id} declares all 60 atlas tiles`);
}
function usedRange(map, min, max) { return new Set(map.layers.find(layer => layer.name === 'Ground').data.filter(gid => gid >= min && gid <= max)); }
const used = {
  nevsky: [...usedRange(maps.nevsky, 46, 49)].sort((a,b) => a-b),
  marketQuay: [...usedRange(maps['market-quay'], 50, 60)].sort((a,b) => a-b),
  printshop: [...usedRange(maps.printshop, 58, 60)].sort((a,b) => a-b),
  courtyard: [...usedRange(maps.courtyard, 54, 57)].sort((a,b) => a-b),
};
assert.equal(used.nevsky.length, 4, 'Nevsky uses all four new street stones');
assert.equal(used.marketQuay.length, 11, 'market and quay use all ground, stone and timber variants');
assert.equal(used.printshop.length, 3, 'printshop uses the indoor timber floor variants');
assert.equal(used.courtyard.length, 4, 'courtyard uses all worn stone variants');

const usageRows = (await fs.readFile(path.join(root, 'rpg/assets/ASSET_USAGE_V36.csv'), 'utf8')).trim().split(/\r?\n/);
assert.equal(usageRows.length, 61, 'tile usage ledger has a header and one row per GID');
const usageGids = usageRows.slice(1).map(line => Number(line.match(/^"(\d+)"/)?.[1]));
assert.deepEqual(usageGids, Array.from({ length: 60 }, (_, index) => index + 1), 'ledger covers each atlas tile exactly once in order');
const provenance = JSON.parse(await fs.readFile(path.join(root, 'rpg/assets/ASSET_PROVENANCE.json'), 'utf8'));
const atlasRecord = provenance.assets.find(asset => asset.id === 'petersburg-tiles');
assert.equal(atlasRecord.historicalConfidence, 'CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE');
assert.match(atlasRecord.notes, /1849 atlas is a later comparative map/);
assert.doesNotMatch(atlasRecord.notes, /1847 photograph|surveyed 1847 paving/i);
const sourceRegister = JSON.parse(await fs.readFile(path.join(root, 'docs/v36/historical-map-source-register.json'), 'utf8'));
const knownSourceIds = new Set(sourceRegister.sources.map(source => source.sourceId));
assert.ok(atlasRecord.sourceIds.every(id => knownSourceIds.has(id)), 'atlas provenance source IDs resolve to checked-in historical records');

const districtData = JSON.parse(await fs.readFile(path.join(root, 'rpg/data/city-districts-v36.json'), 'utf8'));
const residentIds = [...new Set(districtData.districts.flatMap(district => district.residentIds ?? []))];
const residentAssets = await Promise.all(residentIds.map(async id => {
  const card = JSON.parse(await fs.readFile(path.join(root, `rpg/characters/${id}.json`), 'utf8'));
  const spritePath = path.join(root, 'rpg', card.sprite.file), portraitPath = path.join(root, 'rpg', card.portrait.file);
  const [spriteBytes, portraitBytes] = await Promise.all([fs.readFile(spritePath), fs.readFile(portraitPath)]);
  const dataUrl = (file, bytes) => `${path.extname(file).toLowerCase() === '.svg' ? 'image/svg+xml' : 'image/png'};base64,${bytes.toString('base64')}`;
  return { id, spriteFile: card.sprite.file, portraitFile: card.portrait.file, frameWidth: card.sprite.frameWidth, frameHeight: card.sprite.frameHeight,
    spriteDataUrl: dataUrl(spritePath, spriteBytes), portraitDataUrl: dataUrl(portraitPath, portraitBytes) };
}));
const decodedResidents = await pageForResidentAssets(residentAssets);
assert.equal(residentIds.length, 36, 'district prototypes identify 36 active residents');
assert.equal(new Set(decodedResidents.map(row => row.id)).size, 36);
assert.ok(decodedResidents.every(row => row.sprite.width === 48 && row.sprite.height === 96 && row.frameWidth === 16 && row.frameHeight === 24), 'all resident walk sheets are 3 frames × 4 directions');
assert.ok(decodedResidents.every(row => row.portrait.width === 64 && row.portrait.height === 64), 'all resident portraits use the in-game portrait size');
const uniqueSprites = new Set(decodedResidents.map(row => row.sprite.hash)).size;
const uniquePortraits = new Set(decodedResidents.map(row => row.portrait.hash)).size;
const spriteDuplicates = [...new Set(decodedResidents.map(row => row.sprite.hash))].map(hash => decodedResidents.filter(row => row.sprite.hash === hash).map(row => row.id)).filter(group => group.length > 1);
const portraitDuplicates = [...new Set(decodedResidents.map(row => row.portrait.hash))].map(hash => decodedResidents.filter(row => row.portrait.hash === hash).map(row => `${row.id}:${row.portraitFile}`)).filter(group => group.length > 1);
assert.equal(uniqueSprites, 36, `all resident walk sprites have distinct rendered pixels; duplicates=${JSON.stringify(spriteDuplicates)}`);
assert.equal(uniquePortraits, 36, `all resident portraits have distinct rendered pixels; duplicates=${JSON.stringify(portraitDuplicates)}`);

const report = {
  schemaVersion: 'V36_VISUAL_KIT_AUDIT_1',
  status: uniqueHashes.size === 60 ? 'PASS' : 'FAIL',
  atlas: { width: tilePixels.width, height: tilePixels.height, declaredTiles: 60, uniquePixelTiles: uniqueHashes.size, duplicateGroups },
  tileUsageByDistrict: used,
  mapsWithUpdatedAtlasCount: Object.keys(maps).length,
  assetUsageLedgerRows: usageRows.length - 1,
  sourceIdsResolve: true,
  residentArt: { residents: residentIds.length, uniqueWalkSprites: uniqueSprites, uniquePortraits, frameGrid: '3×4 at 16×24 px', portraitSize: '64×64 px' },
  screenshotEvidence: ['screenshots/nevsky-12-resident-neighborhood.png','screenshots/market-quay-12-resident-neighborhood.png'],
};
await fs.writeFile(path.join(root, 'docs/v36/current-audit/VISUAL_KIT_AUDIT.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;

async function pageForResidentAssets(assets) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    return await page.evaluate(async entries => Promise.all(entries.map(async entry => {
      const load = async dataUrl => {
        const image = new Image(); image.src = `data:${dataUrl}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.imageSmoothingEnabled = false; context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 2166136261; for (const value of pixels) { hash ^= value; hash = Math.imul(hash, 16777619); }
        return { width: image.naturalWidth, height: image.naturalHeight, hash: hash >>> 0 };
      };
      return { id: entry.id, frameWidth: entry.frameWidth, frameHeight: entry.frameHeight, sprite: await load(entry.spriteDataUrl), portrait: await load(entry.portraitDataUrl) };
    })), assets);
  } finally { await browser.close(); }
}
