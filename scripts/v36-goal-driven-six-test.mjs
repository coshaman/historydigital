import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const ids = ['clerk_alexei', 'printer_ekaterina', 'courier_pavel', 'seamstress_anna', 'tenant_mikhail', 'bookseller_lev'];
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const map = await readJson(`../rpg/maps/${file}`);
  return [map.mapId, map];
})));
const hostCards = await Promise.all(ids.map(id => readJson(`../rpg/characters/${id}.json`)));

for (const card of hostCards) {
  assert.equal(card.schedule.length >= 4, true, `${card.id} needs at least four authored daily stops`);
  assert.deepEqual(Object.keys(card.needs).filter(key => ['income', 'fatigue', 'safety', 'socialBelonging'].includes(key)).sort(), ['fatigue', 'income', 'safety', 'socialBelonging']);
  for (const key of ['income', 'fatigue', 'safety', 'socialBelonging']) assert.ok(card.needs[key] >= 0 && card.needs[key] <= 100, `${card.id}.${key} outside 0–100`);
}
assert.equal(new Set(hostCards.map(card => JSON.stringify(card.needs))).size, hostCards.length, 'the first six residents need distinct need profiles');

function runDay() {
  let state = game.createInitialState({ maps, hostCards, startMapId: 'nevsky' });
  state = game.advanceNpcWorld(state, 180, maps);
  for (const id of ['clerk_alexei', 'printer_ekaterina', 'seamstress_anna']) state.hosts[id].needs.fatigue = state.hosts[id].needs.restThreshold + 5;
  const initialFatigue = Object.fromEntries(ids.map(id => [id, state.hosts[id].needs.fatigue]));
  state = game.advanceNpcWorld(state, 300, maps);
  return { state, initialFatigue, events: state.ledger };
}

const first = runDay(), second = runDay();
assert.equal(game.stateHash(first.state), game.stateHash(second.state), 'the six-resident goal replay must be deterministic');
const goals = first.events.flatMap(event => event.goals ?? []);
const restGoals = goals.filter(goal => goal.type === 'NEED_REST');
const restedIds = [...new Set(restGoals.map(goal => goal.hostId))].sort();
assert.deepEqual(restedIds, ['clerk_alexei', 'printer_ekaterina', 'seamstress_anna'], JSON.stringify(ids.map(id=>({id,needs:first.state.hosts[id].needs,goal:first.state.hosts[id].activeGoal,schedule:first.state.hosts[id].scheduleId}))));
for (const id of restedIds) {
  const host = first.state.hosts[id];
  assert.ok(host.needs.fatigue < first.initialFatigue[id], `${id} did not recover fatigue`);
  assert.match(host.currentActivityKo, /쉰다/);
  assert.equal(host.mapId, host.activeGoal.targetMapId);
}
const courierDelivery = first.events.flatMap(event => event.deliveries ?? []).filter(item => item.hostId === 'courier_pavel' && item.recipientHostId === 'printer_ekaterina');
assert.equal(courierDelivery.length, 1, 'the courier should complete the scheduled physical handoff exactly once before the controlled fatigue-recovery scenario');
assert.ok(goals.some(goal => goal.hostId === 'courier_pavel' && goal.type === 'FOLLOW_RECIPIENT'));
assert.ok(first.state.hosts.courier_pavel.relations.printer_ekaterina);
assert.deepEqual(first.state.quests, {}, 'autonomous daily routines must not complete player quests');

const saved = game.saveGame(first.state);
const restored = game.loadGame(saved, { maps, hostCards });
assert.equal(game.stateHash(restored), game.stateHash(first.state), 'need, goal, delivery, and relationship state should survive save/load');
const legacySave = JSON.parse(saved);
for (const host of Object.values(legacySave.state.hosts)) for (const key of ['incomePressure', 'safetyConcern', 'socialNeed', 'restThreshold']) delete host.needs[key];
legacySave.checksum = game.stateHash(legacySave.state);
const migrated = game.loadGame(legacySave, { maps, hostCards });
assert.equal(migrated.hosts.clerk_alexei.needs.incomePressure, hostCards[0].needs.income, 'older same-version saves should gain authored need values');
assert.ok(Number.isFinite(migrated.hosts.printer_ekaterina.needs.restThreshold));

const hostId = 'clerk_alexei', host = restored.hosts[hostId];
restored.world.currentMapId = host.mapId;
restored.player.position = { ...host.position };
const possessed = game.possessHost(restored, hostId, maps[host.mapId]);
assert.equal(possessed.ok, true);
const beforePossessionTick = { position: { ...possessed.state.hosts[hostId].position }, needs: { ...possessed.state.hosts[hostId].needs } };
const paused = game.advanceNpcWorld(possessed.state, 10, maps);
assert.deepEqual(paused.hosts[hostId].position, beforePossessionTick.position, 'the player-controlled resident must not run an autonomous route');
assert.deepEqual(paused.hosts[hostId].needs, beforePossessionTick.needs, 'the player-controlled resident needs must not drift autonomously');
const released = game.releaseHost(paused, maps[host.mapId]);
assert.equal(released.ok, true);
const resumed = game.advanceNpcWorld(released.state, 1, maps);
assert.notEqual(resumed.hosts[hostId].activeGoal.type, 'POSSESSED', 'released resident should resume their authored routine');

const report = { schemaVersion: 'V36_FIRST_SIX_GOAL_REPLAY_1', status: 'PASS', phase: 'V36_PHASE_2_FIRST_SIX', deterministicReplays: 2,
  residents: ids.map(id => ({ id, authoredNeeds: hostCards.find(card => card.id === id).needs, initialFatigue: first.initialFatigue[id], finalFatigue: first.state.hosts[id].needs.fatigue,
    finalMapId: first.state.hosts[id].mapId, activeGoal: first.state.hosts[id].activeGoal, currentActivityKo: first.state.hosts[id].currentActivityKo })),
  elapsedMinutes: 480, needDrivenRestResidents: restedIds, needGoalEvents: restGoals, physicalCourierHandoffs: courierDelivery,
  possessionPausedAutonomy: true, releaseResumedAutonomy: true, saveReloadParity: true, legacyNeedMigration: true,
  autonomousQuestCompletions: Object.values(first.state.quests).filter(quest => quest.status === 'resolved').length,
  finalStateHash: game.stateHash(first.state) };
await mkdir(new URL('../docs/v36/current-audit/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/v36/current-audit/FIRST_SIX_GOAL_REPLAY.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ status: report.status, phase: report.phase, residents: ids.length, deterministicReplayMinutes: report.elapsedMinutes,
  distinctNeedProfiles: hostCards.length, needDrivenRestResidents: restedIds, physicalCourierHandoffs: courierDelivery.length,
  possessionPausesAutonomy: true, releaseResumesAutonomy: true, saveReloadParity: true, legacyNeedMigration: true }, null, 2));
