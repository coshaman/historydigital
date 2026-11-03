import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const firstSix = ['clerk_alexei', 'printer_ekaterina', 'courier_pavel', 'seamstress_anna', 'tenant_mikhail', 'bookseller_lev'];
const secondSix = ['editor_sofia', 'police_sergeant_ivan', 'reader_darya', 'senior_clerk_konstantin', 'yardkeeper_semyon', 'laundress_mariya'];
const batchTwo = process.argv.includes('--batch-two');
const pilotIds = batchTwo ? secondSix : firstSix;
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const map = await readJson(`../rpg/maps/${file}`);
  return [map.mapId, map];
})));
const cardFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const hostCards = await Promise.all(cardFiles.map(file => readJson(`../rpg/characters/${file}`)));
const questFiles = (await readdir(new URL('../rpg/quests/', import.meta.url))).filter(file => file.endsWith('.json'));
const quests = await Promise.all(questFiles.map(file => readJson(`../rpg/quests/${file}`)));

for (const hostId of pilotIds) {
  const card = hostCards.find(item => item.id === hostId);
  const goal = card.persistentPersonalGoals.find(item => item.kind === 'LIFE');
  assert.equal(goal.autonomyStages.length, 3, `${hostId} should have one autonomous location for each personal arc stage`);
  for (const plan of goal.autonomyStages) {
    const quest = quests.find(item => item.id === plan.questId);
    const marker = maps[plan.mapId]?.layers.find(layer => layer.name === 'Interactions')?.objects.find(item => item.id === quest?.entry?.objectId);
    assert.equal(quest?.entry?.requiredHostId, hostId);
    assert.equal(quest?.lifeChain?.stage, plan.stage);
    assert.deepEqual(plan.position, { x: Math.floor(marker.x / 16), y: Math.floor(marker.y / 16) }, 'goal targets must remain tied to real quest markers');
  }
}

function replay() {
  const initial = game.createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' });
  const final = game.advanceNpcWorld(initial, 600, maps);
  return { initial, final };
}
const first = replay(), second = replay();
assert.equal(game.stateHash(first.final), game.stateHash(second.final), 'first-six life-focus routes must replay deterministically');
const visits = first.final.ledger.flatMap(entry => entry.personalGoalVisits ?? []);
const pilotVisits = visits.filter(visit => pilotIds.includes(visit.hostId));
const byHost = new Map(pilotIds.map(hostId => [hostId, visits.filter(visit => visit.hostId === hostId)]));
const deferred = batchTwo ? new Set(['police_sergeant_ivan', 'reader_darya']) : new Set();
for (const [hostId, hostVisits] of byHost) {
  if (deferred.has(hostId)) {
    assert.equal(hostVisits.length, 0, `${hostId} life arc is not yet historically/prerequisite available`);
    continue;
  }
  assert.ok(hostVisits.length >= 1, `${hostId} should physically reach their active life-arc task during the pilot day`);
  assert.equal(new Set(hostVisits.map(visit => visit.questId)).size, 1, `${hostId} must focus one current stage, not teleport between tasks`);
  assert.ok(hostVisits.every(visit => maps[visit.mapId] && Number.isInteger(visit.position.x) && Number.isInteger(visit.position.y)));
}
assert.deepEqual(first.final.world.lifeChains ?? {}, {}, 'NPC presence at a work marker must never decide the player quest');
assert.ok(Object.values(first.final.quests ?? {}).every(quest => quest.status !== 'resolved'), 'autonomous life-goal visits must not resolve any player quest');
const restored = game.loadGame(game.saveGame(first.final), { maps, hostCards, quests });
assert.equal(game.stateHash(restored), game.stateHash(first.final), 'life-goal visit and hold state must survive save/load');

const progressing = game.createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' });
const hostId = pilotIds[0], lifeGoal = progressing.hosts[hostId].personalGoals.find(item => item.kind === 'LIFE');
progressing.world.lifeChains ??= {};
progressing.world.lifeChains[lifeGoal.successCondition.chainId] = { stage: 1, metrics: {}, history: [{ stage: 1 }] };
progressing.ledger.push({ eventId: 'TEST_STAGE_1_ACTION', eventType: 'HISTORICAL_ACTION', date: progressing.world.date,
  questId: lifeGoal.autonomyStages[0].questId, hostId, actionId: 'TEST_STAGE_1_CHOICE' });
for (const person of Object.values(progressing.hosts)) person.completedSocialTaskIds = person.schedule.flatMap(slot => ['DELIVER', 'EXCHANGE'].includes(slot.task?.type) ? [slot.task.id] : []);
const host = progressing.hosts[hostId];
host.activeGoal = null; host.personalGoalLastVisitKey = null;
const secondStageState = game.advanceNpcWorld(progressing, 600, maps);
assert.ok(secondStageState.ledger.flatMap(entry => entry.personalGoalVisits ?? []).some(visit => visit.hostId === hostId && visit.stage === 2),
  'advancing the resident life chain should retarget autonomy to the next authored stage');

const audit = await readFile(new URL('../rpg/main.js', import.meta.url), 'utf8');
assert.match(audit, /personalGoalVisits \?\? \[\]\)\.filter\(visit => visit\.witnessedByPlayer\)/,
  'the journal must disclose autonomous life-goal work only when the player witnessed it');
const report = { schemaVersion: batchTwo ? 'V36_SECOND_SIX_PERSONAL_GOAL_AUTONOMY_1' : 'V36_FIRST_SIX_PERSONAL_GOAL_AUTONOMY_1', status: 'PASS', pilotResidents: pilotIds.length,
  authoredLifeStagesPerResident: 3, dailyVisits: pilotVisits.length,
  deterministicReplay: true, stageProgressRetargets: true, questAutoCompletion: false, saveLoadParity: true,
  deferredUntilHistoricallyAvailable: [...deferred],
  playerWitnessRequired: true, residentOutcomes: [...byHost].map(([id, rows]) => ({ id, questId: rows[0]?.questId, stage: rows[0]?.stage,
    mapId: rows[0]?.mapId, position: rows[0]?.position, minute: rows[0]?.minute, activityKo: rows[0]?.activityKo,
    witnessedByPlayer: rows[0]?.witnessedByPlayer })) };
await mkdir(new URL('../docs/v36/current-audit/', import.meta.url), { recursive: true });
await writeFile(new URL(`../docs/v36/current-audit/${batchTwo ? 'SECOND' : 'FIRST'}_SIX_PERSONAL_GOAL_AUTONOMY.json`, import.meta.url), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
