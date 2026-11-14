import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { streetLifeFrame } from '../rpg/engine/petersburg-street-life.mjs';

assert.equal(streetLifeFrame('printshop', 1000), null, 'street traffic is only drawn on the mapped street');
assert.equal(streetLifeFrame('market-quay', 1000), null, 'street traffic does not appear on the waterfront map without a mapped route');
const early = streetLifeFrame('nevsky', 0, false, 30);
const later = streetLifeFrame('nevsky', 8000, false, 30);
assert.notEqual(early.cartX, later.cartX, 'the carriage advances through the scene');
assert.equal(early.cartY, 160, 'the cart stays in the roadway band');
assert.equal(streetLifeFrame('nevsky', 0, true, 30).cartX,
  streetLifeFrame('nevsky', 9000, true, 30).cartX, 'reduced motion fixes carriage position');
const laneCartEarly = streetLifeFrame('bookshop-lane', 0, false, 30);
const laneCartLater = streetLifeFrame('bookshop-lane', 8000, false, 30);
assert.notEqual(laneCartEarly.cartX, laneCartLater.cartX, 'a smaller street cart advances along the bookshop lane');
assert.equal(laneCartEarly.cartY, 192, 'the lane cart stays in its own roadway band');
assert.equal(streetLifeFrame('bookshop-lane', 0, true, 30).cartX,
  streetLifeFrame('bookshop-lane', 9000, true, 30).cartX, 'the lane cart also stops under reduced motion');

const provenance = JSON.parse(await readFile(new URL('../rpg/assets/ASSET_PROVENANCE.json', import.meta.url), 'utf8'));
const reference = provenance.assets.find(asset => asset.id === 'reference-nevsky-gostiny-dvor-1850s');
assert.equal(reference?.type, 'HISTORICAL_VISUAL_REFERENCE_ONLY');
assert.equal(reference?.intendedScene.length, 0, 'the later image is not used in the 1848 game scene');
assert.match(reference?.notes ?? '', /postdates the MAIN01 1848 scenes/);
const referenceBytes = await readFile(new URL(`../${reference.path.replaceAll('\\', '/')}`, import.meta.url));
assert.equal(createHash('sha256').update(referenceBytes).digest('hex').toUpperCase(), reference.sha256,
  'the offline reference image matches its recorded checksum');

const renderer = await readFile(new URL('../rpg/engine/renderer.js', import.meta.url), 'utf8');
assert.match(renderer, /drawPetersburgStreetLife\(ctx, map\.mapId/);
const rainAsset = provenance.assets.find(asset => asset.id === 'weather-rain-particle-cc0');
assert.match(rainAsset?.license ?? '', /^CC0 1\.0\b/, 'the borrowed rain sprite retains its verified reuse license');
assert.ok(rainAsset?.sourceUrls?.includes('https://opengameart.org/content/rain-particle-animated'),
  'the five-frame rain effect points to the creator and exact asset page');
for (let frame = 0; frame < 5; frame += 1) {
  assert.ok(await readFile(new URL(`../${rainAsset.path.replaceAll('{frame}', String(frame))}`, import.meta.url)),
    `rain animation frame ${frame} is packaged locally`);
}
assert.match(renderer, /rainSprites/);
assert.match(renderer, /drawImage\(rainSprite/,
  'the CC0 rain animation is actually drawn in the in-world drizzle effect');
console.log('V47 street life: map scope, motion, reduced-motion, provenance, and renderer integration passed.');
