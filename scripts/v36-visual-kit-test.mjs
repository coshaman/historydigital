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
const nevskyViewSourceId = 'V36-ART-WESTERLING-NEVSKY-1847';
const nevskyViewSource = sourceRegister.sources.find(source => source.sourceId === nevskyViewSourceId);
assert.ok(nevskyViewSource?.sourceUrl.endsWith('/r-60382/index.php') && nevskyViewSource?.eraRange === '1847', 'the exact 1847 Russian Museum Nevsky view is registered');
assert.ok(nevskyViewSource?.visualFeature.includes('does not resolve individual paving stones') && nevskyViewSource?.gameTransformation.includes('remain UNVERIFIED_RECONSTRUCTION'), 'the city-view source is restricted to scene context and does not certify cobblestone details');
assert.ok(nevskyViewSource?.rights.includes('not copied or redistributed'), 'the 1847 museum watercolor is not redistributed');
assert.ok(provenance.assets.find(asset => asset.id === 'petersburg-tiles')?.sourceIds.includes(nevskyViewSourceId), 'the tile-atlas provenance links the contextual Nevsky view');
const fedotovChairSourceId = 'V36-ART-FEDOTOV-FLUG-CHAIR-1846';
const fedotovChairSource = sourceRegister.sources.find(source => source.sourceId === fedotovChairSourceId);
assert.ok(fedotovChairSource?.sourceUrl.endsWith('/r-7740/index.php') && fedotovChairSource?.eraRange === '1846–1847', 'the exact 1846–1847 Fedotov chair drawing is registered');
assert.ok(fedotovChairSource?.visualFeature.includes('rounded, open back') && fedotovChairSource?.gameTransformation.includes('writing chair are project-authored interpretations'), 'the chair reference records visible form and limits its interpretation');
assert.ok(fedotovChairSource?.rights.includes('not copied or redistributed'), 'the Fedotov drawing is not redistributed');
assert.ok(provenance.assets.find(asset => asset.id === 'petersburg-tiles')?.sourceIds.includes(fedotovChairSourceId), 'the tile-atlas provenance links the bounded chair reference');
const knownSourceIds = new Set(sourceRegister.sources.map(source => source.sourceId));
const firewoodSourceId = 'V36-ART-SHCHEDROVSKY-WATER-CARRIER-1845';
const firewoodSource = sourceRegister.sources.find(source => source.sourceId === firewoodSourceId);
assert.ok(firewoodSource?.visualFeature.includes('short rounded pieces stacked') && firewoodSource?.gameTransformation.includes('Atlas tile GID 83'), 'the inspected Shchedrovsky plate bounds the firewood tile reference');
assert.ok(atlasRecord.sourceIds.includes(firewoodSourceId), 'the atlas-level provenance includes the group-print reference');
assert.ok(atlasRecord.sourceUrls.includes('https://rusneb.ru/catalog/000199_000009_009492648/') && atlasRecord.sourceUrls.includes('https://compuart.ru/article/23289'), 'atlas provenance preserves both catalog and inspected plate-reproduction URLs');
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
const fishseller = JSON.parse(await fs.readFile(path.join(root, 'rpg/characters/fishseller_klavdiya.json'), 'utf8'));
const fishsellerSourceId = 'V36-ART-KOLLMAN-FISH-SELLERS-1830S';
const fishsellerSource = sourceRegister.sources.find(source => source.sourceId === fishsellerSourceId);
const fishsellerSpriteRecord = provenance.assets.find(asset => asset.id === 'sprite-fishseller_klavdiya');
const carter = JSON.parse(await fs.readFile(path.join(root, 'rpg/characters/carter_roman.json'), 'utf8'));
const carterSourceId = 'V36-ART-COLLMANN-ICE-DELIVERY-1842';
const carterSource = sourceRegister.sources.find(source => source.sourceId === carterSourceId);
const carterSpriteRecord = provenance.assets.find(asset => asset.id === 'sprite-carter_roman');
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
assert.equal(fishseller.sprite.style, 'fishvendor', 'Klavdiya has a distinct river-fish-vendor silhouette');
assert.ok(fishseller.sprite.visualReferenceIds?.includes(fishsellerSourceId), 'Klavdiya names the inspected fish-seller painting');
assert.ok(fishseller.sprite.visualReferenceNotes.includes('stands so she can move'), 'the walking sprite is clearly distinguished from the seated source figure');
assert.ok(fishsellerSource?.visualFeature.includes('sits low beside a large oval container') && fishsellerSource?.gameTransformation.includes("The source does not establish Klavdiya's identity"), 'the fish-seller source records the observed figure and its limits');
assert.ok(fishsellerSource?.rights.includes('no museum image is copied or redistributed'), 'the fish-seller painting is not redistributed');
assert.ok(fishsellerSpriteRecord?.sourceIds.includes(fishsellerSourceId), 'Klavdiya sprite provenance resolves to the inspected fish-seller source');
assert.equal(carter.sprite.style, 'cartdriver', 'Roman has a distinct source-informed cart-driver silhouette');
assert.ok(carter.sprite.visualReferenceIds?.includes(carterSourceId), 'Roman names the inspected ice-delivery watercolor');
assert.ok(carterSource?.visualFeature.includes('horse drawing a box-shaped ice cart') && carterSource?.gameTransformation.includes("does not reproduce a particular figure"), 'the transport scene is visually scoped and kept separate from Roman as a fictional person');
assert.ok(carterSource?.rights.includes('no museum image is copied or redistributed'), 'the ice-delivery painting is not redistributed');
assert.ok(carterSpriteRecord?.sourceIds.includes(carterSourceId), 'Roman sprite provenance resolves to the inspected ice-delivery source');
const coachman = JSON.parse(await fs.readFile(path.join(root, 'rpg/characters/coachman_timofey.json'), 'utf8'));
const coachmanSourceId = 'V36-ART-COLLMANN-HIRE-CAB-1842';
const coachmanSource = sourceRegister.sources.find(source => source.sourceId === coachmanSourceId);
const coachmanSpriteRecord = provenance.assets.find(asset => asset.id === 'sprite-coachman_timofey');
assert.equal(coachman.sprite.style, 'cabman', 'Timofey has a distinct source-informed cab-driver silhouette');
assert.ok(coachman.sprite.visualReferenceIds?.includes(coachmanSourceId), 'Timofey names the inspected cab-hire watercolor');
assert.ok(coachmanSource?.visualFeature.includes('one standing figure handles the reins') && coachmanSource?.gameTransformation.includes('does not reproduce a particular figure'), 'the cab-hire source is visually scoped and kept separate from Timofey as a fictional person');
assert.ok(coachmanSource?.rights.includes('no museum image is copied or redistributed'), 'the cab-hire painting is not redistributed');
assert.ok(coachmanSpriteRecord?.sourceIds.includes(coachmanSourceId), 'Timofey sprite provenance resolves to the inspected cab-hire source');
const streetVendor = JSON.parse(await fs.readFile(path.join(root, 'rpg/characters/street_vendor_matryona.json'), 'utf8'));
const hawkerSourceId = 'V36-ART-LABASTIDE-HAWKER-TRAY-1845';
const hawkerSource = sourceRegister.sources.find(source => source.sourceId === hawkerSourceId);
const hawkerSpriteRecord = provenance.assets.find(asset => asset.id === 'sprite-street_vendor_matryona');
assert.ok(streetVendor.sprite.visualReferenceIds?.includes(hawkerSourceId), 'Matryona names the visually inspected street-peddler drawing');
assert.ok(streetVendor.sprite.visualReferenceNotes.includes('her scarf, clothes') && streetVendor.sprite.visualReferenceNotes.includes('Neither male drawing establishes women\'s clothing'), 'male drawings are limited to selling props and not misrepresented as evidence for Matryona\'s clothing');
assert.ok(hawkerSource?.visualFeature.includes('belt-mounted rack carrying several trays') && hawkerSource?.gameTransformation.includes('adapts only the idea of a compact waist-level portable goods rack'), 'the source image and limited prop adaptation are documented');
assert.ok(hawkerSource?.rights.includes('no museum image is copied or redistributed'), 'the hawker drawing is not redistributed');
assert.ok(hawkerSpriteRecord?.sourceIds.includes(hawkerSourceId), 'Matryona sprite provenance resolves to the inspected peddler source');
const brushSellerSourceId = 'V36-ART-LABASTIDE-BRUSH-SELLER-1845';
const brushSellerSource = sourceRegister.sources.find(source => source.sourceId === brushSellerSourceId);
assert.ok(streetVendor.sprite.visualReferenceIds?.includes(brushSellerSourceId), 'Matryona names the inspected brush-seller drawing');
assert.ok(brushSellerSource?.visualFeature.includes('cross-shoulder pole or yoke') && brushSellerSource?.gameTransformation.includes('adapts only the visible shoulder yoke and hanging brush silhouettes'), 'the brush-seller source and prop-only adaptation are documented');
assert.ok(brushSellerSource?.rights.includes('not copied or redistributed'), 'the brush-seller drawing is not redistributed');
assert.ok(hawkerSpriteRecord?.sourceIds.includes(brushSellerSourceId), 'Matryona sprite provenance includes the second inspected drawing');
const watercarrier = JSON.parse(await fs.readFile(path.join(root, 'rpg/characters/watercarrier_luka.json'), 'utf8'));
const watercarrierSourceId = 'V36-ART-SHCHEDROVSKY-WATER-CARRIER-1845';
const watercarrierSource = sourceRegister.sources.find(source => source.sourceId === watercarrierSourceId);
const watercarrierSpriteRecord = provenance.assets.find(asset => asset.id === 'sprite-watercarrier_luka');
assert.ok(watercarrier.sprite.visualReferenceIds?.includes(watercarrierSourceId), 'Luka records the checked 1845 water-carrier group print');
assert.ok(watercarrier.sprite.visualReferenceNotes.includes('does not identify which object belongs to him') && watercarrier.sprite.visualReferenceNotes.includes('original role icon'), 'Luka does not overstate object attribution or carrying method');
assert.ok(watercarrierSource?.visualFeature.includes('does not let us confidently assign the barrel or tub') && watercarrierSource?.confidence.includes('LOW for assigning'), 'water-carrier source records uncertainty about the depicted group and objects');
assert.ok(watercarrierSource?.rights.includes('copied into the game'), 'the secondary reproduction is not redistributed');
assert.ok(watercarrierSpriteRecord?.sourceIds.includes(watercarrierSourceId), 'Luka sprite provenance resolves to the checked source');
const baker = JSON.parse(await fs.readFile(path.join(root, 'rpg/characters/baker_fyodor.json'), 'utf8'));
const kalachSourceId = 'V36-ART-LABASTIDE-KALACH-SELLER-1845';
const kalachSource = sourceRegister.sources.find(source => source.sourceId === kalachSourceId);
const bakerSpriteRecord = provenance.assets.find(asset => asset.id === 'sprite-baker_fyodor');
assert.ok(baker.sprite.visualReferenceIds?.includes(kalachSourceId), 'Fyodor names the inspected kalach-seller drawing');
assert.ok(baker.sprite.visualReferenceNotes.includes('does not use the street seller as evidence for a bakery worker\'s clothes'), 'the street seller is not misrepresented as a bakery-worker costume source');
assert.ok(kalachSource?.visualFeature.includes('X-legged street table carrying many rounded breads') && kalachSource?.gameTransformation.includes('only the rounded bread-on-tray product cue'), 'the observed bread display and limited sprite transformation are recorded');
assert.ok(kalachSource?.rights.includes('no museum image is copied or redistributed'), 'the kalach-seller drawing is not redistributed');
assert.ok(bakerSpriteRecord?.sourceIds.includes(kalachSourceId), 'Fyodor sprite provenance resolves to the inspected kalach-seller source');
const reviewManifest = (await fs.readFile(path.join(root, 'qa/ASSET_REVIEW_MANIFEST.csv'), 'utf8')).trim().split(/\r?\n/);
assert.equal(reviewManifest.length, 37, 'the visual review manifest covers all 36 residents');
assert.ok(reviewManifest.some(line => line.includes('"market_nadezhda"') && line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"') && line.includes(costumeSourceId)), 'the inspected Nadezhda costume is recorded with a bounded review status');
assert.ok(reviewManifest.some(line => line.includes('"junior_guard_sergey"') && line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"') && line.includes(gatekeeperSourceId)), 'the inspected Sergey costume is recorded with bounded source and review status');
assert.ok(reviewManifest.some(line => line.includes('"fishseller_klavdiya"') && line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"') && line.includes(fishsellerSourceId)), 'the fish-seller costume is tracked with bounded source provenance');
assert.ok(reviewManifest.some(line => line.includes('"carter_roman"') && line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"') && line.includes(carterSourceId)), 'the cart-driver costume is tracked with bounded source provenance');
assert.ok(reviewManifest.some(line => line.includes('"coachman_timofey"') && line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"') && line.includes(coachmanSourceId)), 'the cab-driver costume is tracked with bounded source provenance');
assert.ok(reviewManifest.some(line => line.includes('"street_vendor_matryona"') && line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"') && line.includes(hawkerSourceId) && line.includes(brushSellerSourceId)), 'Matryona\'s portable vending and brush-carrying props have bounded provenance to both inspected drawings');
assert.ok(reviewManifest.some(line => line.includes('"watercarrier_luka"') && line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"') && line.includes(watercarrierSourceId) && line.includes('특정 물건의 주인을 단정하지 않음')), 'Luka\'s prop-only reference preserves the plate attribution uncertainty');
assert.ok(reviewManifest.some(line => line.includes('"baker_fyodor"') && line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"') && line.includes(kalachSourceId)), 'Fyodor\'s kalach product prop has bounded source provenance');
assert.equal(reviewManifest.filter(line => line.includes('"LIMITED_SOURCE_INSPIRED_REVIEW"')).length, 8, 'eight specific residents have bounded source-inspected asset reviews');
assert.equal(reviewManifest.filter(line => line.includes('"NOT_VISUALLY_REVIEWED"')).length, 28, 'the remaining 28 residents are honestly listed as awaiting source-by-source visual review');
for (const [index, line] of usageRows.slice(1).entries()) {
  const fields = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map(match => match[1].replaceAll('""', '"'));
  const gid = Number(fields[0]);
  if (gid <= 45) {
    if (gid === 19) {
      assert.equal(fields[1], 'CHAIR_WRITING');
      assert.equal(fields[4], 'CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE');
      assert.equal(fields[5], fedotovChairSourceId);
      assert.equal(fields[6], fedotovChairSource.sourceUrl);
      assert.match(fields[7], /높은 등받이와 가는 지지대의 일반적 형태만 참고/);
      assert.match(fields[7], /기능은 미검증/);
      continue;
    }
    assert.equal(fields[4], 'UNVERIFIED_RECONSTRUCTION', `GID ${gid} has no checked object-level visual source`);
    assert.equal(fields[5], ''); assert.equal(fields[6], '');
    assert.match(fields[7], /UNVERIFIED_RECONSTRUCTION/);
    continue;
  }
  if (gid >= 46 && gid <= 60) {
    assert.equal(fields[4], 'UNVERIFIED_RECONSTRUCTION', `surface GID ${gid} does not overstate its source support`);
    if (gid >= 46 && gid <= 49) {
      assert.equal(fields[5], nevskyViewSourceId, `Nevsky GID ${gid} links its scene-context source`);
      assert.equal(fields[6], nevskyViewSource.sourceUrl);
      assert.match(fields[7], /포석/);
      assert.match(fields[7], /미검증/);
    } else {
      assert.equal(fields[5], ''); assert.equal(fields[6], '');
      assert.match(fields[7], /색·문양·재료를 입증하지 않는다/);
    }
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
  } else if (gid === 83) {
    assert.equal(fields[1], 'SHARED_FIREWOOD_STACK');
    assert.equal(fields[4], 'CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE');
    assert.equal(fields[5], 'V36-ART-SHCHEDROVSKY-WATER-CARRIER-1845');
    assert.ok(knownSourceIds.has(fields[5]));
    assert.ok(firewoodSource?.confidence.includes('LOW for assigning'));
    assert.equal(fields[6], 'https://rusneb.ru/catalog/000199_000009_009492648/');
    assert.match(fields[7], /짧은 나무 조각이 쌓인 모습/);
    assert.match(fields[7], /목재 종류·치수·보관 관행/);
  } else {
    assert.equal(fields[4], 'UNVERIFIED_RECONSTRUCTION', `GID ${gid} has no checked object-level source`);
    assert.equal(fields[5], '', `GID ${gid} must not cite an unrelated source`);
    assert.equal(fields[6], '', `GID ${gid} must not link an unrelated source`);
    assert.match(fields[7], /UNVERIFIED_RECONSTRUCTION/);
  }
}
assert.equal(usageRows.slice(1).filter(line => line.includes('"CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE"')).length, 5, 'five environmental assets have bounded source-inspected inspirations');

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
