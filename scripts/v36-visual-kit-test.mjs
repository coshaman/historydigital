import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { interactionTile } from '../rpg/engine/world-presentation.mjs';

const root = process.cwd();
const withTimeout = (promise, label, ms = 45000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
  promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});
const atlasPath = path.join(root, 'rpg/assets/petersburg-tiles.png');
assert.equal(interactionTile({ type: 'inspectable', properties: [{ name: 'assetTileId', value: 85 }] }), 85, 'runtime recognizes the last tile in the expanded atlas');
const atlasBytes = await fs.readFile(atlasPath);
const atlasDataUrl = `data:image/png;base64,${atlasBytes.toString('base64')}`;
const browser = await chromium.launch({ headless: true });
let tilePixels;
try {
  const page = await browser.newPage();
  tilePixels = await withTimeout(page.evaluate(async dataUrl => {
    const image = new Image(); image.src = dataUrl; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { width: canvas.width, height: canvas.height, tiles: Array.from({ length: 85 }, (_, gid) => {
      const x0 = gid % 16 * 16, y0 = Math.floor(gid / 16) * 16, pixels = [];
      for (let y = y0; y < y0 + 16; y++) for (let x = x0; x < x0 + 16; x++) {
        const at = (y * canvas.width + x) * 4; pixels.push(data[at], data[at + 1], data[at + 2], data[at + 3]);
      }
      return pixels;
    }) };
  }, atlasDataUrl), 'atlas pixel read');
  console.log('visual-kit: atlas pixels decoded');
} finally { await withTimeout(browser.close(), 'atlas browser close', 10000); }

assert.equal(tilePixels.width, 256, 'atlas keeps 16 columns of 16px tiles');
assert.equal(tilePixels.height, 160, 'atlas height includes all 85 declared tiles');
const tileHashes = tilePixels.tiles.map(pixels => createHash('sha256').update(Buffer.from(pixels)).digest('hex'));
const uniqueHashes = new Set(tileHashes);
const duplicateGroups = [...new Set(tileHashes)].map(hash => ({ hash, gids: tileHashes.flatMap((value, index) => value === hash ? [index + 1] : []) })).filter(group => group.gids.length > 1);

