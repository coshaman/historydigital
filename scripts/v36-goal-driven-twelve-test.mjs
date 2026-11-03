import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const ids = ['clerk_alexei', 'printer_ekaterina', 'courier_pavel', 'seamstress_anna', 'tenant_mikhail', 'bookseller_lev',
  'editor_sofia', 'police_sergeant_ivan', 'reader_darya', 'senior_clerk_konstantin', 'yardkeeper_semyon', 'laundress_mariya'];
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const map = await readJson(`../rpg/maps/${file}`);
  return [map.mapId, map];
})));
const hostCards = await Promise.all([...ids, 'market_nadezhda'].map(id => readJson(`../rpg/characters/${id}.json`)));
const coreCards = hostCards.filter(card => ids.includes(card.id));

for (const card of coreCards) {
  assert.ok(card.schedule.length >= 4, `${card.id} needs at least four authored daily stops`);
  assert.deepEqual(Object.keys(card.needs ?? {}).filter(key => ['income', 'fatigue', 'safety', 'socialBelonging'].includes(key)).sort(),
    ['fatigue', 'income', 'safety', 'socialBelonging'], `${card.id} needs four authored needs`);
  for (const key of ['income', 'fatigue', 'safety', 'socialBelonging']) assert.ok(card.needs[key] >= 0 && card.needs[key] <= 100, `${card.id}.${key} outside 0–100`);
  for (const slot of card.schedule) assert.ok(maps[slot.mapId], `${card.id} has a schedule in unknown map ${slot.mapId}`);
}
assert.equal(new Set(coreCards.map(card => JSON.stringify(card.needs))).size, ids.length, '12 core residents need distinct needs profiles');

function runDay() {
  let state = game.createInitialState({ maps, hostCards, startMapId: 'nevsky' });
  const initialFatigue = Object.fromEntries(ids.map(id => [id, state.hosts[id].needs.fatigue]));
  const initialPositions = Object.fromEntries(ids.map(id => [id, { mapId: state.hosts[id].mapId, ...state.hosts[id].position }]));
  const initialInventories = Object.fromEntries([...ids, 'market_nadezhda'].map(id => [id, [...state.hosts[id].inventory]]));
  const initialMoney = Object.fromEntries([...ids, 'market_nadezhda'].map(id => [id, state.hosts[id].money.amount]));
  state = game.advanceNpcWorld(state, 600, maps);
  return { state, initialFatigue, initialPositions, initialInventories, initialMoney, events: state.ledger };
}
const first = runDay(), second = runDay();
assert.equal(game.stateHash(first.state), game.stateHash(second.state), '12-resident replay must be deterministic');
let collisionState = game.createInitialState({ maps, hostCards, startMapId: 'nevsky' });
for (let interval = 0; interval < 120; interval += 1) {
  collisionState = game.advanceNpcWorld(collisionState, 5, maps);
  const occupied = new Map();
  for (const id of ids) {
    const host = collisionState.hosts[id], key = `${host.mapId}:${host.position.x},${host.position.y}`;
    assert.ok(!occupied.has(key), `${id} collided with ${occupied.get(key)} at ${key}, interval ${interval}`);
    occupied.set(key, id);
  }
}
const stripLedger = state => { const snapshot = structuredClone(state); snapshot.ledger = []; snapshot.ledgerDigest = ''; snapshot.ledgerDigestCount = 0; return snapshot; };
assert.deepEqual(stripLedger(collisionState), stripLedger(first.state), '5-minute collision-observed replay must match bulk world state');
const goals = first.events.flatMap(event => event.goals ?? []);
const restGoals = goals.filter(goal => goal.type === 'NEED_REST');
const restRecoveries = first.events.flatMap(event => event.restRecoveries ?? []);
const goalTypesByResident = Object.fromEntries(ids.map(id => [id, [...new Set(goals.filter(goal => goal.hostId === id).map(goal => goal.type))]]));
const deliveries = first.events.flatMap(event => event.deliveries ?? []);
const exchanges = first.events.flatMap(event => event.exchanges ?? []);
assert.equal(new Set([...deliveries, ...exchanges].map(item => item.taskId)).size, deliveries.length + exchanges.length,
  'a completed physical social task must not run twice after its scheduled slot has elapsed');
const moves = first.events.flatMap(event => event.moves ?? []);
const handoffs = deliveries.filter(item => item.hostId === 'senior_clerk_konstantin' || item.hostId === 'editor_sofia' || item.hostId === 'yardkeeper_semyon');
const marketTrade = exchanges.filter(item => item.hostId === 'laundress_mariya' && item.recipientHostId === 'market_nadezhda');
const mapTransitions = moves.filter(item => item.viaExit);
const deliveredTaskIds = new Set(deliveries.map(item => item.taskId));
const expectedDeliveries = ['KONSTANTIN_MEMO_TO_ALEXEI_1847', 'PAVEL_DELIVER_SEALED_ENVELOPE_01',
  'SOFIA_SOURCE_NOTE_TO_DARYA_1847', 'SEMYON_WOOD_COUNT_TO_MARIYA_1847'];
