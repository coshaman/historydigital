import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles, quest, catalog] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  readJson(new URL('../rpg/quests/charity-day-1847.json', import.meta.url)),
  readJson(new URL('../data/event_catalog_45.json', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(name => name.endsWith('.json')).map(name => readJson(new URL(`../rpg/maps/${name}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(name => name.endsWith('.json')).map(name => readJson(new URL(`../rpg/characters/${name}`, import.meta.url)))),
]);
assert.equal(catalog.find(row => row.event_id === 'E14').validation_status, 'DESIGN_SEED_NOT_VERIFIED');
assert.equal(new Date('1847-06-06T00:00:00Z').getUTCDay(), 0, 'test date is Sunday');
const venue = maps['market-quay'];
const object = venue.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(object, 'the relief choice is attached to the physical market-side ledger');

function initial(date, stock) {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
  state.world.chapterId = 'V33_1847_PRINT';
  state.world.date = date;
  state.world.clockMinutes = 719;
  state.hosts.market_nadezhda.marketStock['빵 한 묶음'] = stock;
  state.hosts.tenant_mikhail.needs.hunger = 84;
  return state;
}
const warmday = initial('1847-06-07', 2);
assert.equal(game.advanceNpcWorld(warmday, 1, maps).world.livingEventStates.E14, undefined,
  'the set date, not chance, controls the charity-day trigger');
const noStock = initial('1847-06-06', 0);
noStock.hosts.baker_fyodor.schedule = [];
assert.equal(game.advanceNpcWorld(noStock, 1, maps).world.livingEventStates.E14, undefined,
  'a relief queue cannot open without food physically available at the market');
const triggered = game.advanceNpcWorld(initial('1847-06-06', 2), 1, maps);
const event = triggered.world.livingEventStates.E14;
assert.equal(event?.status, 'ACTIVE');
assert.equal(event.stage, 'RELIEF_ANNOUNCED');
assert.deepEqual(event.actorHostIds, ['yardkeeper_semyon', 'market_nadezhda', 'tenant_mikhail']);
assert.equal(event.venueBasis, 'FICTIONAL_MARKET_RELIEF_RECONSTRUCTION');
assert.equal(objectIsPresent(object, triggered, [quest]), true, 'the event ledger appears only after the real stock-and-hunger trigger');
assert.deepEqual(questChoices(quest, 'tenant_mikhail', [], triggered), [], 'choices remain hidden until all three participants arrive');
assert.ok(triggered.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E14'
  && row.stage === 'RELIEF_ANNOUNCED' && row.validationStatus === 'DESIGN_SEED_NOT_VERIFIED'));
const converged = game.advanceNpcWorld(triggered, 330, maps);
assert.equal(converged.world.livingEventStates.E14.stage, 'RELIEF_LINE_FORMS',
  `participants should physically converge before the six-hour window closes: ${JSON.stringify(actorIdsForTest(converged))}; goals=${JSON.stringify(Object.fromEntries(['yardkeeper_semyon','market_nadezhda','tenant_mikhail'].map(id=>[id,{goal:converged.hosts[id].activeGoal,route:converged.hosts[id].mapRoutePlan}])))}`);
assert.ok(converged.ledger.flatMap(row => row.moves ?? []).some(move => move.hostId === 'market_nadezhda'
  && move.toMapId === 'market-quay'), 'the seller must physically approach the relief queue from her scheduled route');

const actorIds = ['yardkeeper_semyon', 'market_nadezhda', 'tenant_mikhail'];
const scene = event.scenePosition;
const positions = [{ x: scene.x, y: scene.y }, { x: scene.x - 1, y: scene.y }, { x: scene.x, y: scene.y - 1 }];
const actions = [
  { id: 'E14_BUY_FOR_SELF', hostId: 'tenant_mikhail', payer: 'tenant_mikhail', paid: true, stage: 'RATION_PURCHASED' },
  { id: 'E14_ORGANIZER_SPONSORS', hostId: 'yardkeeper_semyon', payer: 'yardkeeper_semyon', paid: true, stage: 'RATION_SPONSORED' },
  { id: 'E14_VENDOR_DONATES', hostId: 'market_nadezhda', payer: null, paid: false, stage: 'RATION_DONATED' },
  { id: 'E14_DECLINE_AID', hostId: 'tenant_mikhail', payer: null, paid: false, stage: 'AID_DECLINED' },
];
for (const choice of actions) {
  const branch = structuredClone(triggered);
  actorIds.forEach((id, index) => { branch.hosts[id].mapId = 'market-quay'; branch.hosts[id].position = positions[index]; });
  branch.world.currentMapId = 'market-quay';
  branch.player.embodiment = choice.hostId;
  branch.player.position = { ...branch.hosts[choice.hostId].position };
  const ready = game.advanceNpcWorld(branch, 1, maps, { pausedHostIds: actorIds });
  assert.equal(ready.world.livingEventStates.E14.stage, 'RELIEF_LINE_FORMS');
  const visibleChoices = questChoices(quest, choice.hostId, [], ready).map(row => row.action.id);
  assert.ok(visibleChoices.includes(choice.id), `${choice.id} is visible only to its actor after the line forms`);
  const stockBefore = ready.hosts.market_nadezhda.marketStock['빵 한 묶음'];
  const moneyBefore = Object.fromEntries(actorIds.map(id => [id, ready.hosts[id].money.amount]));
  const hungerBefore = ready.hosts.tenant_mikhail.needs.hunger;
  const result = game.performQuestAction(ready, { questId: quest.id, hostId: choice.hostId,
    actionId: choice.id, objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${choice.id} resolves at the relief table (${result.reason ?? ''})`);
  const resolved = result.state.world.livingEventStates.E14;
  assert.equal(resolved.status, 'RESOLVED');
  assert.equal(resolved.stage, choice.stage);
  assert.equal(result.state.hosts.market_nadezhda.marketStock['빵 한 묶음'], stockBefore - Number(choice.stage !== 'AID_DECLINED'));
  if (choice.stage !== 'AID_DECLINED') {
    assert.ok(result.state.hosts.tenant_mikhail.inventory.includes('빵 한 묶음'));
    assert.ok(result.state.hosts.tenant_mikhail.needs.hunger < hungerBefore - 25, 'the delivered bread relieves hunger');
  } else assert.equal(result.state.hosts.tenant_mikhail.needs.hunger, hungerBefore);
  if (choice.paid) {
    assert.equal(result.state.hosts[choice.payer].money.amount, moneyBefore[choice.payer] - 1);
    assert.equal(result.state.hosts.market_nadezhda.money.amount, moneyBefore.market_nadezhda + 1);
  } else assert.equal(result.state.hosts.market_nadezhda.money.amount, moneyBefore.market_nadezhda);
  assert.ok(result.state.ledger.at(-1).livingEvents.some(row => row.catalogEventId === 'E14' && row.stage === choice.stage));
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.equal(restored.world.livingEventStates.E14.stage, choice.stage, 'the chosen transaction survives save/load');
  assert.deepEqual(restored.hosts.market_nadezhda.marketStock, result.state.hosts.market_nadezhda.marketStock);
}

const unattended = structuredClone(triggered);
actorIds.forEach((id, index) => { unattended.hosts[id].mapId = 'market-quay'; unattended.hosts[id].position = positions[index]; });
unattended.world.currentMapId = 'market-quay';
const unattendedResult = game.advanceNpcWorld(unattended, 361, maps, { pausedHostIds: actorIds });
assert.equal(unattendedResult.world.livingEventStates.E14.stage, 'AUTO_SPONSORED');
assert.equal(unattendedResult.world.livingEventStates.E14.status, 'RESOLVED');
assert.ok(unattendedResult.hosts.tenant_mikhail.needs.hunger < unattended.hosts.tenant_mikhail.needs.hunger - 25,
  'the autonomous shared-kitchen transaction feeds the waiting resident');
assert.ok(unattendedResult.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E14' && row.stage === 'AUTO_SPONSORED'));

const refusedAid = structuredClone(converged);
actorIds.forEach((id, index) => { refusedAid.hosts[id].mapId = 'market-quay'; refusedAid.hosts[id].position = positions[index]; });
refusedAid.world.currentMapId = 'market-quay';
refusedAid.player.embodiment = 'tenant_mikhail';
refusedAid.player.position = { ...refusedAid.hosts.tenant_mikhail.position };
const hungerBeforeRefusal = refusedAid.hosts.tenant_mikhail.needs.hunger;
const refusal = game.performQuestAction(refusedAid, { questId: quest.id, hostId: 'tenant_mikhail',
  actionId: 'E14_DECLINE_AID', objectId: object.id }, { quests: [quest], maps });
assert.equal(refusal.ok, true, `the resident can refuse the physical ration (${refusal.reason ?? ''})`);
assert.equal(refusal.state.hosts.tenant_mikhail.needs.hunger, hungerBeforeRefusal,
  'declining the relief ration leaves the resident hungry');
refusal.state.player.embodiment = null;
const laterThatEvening = game.advanceNpcWorld(refusal.state, 329, maps);
const mealAfterRefusal = laterThatEvening.ledger.flatMap(row => row.meals ?? []).find(row => row.hostId === 'tenant_mikhail');
assert.ok(mealAfterRefusal, 'the resident autonomously finds and buys food instead of carrying the hunger through the evening');
assert.equal(mealAfterRefusal.sourceEventId, 'E14', 'the food transaction records the relief refusal that led to it');
assert.ok(laterThatEvening.hosts.tenant_mikhail.needs.hunger < 80, 'the later meal prevents his hunger from remaining at a critical level');
const mealRestored = game.loadGame(game.saveGame(laterThatEvening), { maps, hostCards: cards, quests: [quest] });
assert.equal(game.stateHash(mealRestored), game.stateHash(laterThatEvening), 'the causal meal outcome survives save/load');
console.log(JSON.stringify({ status: 'PASS', trigger: 'Sunday + hungry tenant + market bread stock',
  actors: actorIds, actions: actions.map(row => row.id), unattended: 'AUTO_SPONSORED', saveLoad: true,
  historicStatus: event.validationStatus, venue: 'fictional market relief table' }, null, 2));

function actorIdsForTest(state) {
  return Object.fromEntries(['yardkeeper_semyon', 'market_nadezhda', 'tenant_mikhail'].map(id => [id,
    { mapId: state.hosts[id].mapId, position: state.hosts[id].position }]));
}
