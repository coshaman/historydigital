import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const districtData = await readJson('../rpg/data/city-districts-v36.json');
const ids = [...new Set(districtData.districts.flatMap(district => district.residentIds ?? []))];
const cards = await Promise.all(ids.map(id => readJson(`../rpg/characters/${id}.json`)));
const maps = Object.fromEntries(await Promise.all((await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`../rpg/maps/${file}`); return [map.mapId, map]; })));
const alexeiCard = cards.find(card => card.id === 'clerk_alexei');
const baseSchedule = { atMinute: 540, mapId: 'nevsky', position: { ...maps?.nevsky?.metadata?.observerStart }, activityKo: '정해 둔 업무를 본다' };

function runScenario(configure = () => {}) {
  const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
  state.world.clockMinutes = 600;
  const host = state.hosts.clerk_alexei;
  for (const person of Object.values(state.hosts)) if (person.id !== host.id) person.schedule = [];
  host.activeGoal = null;
  host.mapId = baseSchedule.mapId;
  host.position = { ...baseSchedule.position };
  host.schedule = [{ ...baseSchedule, position: { ...baseSchedule.position } }];
  host.routineTaskCompletedId = null;
  host.completedSocialTaskIds = [];
  const lifeGoal = host.personalGoals.find(goal => goal.kind === 'LIFE');
  lifeGoal.autonomyStages = [{ stage: 1, questId: 'UTILITY_TEST_LIFE_STAGE_1', date: state.world.date,
    mapId: host.mapId, position: { ...host.position }, activityKo: '장부에 누락된 일을 확인한다',
    prerequisiteQuestIds: [], windowStartMinute: 540, windowEndMinute: 900, focusMinutes: 12 }];
  configure(state, host);
  const pausedHostIds = ids.filter(id => id !== host.id);
  const next = game.advanceNpcWorld(state, 1, maps, { pausedHostIds });
  const goal = next.hosts[host.id].activeGoal;
  assert.ok(goal?.selectionBasis && Number.isFinite(goal.selectionBasis.utilityScore), 'every planner decision records its deterministic utility basis');
  assert.ok(next.ledger.flatMap(entry => entry.goals ?? []).some(event => event.hostId === host.id && event.selectionBasis?.utilityScore === goal.selectionBasis.utilityScore),
    'selected goal and decision evidence are written together to the world ledger');
  return { state: next, goal };
}

const lowerWorkPriority = runScenario((state, host) => {
  host.plannerPolicy.personalPriority = 0.1;
  host.needs.incomePressure = 86;
  host.plannerPolicy.workPriority = 0.1;
});
const higherWorkPriority = runScenario((state, host) => {
  host.plannerPolicy.personalPriority = 0.1;
  host.needs.incomePressure = 86;
  host.plannerPolicy.workPriority = 0.95;
});
assert.equal(lowerWorkPriority.goal.type, 'PERSONAL_LIFE_FOCUS', 'below-threshold livelihood pressure leaves room for an authored personal appointment');
assert.equal(higherWorkPriority.goal.type, 'NEED_INCOME', `the same resident under stronger work priority responds to high income pressure; got ${JSON.stringify(higherWorkPriority.goal)}`);
assert.ok(higherWorkPriority.goal.selectionBasis.utilityScore > lowerWorkPriority.goal.selectionBasis.utilityScore);
const personalAppointment = runScenario((state, host) => { host.plannerPolicy.personalPriority = 0.1; });
assert.equal(personalAppointment.goal.type, 'PERSONAL_LIFE_FOCUS', 'a reachable personal-life appointment can outrank the routine');

const exhausted = runScenario((state, host) => {
  host.needs.fatigue = 100;
  host.needs.restThreshold = 40;
  host.schedule = [
    { ...baseSchedule, position: { ...baseSchedule.position } },
    { atMinute: 600, mapId: baseSchedule.mapId, position: { ...baseSchedule.position }, activityKo: '잠시 쉰다' },
  ];
});
assert.equal(exhausted.goal.type, 'NEED_REST', 'urgent physical fatigue outranks routine and personal appointments');

const hungry = runScenario((state, host) => {
  host.needs.hunger = 100;
  host.inventory.push('시험용 빵');
  host.schedule.push({ atMinute: 600, mapId: baseSchedule.mapId, position: { ...baseSchedule.position }, activityKo: '빵을 먹는다', task: {
    id: 'AUTONOMY_TEST_MEAL', type: 'CONSUME', itemKo: '시험용 빵', minimumHunger: 40, hungerRelief: 30,
  } });
});
assert.equal(hungry.goal.type, 'NEED_MEAL', `a resident with severe hunger chooses an available meal; got ${JSON.stringify(hungry.goal)}`);
assert.equal(hungry.state.hosts.clerk_alexei.needs.hunger, 70, 'the chosen meal has a deterministic in-world need effect');
assert.equal(hungry.state.hosts.clerk_alexei.inventory.includes('시험용 빵'), false, 'the consumed item leaves the resident inventory');

const sociable = runScenario((state, host) => {
  const target = state.hosts.printer_ekaterina;
  target.mapId = host.mapId;
  target.position = { x: host.position.x + 1, y: host.position.y };
  host.needs.socialNeed = 100;
  host.needs.fatigue = 0;
  host.needs.safetyConcern = 0;
  host.plannerPolicy.socialPriority = 1;
  host.plannerPolicy.riskTolerance = 1;
});
assert.equal(sociable.goal.type, 'PERSONAL_RELATIONSHIP', 'social need and a reachable named partner can outrank routine work');
assert.equal(sociable.goal.targetHostId, 'printer_ekaterina');

for (const card of cards) {
  assert.ok(card.todayGoals?.length >= 4, `${card.id} needs at least four authored daily intentions`);
  assert.ok(new Set(card.todayGoals.map(goal => goal.kind)).size >= 3, `${card.id} needs differentiated work, personal, care, and social intentions`);
  assert.ok(card.plannerPolicy && Number.isFinite(card.plannerPolicy.workPriority), `${card.id} needs a deterministic individualized planner policy`);
}

console.log(JSON.stringify({ status: 'PASS', roster: cards.length, authoredDailyIntentions: cards.reduce((sum, card) => sum + card.todayGoals.length, 0),
  utilityDecisions: ['PERSONAL_LIFE_FOCUS', 'NEED_INCOME', 'NEED_REST', 'NEED_MEAL', 'PERSONAL_RELATIONSHIP'],
  policyChangesChoice: true, hungerChangesInventoryAndNeed: true, ledgerRecordsDecisionBasis: true }));
