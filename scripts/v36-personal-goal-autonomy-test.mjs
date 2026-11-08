import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { formatObservedNpcReactions } from '../rpg/engine/world-reaction-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const firstSix = ['clerk_alexei', 'printer_ekaterina', 'courier_pavel', 'seamstress_anna', 'tenant_mikhail', 'bookseller_lev'];
const secondSix = ['editor_sofia', 'police_sergeant_ivan', 'reader_darya', 'senior_clerk_konstantin', 'yardkeeper_semyon', 'laundress_mariya'];
const thirdSix = ['apothecary_yakov', 'baker_fyodor', 'bookbinder_elizaveta', 'carter_roman', 'coachman_timofey', 'fishseller_klavdiya'];
const fourthSix = ['housemaid_olga', 'innkeeper_irina', 'junior_guard_sergey', 'landlady_polina', 'lodging_tatyana', 'midwife_avdotya'];
const fifthSix = ['print_apprentice_stepan', 'scribal_yuri', 'student_vasily', 'minor_noble_andrei', 'street_vendor_matryona', 'typesetter_nikita'];
const sixthSix = ['teacher_lyubov', 'watercarrier_luka', 'servant_varvara', 'porter_gavrila', 'market_nadezhda', 'warehouse_pyotr'];
const batch = process.argv.includes('--batch-six') ? 6 : process.argv.includes('--batch-five') ? 5 : process.argv.includes('--batch-four') ? 4 : process.argv.includes('--batch-three') ? 3 : process.argv.includes('--batch-two') ? 2 : 1;
const pilotIds = [firstSix, secondSix, thirdSix, fourthSix, fifthSix, sixthSix][batch - 1];
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const map = await readJson(`../rpg/maps/${file}`);
  return [map.mapId, map];
})));
const cardFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const hostCards = await Promise.all(cardFiles.map(file => readJson(`../rpg/characters/${file}`)));
const questFiles = (await readdir(new URL('../rpg/quests/', import.meta.url))).filter(file => file.endsWith('.json'));
const individualQuests = await Promise.all(questFiles.map(file => readJson(`../rpg/quests/${file}`)));
const residentArcBundle = await readJson('../rpg/quests/resident-arcs-v36.json');
const quests = [...new Map([...individualQuests, ...residentArcBundle.quests].map(quest => [quest.id, quest])).values()];

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
  let final = initial;
  final = game.advanceNpcWorld(initial, 1460, maps);
  return { initial, final };
}
const first = replay(), second = replay();
assert.equal(game.stateHash(first.final), game.stateHash(second.final), 'first-six life-focus routes must replay deterministically');
const visits = first.final.ledger.flatMap(entry => entry.personalGoalVisits ?? []);
const pilotVisits = visits.filter(visit => pilotIds.includes(visit.hostId));
const autonomousChoices = pilotIds.flatMap(hostId => {
  const host = first.final.hosts[hostId], goal = host.personalGoals.find(item => item.kind === 'LIFE');
  return host.personalGoalProgress[goal.id]?.autonomousHistory ?? [];
});
assert.ok(autonomousChoices.length >= 3, 'multiple residents must make and retain autonomous life choices during the resident-day replay');
const byHost = new Map(pilotIds.map(hostId => [hostId, visits.filter(visit => visit.hostId === hostId)]));
const deferred = batch === 1 ? new Set(['bookseller_lev'])
  : batch === 2 ? new Set(['police_sergeant_ivan', 'reader_darya'])
  : batch === 5 ? new Set(['print_apprentice_stepan', 'student_vasily', 'street_vendor_matryona'])
      : batch === 6 ? new Set(['teacher_lyubov', 'watercarrier_luka', 'servant_varvara', 'warehouse_pyotr']) : new Set();
for (const [hostId, hostVisits] of byHost) {
  if (deferred.has(hostId)) {
    assert.equal(hostVisits.length, 0, `${hostId} is explicitly deferred in this resident-day pilot`);
    if (['street_vendor_matryona', 'servant_varvara', 'warehouse_pyotr'].includes(hostId)) {
      const activeGoal = first.final.hosts[hostId].activeGoal;
      assert.equal(activeGoal?.type, 'PURCHASE_MEAL', `${hostId}'s personal visit is deferred only while resolving an urgent meal need`);
      assert.equal(activeGoal?.reason, 'hunger_requires_affordable_market_food');
    }
    continue;
  }
  const lifeGoal = first.final.hosts[hostId].personalGoals.find(item => item.kind === 'LIFE');
  assert.ok(hostVisits.length >= 1, `${hostId} should physically reach their active life-arc task during the pilot day; goal=${JSON.stringify(first.final.hosts[hostId].activeGoal)} progress=${JSON.stringify(first.final.hosts[hostId].personalGoalProgress[lifeGoal.id])}`);
  const stagesReached = [...new Set(hostVisits.map(visit => visit.stage))].sort((a, b) => a - b);
  assert.ok(stagesReached.every((stage, index) => stage === index + 1), `${hostId} must advance through authored life stages in order`);
  assert.ok(hostVisits.every(visit => maps[visit.mapId] && Number.isInteger(visit.position.x) && Number.isInteger(visit.position.y)));
}
assert.deepEqual(first.final.world.lifeChains ?? {}, {}, "NPC autonomy must not decide the player's life chain");
assert.ok(Object.values(first.final.quests ?? {}).every(quest => quest.status !== 'resolved'), 'autonomous life-goal visits must not resolve any player quest');
const restored = game.loadGame(game.saveGame(first.final), { maps, hostCards, quests });
assert.equal(game.stateHash(restored), game.stateHash(first.final), 'life-goal visit and hold state must survive save/load');

