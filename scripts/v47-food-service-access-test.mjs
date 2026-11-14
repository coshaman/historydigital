import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const innkeeper = JSON.parse(await readFile(new URL('rpg/characters/innkeeper_irina.json', root), 'utf8'));
const publicSoupOffer = innkeeper.marketOffers?.find(offer => offer.category === 'food'
  && offer.itemKo === '저녁 수프' && offer.mapId === 'nevsky');
assert.ok(publicSoupOffer, 'evening soup stock must be offered on a public street reachable by almost all residents');
assert.ok(publicSoupOffer.openWindows?.some(window => window.startMinute <= 1201 && window.endMinute >= 1420),
  'the public soup offer must cover the active evening service');
assert.ok(innkeeper.marketServiceShifts?.some(shift => shift.offerItemKo === '저녁 수프'
  && shift.mapId === 'nevsky' && shift.startMinute <= 1201 && shift.endMinute >= 1420
  && shift.preparationWorkActionId === 'V36_INNKEEPER_EVENING_REGISTER'),
'the innkeeper must physically serve the public offer after preparing the soup');
console.log('V47 food-service access: PASS');