const mapIds = (await fs.readdir(path.join(root,'rpg/maps'))).filter(file=>file.endsWith('.json')).map(file=>file.slice(0,-5)).sort();
const maps = Object.fromEntries(await Promise.all(mapIds.map(async id => [id, JSON.parse(await fs.readFile(path.join(root, `rpg/maps/${id}.json`), 'utf8'))])));
for (const [id, map] of Object.entries(maps)) {
  const tileset = map.tilesets.find(item => item.image?.endsWith('petersburg-tiles.png'));
  assert.equal(tileset?.tilecount, 85, `${id} declares all 85 atlas tiles`);
  if (['bakery-interior','bookshop-interior','sewing-room','printshop'].includes(id)) {
    assert.ok(map.layers.find(layer => layer.name === 'Ground').data.every(gid => gid < 58 || gid > 60), `${id} uses indoor timber instead of dock planks`);
  }
}
function usedRange(map, min, max) { return new Set(map.layers.find(layer => layer.name === 'Ground').data.filter(gid => gid >= min && gid <= max)); }
const used = {
  nevsky: [...usedRange(maps.nevsky, 46, 49)].sort((a,b) => a-b),
  marketQuay: [...usedRange(maps['market-quay'], 50, 60)].sort((a,b) => a-b),
  printshopIndoorFloor: [...usedRange(maps.printshop, 5, 6)].sort((a,b) => a-b),
  courtyard: [...usedRange(maps.courtyard, 54, 57)].sort((a,b) => a-b),
};
assert.equal(used.nevsky.length, 4, 'Nevsky uses all four new street stones');
assert.equal(used.marketQuay.length, 11, 'market and quay use all ground, stone and timber variants');
assert.deepEqual(used.printshopIndoorFloor, [5, 6], 'printshop uses both indoor timber floor variants');
assert.equal(used.courtyard.length, 4, 'courtyard uses all worn stone variants');
for (const [mapId, range] of [['market-quay',[10,18]],['canal-road',[8,17]]]) {
  const map = maps[mapId], ground = map.layers.find(layer => layer.name === 'Ground').data, collision = map.layers.find(layer => layer.name === 'Collision').data;
  const waterCells = [];
  for (let y = range[0]; y <= range[1]; y++) for (let x = 28; x <= 29; x++) {
    const at = y * map.width + x;
    if (ground[at] === 85) { waterCells.push(at); assert.equal(collision[at], 1, `${mapId} water blocks movement at ${x},${y}`); }
  }
  assert.ok(waterCells.length >= 18, `${mapId} has a visible two-cell water edge`);
}
const usedAtlasGids = new Set();
for (const map of Object.values(maps).filter(item=>item.metadata.mapClass!=='LITERARY_REALM')) {
  for (const layer of map.layers.filter(item=>item.type==='tilelayer')) for (const gid of layer.data) if (gid>0&&gid<=85) usedAtlasGids.add(gid);
  for (const object of map.layers.find(item=>item.name==='Interactions')?.objects??[]) {
    const tile=Number(object.properties?.find(item=>item.name==='assetTileId')?.value);
    if(Number.isInteger(tile)&&tile>=1&&tile<=85)usedAtlasGids.add(tile);
  }
}
assert.equal(usedAtlasGids.size,85,`all 85 distinct atlas assets must appear in playable city maps; missing=${JSON.stringify([...Array(85)].map((_,index)=>index+1).filter(id=>!usedAtlasGids.has(id)))}`);