const progressing = game.createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' });
const hostId = firstSix[0], lifeGoal = progressing.hosts[hostId].personalGoals.find(item => item.kind === 'LIFE');
progressing.hosts[hostId].personalGoalProgress[lifeGoal.id].autonomousStage = 1;
const firstStageQuest = quests.find(item => item.id === lifeGoal.autonomyStages[0].questId);
progressing.hosts[hostId].personalGoalProgress[lifeGoal.id].autonomousHistory = [{ stage: 1, questId: firstStageQuest.id,
  actionId: firstStageQuest.actions[0].id, resultFlag: firstStageQuest.actions[0].resultFlag, date: progressing.world.date }];
const resumedQuest = quests.find(item => item.id === lifeGoal.autonomyStages[1].questId);
const resumedMap = maps[resumedQuest.entry.mapId];
const resumedObject = resumedMap.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === resumedQuest.entry.objectId);
const resumedPosition = { x: Math.floor(resumedObject.x / 16), y: Math.floor(resumedObject.y / 16) };
progressing.player.embodiment = hostId;
progressing.world.currentMapId = resumedMap.mapId;
progressing.player.position = { ...resumedPosition };
progressing.hosts[hostId].mapId = resumedMap.mapId;
progressing.hosts[hostId].position = { ...resumedPosition };
const resumedAction = game.performQuestAction(progressing, { questId: resumedQuest.id, hostId,
  actionId: resumedQuest.actions[0].id, objectId: resumedQuest.entry.objectId }, { quests, maps });
assert.equal(resumedAction.ok, true, 'the player should be able to take over an NPC arc at the next stage after the resident has made the prior choice');
progressing.player.embodiment = null;
for (const person of Object.values(progressing.hosts)) person.completedSocialTaskIds = person.schedule.flatMap(slot => ['DELIVER', 'EXCHANGE'].includes(slot.task?.type) ? [slot.task.id] : []);
const host = progressing.hosts[hostId];
host.activeGoal = null; host.personalGoalLastVisitKey = null;
const secondStageState = game.advanceNpcWorld(progressing, 600, maps);
assert.ok(secondStageState.ledger.flatMap(entry => entry.personalGoalVisits ?? []).some(visit => visit.hostId === hostId && visit.stage === 2),
  'advancing the resident autonomy stage should retarget to the next authored task without changing player quest state');
assert.deepEqual(secondStageState.world.lifeChains ?? {}, {}, 'autonomous stage progress stays actor-local');

const journalReactions = formatObservedNpcReactions([{
  eventType: 'NPC_SIMULATION',
  date: '1847-06-01',
  personalGoalVisits: [
    { hostId, activityKo: '목격한 수선 일을 이어갔다', stage: 2, witnessedByPlayer: true },
    { hostId, activityKo: '보지 못한 사적인 만남', stage: 2, witnessedByPlayer: false },
  ],
  personalLifeOutcomes: [
    { hostId, activityKo: '오늘의 선택을 장부에 남겼다', witnessedByPlayer: true },
    { hostId, activityKo: '보지 못한 개인 선택', witnessedByPlayer: false },
  ],
}], hostCards);
assert.ok(journalReactions.some(line => line.includes('목격한 수선 일을 이어갔다')),
  'the journal should surface a witnessed autonomous life-goal action');
assert.ok(journalReactions.some(line => line.includes('오늘의 선택을 장부에 남겼다')),
  'the journal should surface the witnessed outcome of an autonomous life choice');
assert.ok(journalReactions.every(line => !line.includes('보지 못한 사적인 만남')),
  'the journal must disclose autonomous life-goal work only when the player witnessed it');
assert.ok(journalReactions.every(line => !line.includes('보지 못한 개인 선택')),
  'the journal must hide autonomous life choices that the player did not witness');
const report = { schemaVersion: `V36_${['', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH'][batch]}_SIX_PERSONAL_GOAL_AUTONOMY_1`, status: 'PASS', pilotResidents: pilotIds.length,
  authoredLifeStagesPerResident: 3, dailyVisits: pilotVisits.length, autonomousChoices: autonomousChoices.length,
  deterministicReplay: true, stageProgressRetargets: true, questAutoCompletion: false, saveLoadParity: true,
  deferredForPilotDay: [...deferred],
  playerWitnessRequired: true, residentOutcomes: [...byHost].map(([id, rows]) => ({ id, questId: rows[0]?.questId, stage: rows[0]?.stage,
    mapId: rows[0]?.mapId, position: rows[0]?.position, minute: rows[0]?.minute, activityKo: rows[0]?.activityKo,
    witnessedByPlayer: rows[0]?.witnessedByPlayer })) };
await mkdir(new URL('../docs/v36/current-audit/', import.meta.url), { recursive: true });
await writeFile(new URL(`../docs/v36/current-audit/${['', 'FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH'][batch]}_SIX_PERSONAL_GOAL_AUTONOMY.json`, import.meta.url), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
