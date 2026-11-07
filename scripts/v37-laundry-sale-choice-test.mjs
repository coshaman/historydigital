import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/laundry-sale-choice-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const map = maps['market-quay'];
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === quest.entry.objectId);
assert.ok(object, 'the sale uses a physical object at the market stall');

function setup() {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 540;
  state.world.currentMapId = 'market-quay'; state.player.embodiment = 'laundress_mariya';
  const sellerPosition = { x: 14, y: 12 };
  state.player.position = sellerPosition;
  state.quests[quest.id] = { status: 'open' };
  state.hosts.laundress_mariya.mapId = state.hosts.market_nadezhda.mapId = 'market-quay';
  state.hosts.laundress_mariya.position = { ...sellerPosition };
  state.hosts.market_nadezhda.position = { x: 15, y: 12 };
  state.hosts.laundress_mariya.inventory = state.hosts.laundress_mariya.inventory.filter(item => item !== '접은 린넨');
  state.hosts.laundress_mariya.inventory.push('접은 린넨');
  state.world.livingEventStates.E04 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E04',
    status: 'ACTIVE', stage: 'LINEN_WASHED', startedAtMinute: 420, dayIndex: 0, hostId: 'laundress_mariya',
    itemKo: '접은 린넨', validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance' };
  return state;
}
const base = setup();
assert.equal(objectIsPresent(object, base, [quest]), true, 'the trade surface appears after the scheduled wash');
assert.deepEqual(questChoices(quest, 'laundress_mariya', [], base).map(row => row.action.id),
  ['E04_SELL_FOR_CASH', 'E04_HOLD_LINEN_UNTIL_TOMORROW'], 'barter stays hidden until the stall actually has bread in stock');
const stocked = structuredClone(base); stocked.hosts.market_nadezhda.marketStock['빵 한 묶음'] = 1;
assert.deepEqual(questChoices(quest, 'laundress_mariya', [], stocked).map(row => row.action.id),
  quest.actions.map(action => action.id), 'a stocked stall exposes the barter choice');
const distant = structuredClone(stocked); distant.hosts.market_nadezhda.position = { x: 25, y: 15 };
assert.deepEqual(questChoices(quest, 'laundress_mariya', [], distant).map(row => row.action.id),
  ['E04_HOLD_LINEN_UNTIL_TOMORROW'], 'cash and barter require the buyer to be physically present');
const beforeWash = structuredClone(base); delete beforeWash.world.livingEventStates.E04;
assert.equal(objectIsPresent(object, beforeWash, [quest]), false, 'no trade appears before the linen is washed');

const buyerCash = base.hosts.market_nadezhda.money.amount, washerCash = base.hosts.laundress_mariya.money.amount;
const cashSale = game.performQuestAction(base, { questId: quest.id, hostId: 'laundress_mariya', actionId: 'E04_SELL_FOR_CASH', objectId: object.id }, { quests: [quest], maps });
assert.equal(cashSale.ok, true, `cash sale resolves at close range (${cashSale.reason ?? ''})`);
assert.equal(cashSale.state.hosts.laundress_mariya.money.amount, washerCash + 2);
assert.equal(cashSale.state.hosts.market_nadezhda.money.amount, buyerCash - 2);
assert.ok(!cashSale.state.hosts.laundress_mariya.inventory.includes('접은 린넨'));
assert.equal(cashSale.state.world.livingEventStates.E04.stage, 'LINEN_EXCHANGED');
assert.equal(cashSale.state.world.livingEventStates.E04.playerDecision.disposition, 'SELL_FOR_CASH');
assert.equal(cashSale.state.ledger.at(-1).livingEvents.at(-1).payment, 2);
assert.equal(game.stateHash(game.loadGame(game.saveGame(cashSale.state), { maps, hostCards: cards, quests: [quest] })),
  game.stateHash(cashSale.state), 'cash transfer and event stage persist through save/load');

const barterBase = setup(); barterBase.hosts.market_nadezhda.marketStock['빵 한 묶음'] = 1;
const stockBefore = barterBase.hosts.market_nadezhda.marketStock['빵 한 묶음'];
const barter = game.performQuestAction(barterBase, { questId: quest.id, hostId: 'laundress_mariya', actionId: 'E04_BARTER_FOR_BREAD', objectId: object.id }, { quests: [quest], maps });
assert.equal(barter.ok, true, `barter resolves at close range (${barter.reason ?? ''})`);
assert.equal(barter.state.hosts.market_nadezhda.marketStock['빵 한 묶음'], stockBefore - 1);
assert.ok(barter.state.hosts.laundress_mariya.inventory.includes('빵 한 묶음'));
assert.equal(barter.state.hosts.laundress_mariya.money.amount, washerCash);
assert.equal(barter.state.world.livingEventStates.E04.playerDecision.disposition, 'BARTER_FOR_BREAD');

const holdBase = setup();
const held = game.performQuestAction(holdBase, { questId: quest.id, hostId: 'laundress_mariya', actionId: 'E04_HOLD_LINEN_UNTIL_TOMORROW', objectId: object.id }, { quests: [quest], maps });
assert.equal(held.ok, true, `hold choice resolves without a buyer (${held.reason ?? ''})`);
assert.equal(held.state.world.livingEventStates.E04.stage, 'LINEN_WASHED');
assert.ok(held.state.hosts.laundress_mariya.inventory.includes('접은 린넨'));
assert.equal(held.state.hosts.laundress_mariya.completedSocialTaskDayById?.MARIYA_LINEN_SALE_TO_NADEZHDA_1847, 0,
  'holding skips today’s automatic exchange while preserving tomorrow’s repeat task');
const released = game.releaseHost(held.state, map).state;
const afterRoutine = game.advanceNpcWorld(released, 1, maps);
assert.ok(afterRoutine.hosts.laundress_mariya.inventory.includes('접은 린넨'), 'the held linen is not sold later in the same day');
assert.notEqual(afterRoutine.world.livingEventStates.E04.stage, 'LINEN_EXCHANGED');
assert.equal(game.stateHash(game.loadGame(game.saveGame(afterRoutine), { maps, hostCards: cards, quests: [quest] })),
  game.stateHash(afterRoutine), 'the deferred sale and daily schedule marker survive save/load');
console.log('V37 E04 laundry choice: witnessed wash, buyer-gated cash/barter, held inventory, deferred repeat sale, and save/load passed.');
