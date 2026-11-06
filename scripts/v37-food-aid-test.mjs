import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const files = await readdir(new URL('../rpg/maps/', import.meta.url));
const cardFiles = await readdir(new URL('../rpg/characters/', import.meta.url));
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [maps, cards] = await Promise.all([
  Promise.all(files.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(row => [row.mapId, row]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url)))),
]);
const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
state.world.clockMinutes = 600;
state.world.currentMapId = 'market-quay';
const recipient = state.hosts.market_nadezhda, donor = state.hosts.baker_fyodor;
const bread = recipient.marketOffers.find(offer => offer.category === 'food')?.itemKo;
assert.ok(bread, 'test donor has a catalogued food item');
for (const host of [recipient, donor]) { host.mapId = 'market-quay'; host.position = { x: 13, y: 12 }; }
recipient.needs.hunger = 92;
recipient.money.amount = 0;
recipient.inventory = recipient.inventory.filter(item => item !== bread);
donor.inventory = [bread, bread];
assert.ok(recipient.relationshipEdges.some(edge => edge.kind === 'KINSHIP' && edge.toHostId === donor.id), 'the test uses an authored sibling relationship');
const next = game.advanceNpcWorld(state, 1, maps);
assert.equal(next.world.foodAidRecords.length, 1, 'cashless severe hunger activates a real kinship food transfer');
assert.equal(next.world.foodAidRecords[0].recipientHostId, recipient.id);
assert.equal(next.world.foodAidRecords[0].donorHostId, donor.id);
assert.equal(next.world.foodAidRecords[0].kind, 'KIN_FOOD_AID');
assert.equal(next.world.foodAidRecords[0].debt.status, 'OUTSTANDING', 'family food is tracked as an informal loan');
assert.equal(next.hosts[donor.id].inventory.filter(item => item === bread).length, 1, 'the donor keeps their last portion');
assert.ok(next.hosts[recipient.id].needs.hunger < 92, 'aid feeds the hungry resident');
assert.equal(next.hosts[recipient.id].relations[donor.id], '끼니값을 빌려 준 가족');
assert.ok(next.ledger.some(entry => entry.eventType === 'NPC_SIMULATION'
  && entry.careTransfers.some(row => row.kind === 'KIN_FOOD_AID_LOAN')));
const restored = game.loadGame(game.saveGame(next), { maps, hostCards: cards });
assert.equal(game.stateHash(restored), game.stateHash(next), 'food aid survives save/load');
const repayment = structuredClone(next), borrower = repayment.hosts[recipient.id], lender = repayment.hosts[donor.id];
borrower.money.amount = next.world.foodAidRecords[0].debt.amountDue + 2;
for (const host of [borrower, lender]) { host.mapId = 'market-quay'; host.position = { x: 13, y: 12 }; }
const repaid = game.advanceNpcWorld(repayment, 1, maps);
assert.equal(repaid.world.foodAidRecords[0].debt.status, 'PAID', 'the loan is repaid when family meet and borrower can spare the coins');
assert.equal(repaid.hosts[borrower.id].money.amount, 2, 'repayment preserves a small subsistence balance');
assert.ok(repaid.hosts[lender.id].money.amount > lender.money.amount, 'the lender receives the repayment');

const starving = structuredClone(state), target = starving.hosts[recipient.id];
target.needs.hunger = 100; target.needs.foodDeprivationMinutes = 359; target.money.amount = 0;
for (const host of Object.values(starving.hosts)) {
  host.inventory = host.inventory.filter(item => item !== bread);
  for (const offer of host.marketOffers ?? []) if (offer.category === 'food') host.marketStock[offer.itemKo] = 0;
}
const ill = game.advanceNpcWorld(starving, 1, maps);
assert.equal(ill.hosts[target.id].healthState.condition, 'UNWELL', 'six hours at maximum hunger cause a mild fictional illness');
assert.equal(ill.hosts[target.id].healthState.illness.id, 'FOOD_DEPRIVATION');
const recovery = structuredClone(ill);
recovery.hosts[donor.id].inventory = [bread, bread];
for (const host of [recovery.hosts[recipient.id], recovery.hosts[donor.id]]) { host.mapId = 'market-quay'; host.position = { x: 13, y: 12 }; }
const fed = game.advanceNpcWorld(recovery, 1, maps);
assert.equal(fed.hosts[target.id].healthState.condition, 'RECOVERING', 'food support starts recovery');
assert.equal(fed.hosts[target.id].needs.foodDeprivationMinutes, 0);
assert.equal(game.stateHash(game.loadGame(game.saveGame(fed), { maps, hostCards: cards })), game.stateHash(fed), 'health and loan state survive save/load');
console.log('V37 food survival: kin meal loan, repayment, six-hour hunger illness, recovery, relationship and inventory changes, and save/load passed.');
