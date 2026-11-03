import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd(), readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const [districts, mapFiles, cardFiles, questFiles] = await Promise.all(['rpg/data/city-districts-v36.json', 'rpg/maps', 'rpg/characters', 'rpg/quests']
  .map(async value => value.includes('.json') ? readJson(value) : readdir(path.join(root, value))));
const maps = Object.fromEntries(await Promise.all(mapFiles.filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const cards = await Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => readJson(`rpg/characters/${file}`)));
const quests = (await Promise.all(questFiles.filter(file => file.endsWith('.json')).map(file => readJson(`rpg/quests/${file}`))))
  .filter(quest => quest.historicalOutcome?.id);
const residentIds = [...new Set(districts.districts.flatMap(district => district.residentIds ?? []))];
assert.equal(residentIds.length, 36);
const cityCards = await Promise.all(residentIds.map(id => readJson(`rpg/characters/${id}.json`)));
const needKeys = ['hunger', 'fatigue', 'income', 'safety', 'socialBelonging', 'restThreshold', 'hungerPerMinute', 'workFatiguePerMinute', 'restFatigueReliefPerMinute', 'incomeReliefPerMinute'];
assert.equal(new Set(cityCards.map(card => JSON.stringify(needKeys.map(key => card.needs?.[key])))).size, residentIds.length,
  'every active resident must have a distinct authored needs and recovery profile');
assert.equal(new Set(cityCards.map(card => JSON.stringify([card.plannerPolicy?.riskTolerance, card.plannerPolicy?.workPriority,
  card.plannerPolicy?.socialPriority, card.plannerPolicy?.deterministicSeed]))).size, residentIds.length,
  'every active resident must have a distinct deterministic planner policy');
assert.ok(cityCards.every(card => card.needsProfileStatus === 'FICTIONAL_GAMEPLAY_BALANCE' && card.plannerPolicyStatus === 'FICTIONAL_GAMEPLAY_BALANCE'),
  'invented needs and planner values must not be presented as historical statistics');

function replay(incomePressure) {
  const state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
  for (const id of residentIds) {
    const needs = state.hosts[id].needs;
    needs.hunger = 0; needs.fatigue = 0; needs.socialNeed = 0; needs.incomePressure = incomePressure;
  }
  return game.advanceNpcWorld(state, 5, maps);
}

const initialForLedger = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
const initialMoneyTotal = Object.values(initialForLedger.hosts).reduce((sum, host) => sum + (host.money?.amount ?? 0), 0);
const urgent = replay(95), ordinary = replay(0);
const mixedPressure = replay(56);
const urgentGoals = residentIds.filter(id => ['NEED_INCOME', 'FOLLOW_RECIPIENT', 'FOLLOW_TRADE_PARTNER'].includes(urgent.hosts[id].activeGoal?.type));
const explicitIncomeGoals = residentIds.filter(id => urgent.hosts[id].activeGoal?.type === 'NEED_INCOME');
const personalLifeGoals = residentIds.filter(id => urgent.hosts[id].activeGoal?.type === 'PERSONAL_LIFE_FOCUS');
const personalLifePreparations = residentIds.filter(id => urgent.hosts[id].activeGoal?.type === 'PERSONAL_LIFE_PREPARATION');
const ordinaryGoals = residentIds.filter(id => ordinary.hosts[id].activeGoal?.type === 'NEED_INCOME');
assert.equal(urgentGoals.length, 26, `residents with no higher-priority personal-life, preparation, or scheduled social goal should select livelihood work; deferred=${residentIds.filter(id => !urgentGoals.includes(id)).map(id => `${id}:${urgent.hosts[id].activeGoal?.type}:${urgent.hosts[id].activeGoal?.reason}`).join(',')}`);
assert.equal(explicitIncomeGoals.length, 23, 'income pressure selects livelihood work after preserving personal-life, route preparation, and imminent social goals');
assert.equal(personalLifeGoals.length, 3, 'active personal-life arcs retain priority over livelihood work when their next physical stage is available');
assert.equal(personalLifePreparations.length, 1, 'a resident approaching a later life-arc window should prepare a reachable route before the work window opens');
assert.deepEqual(ordinaryGoals, [], 'low income pressure should leave livelihood choices to the authored schedule');
const mixedIncomeGoals = residentIds.filter(id => mixedPressure.hosts[id].activeGoal?.type === 'NEED_INCOME');
const mixedDeferredResidents = residentIds.filter(id => ['SCHEDULE', 'PERSONAL_LIFE_FOCUS'].includes(mixedPressure.hosts[id].activeGoal?.type));
assert.ok(mixedIncomeGoals.length > 0 && mixedDeferredResidents.length > 0,
  `resident work priorities should change decisions at the same income pressure; income=${mixedIncomeGoals.length}, deferred=${mixedDeferredResidents.length}`);
