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
const urgentGoals = residentIds.filter(id => ['NEED_INCOME', 'FOLLOW_RECIPIENT', 'FOLLOW_TRADE_PARTNER'].includes(urgent.hosts[id].activeGoal?.type));
const explicitIncomeGoals = residentIds.filter(id => urgent.hosts[id].activeGoal?.type === 'NEED_INCOME');
const ordinaryGoals = residentIds.filter(id => ordinary.hosts[id].activeGoal?.type === 'NEED_INCOME');
assert.equal(urgentGoals.length, 30, `residents outside pending physical delivery/trade routes should select livelihood work; deferred=${residentIds.filter(id => !urgentGoals.includes(id)).join(',')}`);
assert.equal(explicitIncomeGoals.length, 27, 'income pressure should select livelihood goals after preserving pending physical delivery/trade goals');
assert.deepEqual(ordinaryGoals, [], 'low income pressure should leave livelihood choices to the authored schedule');
assert.ok(explicitIncomeGoals.every(id => urgent.hosts[id].activeGoal.targetMapId && urgent.hosts[id].activeGoal.taskId.startsWith(`LIVELIHOOD:${id}:`)));
assert.deepEqual(urgent.quests, ordinary.quests, 'autonomous livelihood planning cannot resolve player quests');
for (const state of [urgent, ordinary]) assert.equal(Object.values(state.hosts).reduce((sum, host) => sum + (host.money?.amount ?? 0), 0), initialMoneyTotal,
  'goal selection itself cannot mint or destroy money');
const report = { schemaVersion: 'V36_INCOME_PRESSURE_GOAL_REPLAY_1', status: 'PASS', activeResidents: residentIds.length,
  highPressure: { incomePressure: 95, residentsChoosingLivelihoodGoal: urgentGoals.length, explicitIncomeGoals: explicitIncomeGoals.length,
    residentsDeferredToPreserveImminentDeliveryOrTrade: residentIds.length - urgentGoals.length,
    goals: Object.fromEntries(urgentGoals.map(id => [id, { goalType: urgent.hosts[id].activeGoal.type, targetMapId: urgent.hosts[id].activeGoal.targetMapId, activityKo: urgent.hosts[id].currentActivityKo }])) },
  lowPressure: { incomePressure: 0, residentsChoosingLivelihoodGoal: ordinaryGoals.length },
  autonomousQuestCompletions: 0, cashCreationOrLoss: false, elapsedMinutes: 5 };
await mkdir(path.join(root, 'docs/v36/current-audit'), { recursive: true });
await writeFile(path.join(root, 'docs/v36/current-audit/INCOME_PRESSURE_GOAL_REPLAY.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, residents: report.activeResidents, highPressureGoalCount: urgentGoals.length,
  lowPressureGoalCount: ordinaryGoals.length, autonomousQuestCompletions: 0, cashCreationOrLoss: false }));