assert.ok(restGoals.length > 0, 'the needs system should select at least one real rest goal');
for (const id of new Set(restGoals.map(goal => goal.hostId))) {
  assert.ok(restRecoveries.some(row => row.hostId === id && row.fatigueAfter < row.fatigueBefore), `${id} entered rest without recording fatigue recovery`);
}
for (const taskId of expectedDeliveries) {
  const completed = deliveries.filter(item => item.taskId === taskId);
  assert.equal(completed.length, 1, `${taskId} should finish exactly one physical handoff`);
  const transfer = completed[0], sender = first.state.hosts[transfer.hostId], recipient = first.state.hosts[transfer.recipientHostId];
  assert.equal(first.initialInventories[transfer.hostId].includes(transfer.itemKo), true, `${taskId} needs the item initially`);
  assert.equal(sender.inventory.includes(transfer.itemKo), false, `${taskId} should remove the item from its sender`);
  assert.equal(recipient.inventory.includes(transfer.itemKo), true, `${taskId} should add the item to its recipient`);
  assert.ok(sender.relations[recipient.id] && recipient.relations[sender.id], `${taskId} should establish a reciprocal relation`);
}
assert.equal(marketTrade.length, 1, 'Mariya should make one completed sale to the supporting market counterparty');
assert.equal(first.state.hosts.laundress_mariya.money.amount, first.initialMoney.laundress_mariya + 2, 'sale proceeds should reach Mariya');
assert.equal(first.state.hosts.market_nadezhda.money.amount, first.initialMoney.market_nadezhda - 2, 'sale cost should leave Nadezhda');
assert.equal(first.state.hosts.laundress_mariya.inventory.includes('접은 린넨'), false, 'sold linen should leave Mariya');
assert.equal(first.state.hosts.market_nadezhda.inventory.includes('접은 린넨'), true, 'sold linen should reach Nadezhda');
assert.ok(mapTransitions.length >= 10, 'residents should traverse connected exits between neighborhoods');
for (const [hostId, start] of Object.entries(first.initialPositions)) {
  const path = moves.filter(move => move.hostId === hostId).sort((a, b) => a.minute - b.minute);
  let previous = start;
  for (const step of path) {
    assert.deepEqual({ mapId: step.fromMapId, ...step.from }, previous, `${hostId} movement log must track continuously`);
    if (step.fromMapId === step.toMapId) {
      assert.equal(Math.abs(step.to.x - step.from.x) + Math.abs(step.to.y - step.from.y), 1, `${hostId} must walk tile by tile`);
      assert.equal(step.viaExit, null, `${hostId} same-map step cannot claim a map exit`);
    } else assert.ok(step.viaExit, `${hostId} map transfer needs a named connected exit`);
    previous = { mapId: step.toMapId, ...step.to };
  }
  const final = first.state.hosts[hostId];
  assert.deepEqual({ mapId: final.mapId, ...final.position }, previous, `${hostId} final position must match movement ledger`);
}
assert.deepEqual(first.state.quests, {}, 'autonomous routines must not complete player quests');

const report = { schemaVersion: 'V36_TWELVE_RESIDENT_GOAL_REPLAY_1', status: 'PASS', phase: 'V36_PHASE_2_TWELVE_RESIDENTS',
  deterministicReplays: 2, coreResidents: ids.length, supportCounterparties: ['market_nadezhda'], elapsedMinutes: 600,
  residents: ids.map(id => ({ id, authoredNeeds: coreCards.find(card => card.id === id).needs, initialFatigue: first.initialFatigue[id],
    finalFatigue: first.state.hosts[id].needs.fatigue, finalMapId: first.state.hosts[id].mapId, activeGoal: first.state.hosts[id].activeGoal,
    activity: first.state.hosts[id].currentActivityKo, goalTypes: goalTypesByResident[id] })),
  needDrivenRestResidents: [...new Set(restGoals.map(goal => goal.hostId))].sort(), restRecoveryEvents: restRecoveries.length, deliveries, exchanges, mapTransitions,
  collisionSnapshots: 120, duplicateResidentTiles: 0, observedReplayMatchesBulkWorldState: true,
  movementCount: moves.length, questsResolved: Object.values(first.state.quests).filter(quest => quest.status === 'resolved').length,
  finalStateHash: game.stateHash(first.state) };
await mkdir(new URL('../docs/v36/current-audit/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/v36/current-audit/TWELVE_RESIDENT_GOAL_REPLAY.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ status: report.status, residents: ids.length, elapsedMinutes: 600, movementCount: moves.length,
  needDrivenRestResidents: report.needDrivenRestResidents, deliveries: deliveries.length, exchanges: exchanges.length,
  mapTransitions: mapTransitions.length, collisionSnapshots: report.collisionSnapshots, duplicateResidentTiles: report.duplicateResidentTiles,
  questsResolved: report.questsResolved,
  summary: report.residents.map(({ id, finalMapId, finalFatigue, goalTypes }) => ({ id, finalMapId, finalFatigue, goalTypes })) }, null, 2));
