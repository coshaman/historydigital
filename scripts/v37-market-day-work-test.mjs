import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapNames, cardNames, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)),
  readdir(new URL('../rpg/characters/', import.meta.url)),
  json(new URL('../rpg/quests/market-day-work-1847.json', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapNames.filter(name => name.endsWith('.json')).map(name => json(new URL(`../rpg/maps/${name}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardNames.filter(name => name.endsWith('.json')).map(name => json(new URL(`../rpg/characters/${name}`, import.meta.url)))),
]);

function setup() {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
  state.world.chapterId = 'V33_1847_PRINT';
  state.world.date = '1847-06-01';
  state.world.clockMinutes = 539;
  state.world.currentMapId = 'market-quay';
  state.player.position = { x: 15, y: 13 };
  for (const host of Object.values(state.hosts)) host.historicalAliveAndPresent = false;
  const worker = state.hosts.tenant_mikhail, employer = state.hosts.market_nadezhda;
  for (const [host, x] of [[worker, 14], [employer, 16]]) {
    host.historicalAliveAndPresent = true;
    host.mapId = 'market-quay'; host.position = { x, y: 12 };
    host.schedule = [{ atMinute: 0, mapId: 'market-quay', position: { ...host.position }, activityKo: '잠시 멈춰 있다' }];
    host.activeGoal = null;
  }
  worker.money.amount = 9;
  return state;
}

function openOffer(state) {
  const opened = game.advanceNpcWorld(state, 1, maps);
  assert.equal(opened.world.livingEventStates.E32?.stage, 'OFFER_READY', 'E32 opens and gathers the two residents for the market morning');
  const eventRows = opened.ledger.flatMap(row => row.livingEvents ?? []).filter(row => row.catalogEventId === 'E32');
  assert.ok(eventRows.some(row => row.stage === 'JOB_SEARCH_OPENED') && eventRows.some(row => row.stage === 'OFFER_READY'), 'opening and gathering are separately recorded');
  const gathered = game.advanceNpcWorld(opened, 5, maps);
  assert.equal(gathered.world.livingEventStates.E32?.stage, 'OFFER_READY', 'both residents travel to the physical market work notice');
  return gathered;
}

function choose(state, hostId, actionId) {
  state.player.embodiment = hostId;
  return game.performQuestAction(state, { questId: quest.id, hostId, actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
}

const heavy = openOffer(setup());
const cashBefore = heavy.hosts.market_nadezhda.money.amount;
const workerCashBefore = heavy.hosts.tenant_mikhail.money.amount;
const heavyResult = choose(heavy, 'market_nadezhda', 'E32_HIRE_HEAVY_LOADING');
assert.equal(heavyResult.ok, true, `heavy work should resolve: ${heavyResult.reason ?? ''}`);
assert.equal(heavyResult.state.hosts.market_nadezhda.money.amount, cashBefore - 2);
assert.equal(heavyResult.state.hosts.tenant_mikhail.money.amount, workerCashBefore + 2);
assert.equal(heavyResult.state.hosts.tenant_mikhail.needs.fatigue, heavy.hosts.tenant_mikhail.needs.fatigue + 18);
assert.equal(heavyResult.state.world.livingEventStates.E32.stage, 'HEAVY_LOADING_PAID');
assert.equal(heavyResult.state.world.livingEventStates.E32.workMinutes, 60);
const resumed = game.loadGame(game.saveGame(heavyResult.state), { maps, hostCards: cards, quests: [quest] });
assert.deepEqual(resumed.world.livingEventStates.E32, heavyResult.state.world.livingEventStates.E32, 'paid work persists through save/load');

const traveling = setup();
const traveler = traveling.hosts.tenant_mikhail;
traveler.mapId = 'courtyard'; traveler.position = { x: 20, y: 13 };
traveler.schedule = [{ atMinute: 0, mapId: 'courtyard', position: { ...traveler.position }, activityKo: '안뜰에서 쉰다' }];
const travelStarted = game.advanceNpcWorld(traveling, 1, maps);
assert.equal(travelStarted.world.livingEventStates.E32.status, 'ACTIVE');
const travelProgress = game.advanceNpcWorld(travelStarted, 180, maps);
assert.equal(travelProgress.hosts.tenant_mikhail.mapId, 'market-quay', 'worker reaches the market by autonomous route');
assert.equal(travelProgress.world.livingEventStates.E32.stage, 'OFFER_READY');

const light = openOffer(setup());
const lightResult = choose(light, 'market_nadezhda', 'E32_HIRE_LIGHT_SORTING');
assert.equal(lightResult.ok, true, `light work should resolve: ${lightResult.reason ?? ''}`);
assert.equal(lightResult.state.hosts.tenant_mikhail.money.amount, 10);
assert.equal(lightResult.state.hosts.tenant_mikhail.needs.fatigue, light.hosts.tenant_mikhail.needs.fatigue + 7);
assert.equal(lightResult.state.world.livingEventStates.E32.stage, 'LIGHT_SORTING_PAID');

const referral = openOffer(setup());
const referralResult = choose(referral, 'market_nadezhda', 'E32_REFER_PRINTSHOP');
assert.equal(referralResult.ok, true, `referral should resolve: ${referralResult.reason ?? ''}`);
assert.equal(referralResult.state.world.livingEventStates.E32.referredEmployerHostId, 'carter_roman');
assert.match(referralResult.state.hosts.carter_roman.relations.tenant_mikhail, /소개받아/);

const declined = openOffer(setup());
const declinedCash = declined.hosts.tenant_mikhail.money.amount;
const declinedResult = choose(declined, 'tenant_mikhail', 'E32_LEAVE_WITHOUT_WORK');
assert.equal(declinedResult.ok, true, `worker can refuse the offer: ${declinedResult.reason ?? ''}`);
assert.equal(declinedResult.state.hosts.tenant_mikhail.money.amount, declinedCash);
assert.equal(declinedResult.state.world.livingEventStates.E32.stage, 'WORK_DECLINED');

const unattended = openOffer(setup());
const closed = game.advanceNpcWorld(unattended, 120, maps);
assert.equal(closed.world.livingEventStates.E32.status, 'RESOLVED');
assert.equal(closed.world.livingEventStates.E32.stage, 'NO_WORK_FOUND');
assert.equal(closed.hosts.tenant_mikhail.money.amount, 9, 'missed offer pays no invented wage');
const unattendedReload = game.loadGame(game.saveGame(closed), { maps, hostCards: cards, quests: [quest] });
assert.equal(unattendedReload.world.livingEventStates.E32.resolutionActionId, 'AUTO_OFFER_WINDOW_CLOSED');

console.log('V37 E32 market day work: conditional trigger, autonomous travel, physical role choices, wage/fatigue effects, referral, unattended outcome, and save/load passed');