assert.ok(mixedIncomeGoals.every(id => mixedPressure.hosts[id].activeGoal.selectionBasis?.need === 56
  && mixedPressure.hosts[id].activeGoal.selectionBasis?.threshold <= 56
  && mixedPressure.hosts[id].activeGoal.selectionBasis?.workPriority === mixedPressure.hosts[id].plannerPolicy.workPriority),
  'selected livelihood goals must expose the resident-specific threshold that caused the decision');
assert.ok(explicitIncomeGoals.every(id => urgent.hosts[id].activeGoal.targetMapId && urgent.hosts[id].activeGoal.taskId.startsWith(`LIVELIHOOD:${id}:`)));
assert.deepEqual(urgent.quests, ordinary.quests, 'autonomous livelihood planning cannot resolve player quests');
for (const state of [urgent, ordinary]) assert.equal(Object.values(state.hosts).reduce((sum, host) => sum + (host.money?.amount ?? 0), 0), initialMoneyTotal,
  'goal selection itself cannot mint or destroy money');
const report = { schemaVersion: 'V36_INCOME_PRESSURE_GOAL_REPLAY_1', status: 'PASS', activeResidents: residentIds.length,
  highPressure: { incomePressure: 95, residentsChoosingLivelihoodGoal: urgentGoals.length, explicitIncomeGoals: explicitIncomeGoals.length,
    residentsDeferredToPreserveHigherPriorityPersonalOrScheduledGoals: residentIds.length - urgentGoals.length,
    residentsChoosingPersonalLifeArc: personalLifeGoals.length,
    residentsPreparingPersonalLifeArc: personalLifePreparations.length,
    goals: Object.fromEntries(urgentGoals.map(id => [id, { goalType: urgent.hosts[id].activeGoal.type, targetMapId: urgent.hosts[id].activeGoal.targetMapId, activityKo: urgent.hosts[id].currentActivityKo }])) },
  lowPressure: { incomePressure: 0, residentsChoosingLivelihoodGoal: ordinaryGoals.length },
  individualizedPressure: { incomePressure: 56, residentsChoosingLivelihoodGoal: mixedIncomeGoals.length, residentsDeferredToOtherGoal: mixedDeferredResidents.length,
    selectedThresholds: Object.fromEntries(mixedIncomeGoals.map(id => [id, mixedPressure.hosts[id].activeGoal.selectionBasis])) },
  autonomousQuestCompletions: 0, cashCreationOrLoss: false, elapsedMinutes: 5 };
await mkdir(path.join(root, 'docs/v36/current-audit'), { recursive: true });
await writeFile(path.join(root, 'docs/v36/current-audit/INCOME_PRESSURE_GOAL_REPLAY.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, residents: report.activeResidents, highPressureGoalCount: urgentGoals.length,
  lowPressureGoalCount: ordinaryGoals.length, individualizedPressureGoalCount: mixedIncomeGoals.length,
  distinctNeedsProfiles: new Set(cityCards.map(card => JSON.stringify(needKeys.map(key => card.needs[key])))).size,
  distinctPlannerPolicies: new Set(cityCards.map(card => JSON.stringify([card.plannerPolicy.riskTolerance, card.plannerPolicy.workPriority, card.plannerPolicy.socialPriority, card.plannerPolicy.deterministicSeed]))).size,
  autonomousQuestCompletions: 0, cashCreationOrLoss: false }));