const usageRows = (await fs.readFile(path.join(root, 'rpg/assets/ASSET_USAGE_V36.csv'), 'utf8')).trim().split(/\r?\n/);
assert.equal(usageRows.length, 86, 'tile usage ledger has a header and one row per GID');
const usageGids = usageRows.slice(1).map(line => Number(line.match(/^"(\d+)"/)?.[1]));
assert.deepEqual(usageGids, Array.from({ length: 85 }, (_, index) => index + 1), 'ledger covers each atlas tile exactly once in order');
const usageKeys = usageRows.slice(1).map(line => [...line.matchAll(/"((?:[^"]|"")*)"/g)][1]?.[1]);
assert.equal(new Set(usageKeys).size,85,'all 85 ledger rows identify a distinct environmental tile asset');
assert.ok(usageKeys.every(key=>key&&key!=='EXISTING_TILE'),'tile ledger entries must use distinct descriptive names');
assert.ok(usageKeys.slice(60,84).every(key => !/(COBBLE|EARTH|STONE|PLANK)_/.test(key)), 'the 24 added entries must identify physical props, not more surface variations');
const provenance = JSON.parse(await fs.readFile(path.join(root, 'rpg/assets/ASSET_PROVENANCE.json'), 'utf8'));
const atlasRecord = provenance.assets.find(asset => asset.id === 'petersburg-tiles');
assert.match(atlasRecord.notes, /1849 atlas is later comparison/);
assert.doesNotMatch(atlasRecord.notes, /1847 photograph|surveyed 1847 paving/i);
const sourceRegister = JSON.parse(await fs.readFile(path.join(root, 'docs/v36/historical-map-source-register.json'), 'utf8'));
const knownSourceIds = new Set(sourceRegister.sources.map(source => source.sourceId));
assert.ok(atlasRecord.sourceIds.every(id => knownSourceIds.has(id)), 'atlas provenance source IDs resolve to checked-in historical records');
assert.equal(atlasRecord.historicalConfidence, 'UNVERIFIED_RECONSTRUCTION');
const marketVendor = JSON.parse(await fs.readFile(path.join(root, 'rpg/characters/market_nadezhda.json'), 'utf8'));
const costumeSourceId = 'V36-ART-LABASTIDE-EGG-SELLERS-1845';
const costumeSource = sourceRegister.sources.find(source => source.sourceId === costumeSourceId);
const marketSpriteRecord = provenance.assets.find(asset => asset.id === 'sprite-market_nadezhda');
const gatekeeper = JSON.parse(await fs.readFile(path.join(root, 'rpg/characters/junior_guard_sergey.json'), 'utf8'));
const gatekeeperSourceId = 'V36-ART-LABASTIDE-GATEKEEPER-1845';
const gatekeeperSource = sourceRegister.sources.find(source => source.sourceId === gatekeeperSourceId);
const gatekeeperSpriteRecord = provenance.assets.find(asset => asset.id === 'sprite-junior_guard_sergey');
assert.equal(marketVendor.sprite.style, 'skirt', 'the reviewed woman market-vendor sprite uses the source-informed skirt silhouette');
assert.ok(marketVendor.sprite.visualReferenceIds?.includes(costumeSourceId), 'the character sprite names its specific visual source');
assert.ok(costumeSource?.visualFeature.includes('handled basket') && costumeSource?.gameTransformation.includes('Palette colors are independent'), 'the checked source records the visible costume features and distinguishes invented color');
assert.ok(costumeSource?.rights.includes('not included or redistributed'), 'the costume source record does not claim image redistribution rights');
assert.ok(marketSpriteRecord?.sourceIds.includes(costumeSourceId), 'the market-vendor sprite provenance resolves to the exact inspected museum record');
assert.equal(gatekeeper.sprite.style, 'gatekeeper', 'Sergey has the individually source-informed civilian gatekeeper silhouette');
assert.ok(gatekeeper.sprite.visualReferenceIds?.includes(gatekeeperSourceId), 'Sergey names the exact inspected source');
assert.ok(gatekeeper.sprite.visualReferenceNotes.includes('does not depict a police or military uniform'), 'the source cannot be misread as evidence of an official uniform');
assert.ok(gatekeeperSource?.visualFeature.includes('hat at his side') && gatekeeperSource?.gameTransformation.includes('not claimed as a uniformed guard'), 'the catalog record separates seen details from the fictional guard role');
assert.ok(gatekeeperSource?.rights.includes('not included or redistributed'), 'the gatekeeper source image is not redistributed');
assert.ok(gatekeeperSpriteRecord?.sourceIds.includes(gatekeeperSourceId), 'Sergey sprite provenance resolves to the inspected gatekeeper source');
const reviewManifest = (await fs.readFile(path.join(root, 'qa/ASSET_REVIEW_MANIFEST.csv'), 'utf8')).trim().split(/\r?\n/);
assert.equal(reviewManifest.length, 37, 'the visual review manifest covers all 36 residents');
assert.ok(reviewManifest.some(line => line.includes('"market_nadezhda"') && line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"') && line.includes(costumeSourceId)), 'the inspected Nadezhda costume is recorded with a bounded review status');
assert.ok(reviewManifest.some(line => line.includes('"junior_guard_sergey"') && line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"') && line.includes(gatekeeperSourceId)), 'the inspected Sergey costume is recorded with bounded source and review status');
assert.equal(reviewManifest.filter(line => line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"')).length, 2, 'two specific costumes have bounded source-inspected reviews');
assert.equal(reviewManifest.filter(line => line.includes('"NOT_VISUALLY_REVIEWED"')).length, 34, 'the remaining 34 residents are honestly listed as awaiting source-by-source visual review');
for (const [index, line] of usageRows.slice(1).entries()) {
  const fields = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map(match => match[1].replaceAll('""', '"'));
  const gid = Number(fields[0]);
  if (gid <= 45) {
    assert.equal(fields[4], 'UNVERIFIED_RECONSTRUCTION', `GID ${gid} has no checked object-level visual source`);
    assert.equal(fields[5], ''); assert.equal(fields[6], '');
    assert.match(fields[7], /UNVERIFIED_RECONSTRUCTION/);
    continue;
  }
  if (gid >= 46 && gid <= 60) {
    assert.equal(fields[4], 'UNVERIFIED_RECONSTRUCTION', `surface GID ${gid} does not overstate its source support`);
    assert.equal(fields[5], ''); assert.equal(fields[6], '');
    assert.match(fields[7], /색·문양·재료를 입증하지 않는다/);
    continue;
  }
  if (gid < 61) continue;
  if (gid === 63) {
    assert.equal(fields[1], 'HAWKER_PORTABLE_SALES_TRAY');
    assert.equal(fields[4], 'CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE');
    assert.equal(fields[5], 'V36-ART-LABASTIDE-HAWKER-TRAY-1845');
    assert.ok(knownSourceIds.has(fields[5]));
    assert.equal(fields[6], 'https://rusmuseumvrm.ru/data/collections/drawings/r-24373/index.php');
    assert.match(fields[7], /정확한 쟁반 모양/);
  } else if (gid === 64) {
    assert.equal(fields[1], 'KALACH_VENDOR_BREAD');
    assert.equal(fields[4], 'CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE');
    assert.equal(fields[5], 'V36-ART-LABASTIDE-KALACH-SELLER-1845');
    assert.ok(knownSourceIds.has(fields[5]));
    assert.equal(fields[6], 'https://rusmuseumvrm.ru/data/collections/drawings/r-24382/index.php');
    assert.match(fields[7], /빵의 정확한 형태/);
  } else if (gid === 65) {
    assert.equal(fields[4], 'CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE');
    assert.equal(fields[5], 'V36-ART-KOLLMAN-FISH-SELLERS-1830S');
    assert.ok(knownSourceIds.has(fields[5]), 'GID 65 exact museum source must be registered');
    assert.equal(fields[6], 'https://rusmuseumvrm.ru/data/collections/drawings/r-5783/index.php');
    assert.match(fields[7], /장면 참고/);
  } else {
    assert.equal(fields[4], 'UNVERIFIED_RECONSTRUCTION', `GID ${gid} has no checked object-level source`);
    assert.equal(fields[5], '', `GID ${gid} must not cite an unrelated source`);
    assert.equal(fields[6], '', `GID ${gid} must not link an unrelated source`);
    assert.match(fields[7], /UNVERIFIED_RECONSTRUCTION/);
  }
}

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
  status: uniqueHashes.size === 85 ? 'PASS' : 'FAIL',
  atlas: { width: tilePixels.width, height: tilePixels.height, declaredTiles: 85, uniquePixelTiles: uniqueHashes.size, duplicateGroups },
  tileUsageByDistrict: { ...used, cityMapCount: Object.values(maps).filter(item=>item.metadata.mapClass!=='LITERARY_REALM').length,
    distinctAtlasGidsUsed: usedAtlasGids.size, atlasGids: [...usedAtlasGids].sort((a,b)=>a-b) },
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
    return await withTimeout(page.evaluate(async entries => Promise.all(entries.map(async entry => {
      const load = async dataUrl => {
        const image = new Image(); image.src = `data:${dataUrl}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.imageSmoothingEnabled = false; context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 2166136261; for (const value of pixels) { hash ^= value; hash = Math.imul(hash, 16777619); }
        return { width: image.naturalWidth, height: image.naturalHeight, hash: hash >>> 0 };
      };
      return { id: entry.id, frameWidth: entry.frameWidth, frameHeight: entry.frameHeight, sprite: await load(entry.spriteDataUrl), portrait: await load(entry.portraitDataUrl) };
    })), assets), 'resident sprite and portrait decode');
  } finally { await withTimeout(browser.close(), 'resident browser close', 10000); }
}
