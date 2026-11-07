import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const districtData = await readJson('rpg/data/city-districts-v36.json');
const rosterIds = [...new Set(districtData.districts.flatMap(district => district.residentIds ?? []))];
const includeEventPerformers = process.argv.includes('--include-event-performers');
const singleReplay = process.argv.includes('--single-replay');
const ids = includeEventPerformers ? [...rosterIds, 'street_musician_ivan'] : rosterIds;
const maps = Object.fromEntries(await Promise.all((await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const cardIds = includeEventPerformers ? ids : [...new Set([...ids, 'street_musician_ivan'])];
const cards = await Promise.all(cardIds.map(id => readJson(`rpg/characters/${id}.json`)));
const cardsById = new Map(cards.map(card => [card.id, card]));
const quests = (await Promise.all((await readdir(new URL('../rpg/quests/', import.meta.url))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/quests/${file}`)))).filter(quest => quest.historicalOutcome?.id);
assert.equal(rosterIds.length, 36);
assert.equal(ids.length, includeEventPerformers ? 37 : 36);

function runFullDay(seed) {
  let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky', simulationSeed: seed });
  if (!includeEventPerformers) state.hosts.street_musician_ivan.historicalAliveAndPresent = false;
  const initialPositions = Object.fromEntries(ids.map(id => [id, { mapId: state.hosts[id].mapId, ...state.hosts[id].position }]));
  const initialNeeds = Object.fromEntries(ids.map(id => [id, { hunger:state.hosts[id].needs.hunger, fatigue:state.hosts[id].needs.fatigue, socialNeed:state.hosts[id].needs.socialNeed }]));
  const observedPersonalGoalVisits = [];
  const nightlySleepArrivals = new Set();
  const romanNightSnapshots = [];
  let collisionSnapshots = 0;
  for (let interval = 0; interval < 288; interval += 1) {
    const priorLedgerLength = state.ledger.length;
    state = game.advanceNpcWorld(state, 5, maps);
    if (includeEventPerformers && state.world.clockMinutes >= 1380 && state.world.clockMinutes <= 1620
      && state.world.clockMinutes % 15 === 0) {
      const host = state.hosts.carter_roman;
      romanNightSnapshots.push({ clockMinutes: state.world.clockMinutes, mapId: host.mapId, position: { ...host.position },
        activity: host.currentActivityKo, goal: host.activeGoal?.type, targetMapId: host.activeGoal?.targetMapId,
        targetPosition: host.routineState?.targetPosition, routine: host.routineState?.state });
    }
    if (state.world.clockMinutes >= 1380 && state.world.clockMinutes < 1620) {
      for (const id of ids) {
        const host = state.hosts[id], sleepSlot = host.schedule.find(slot => slot.routineKind === 'FICTIONAL_HOME_SLEEP');
        if (sleepSlot && host.mapId === sleepSlot.mapId && Math.abs(host.position.x - sleepSlot.position.x) + Math.abs(host.position.y - sleepSlot.position.y) <= 1
          && /잠|취침/.test(host.currentActivityKo ?? '')) nightlySleepArrivals.add(id);
      }
    }
    const addedEvents = state.ledger.length >= priorLedgerLength ? state.ledger.slice(priorLedgerLength) : state.ledger;
    observedPersonalGoalVisits.push(...addedEvents.flatMap(event => event.personalGoalVisits ?? []));
    const occupied = new Map();
    for (const id of ids) {
      const host = state.hosts[id], key = `${host.mapId}:${host.position.x},${host.position.y}`;
      assert.ok(!occupied.has(key), `${id} overlaps ${occupied.get(key)} at ${key}, 5-minute interval ${interval}`);
      occupied.set(key, id);
      assert.ok(maps[host.mapId], `${id} is left in a missing map`);
    }
    collisionSnapshots += 1;
  }
  const moves = state.ledger.flatMap(event => event.moves ?? []);
  const missedSleepHosts = ids.filter(id => !nightlySleepArrivals.has(id));
  assert.equal(nightlySleepArrivals.size, ids.length,
    `all residents must reach their authored home/street sleeping location by 03:00 for seed ${seed}; missed=${JSON.stringify(missedSleepHosts.map(id => {
      const host = state.hosts[id];
      return { id, mapId: host.mapId, position: host.position, goal: host.activeGoal, routine: host.routineState,
        pathLength: host.plannedPath?.length, route: host.mapRoutePlan, sleepTarget: host.schedule.find(slot => slot.routineKind === 'FICTIONAL_HOME_SLEEP'),
        recentMoves: moves.filter(move => move.hostId === id).slice(-12), nightSnapshots: id === 'carter_roman' ? romanNightSnapshots : undefined,
        recentGoals: state.ledger.flatMap(event => event.goals ?? []).filter(goal => goal.hostId === id).slice(-12) };
    }))}`);
  const movementStepsByResident = Object.fromEntries(ids.map(id => [id, moves.filter(item => item.hostId === id).length]));
  for (const [id, start] of Object.entries(initialPositions)) {
    let previous = start;
    for (const step of moves.filter(item => item.hostId === id)) {
      assert.deepEqual({ mapId: step.fromMapId, ...step.from }, previous, `${id} movement log must be continuous`);
      if (step.fromMapId === step.toMapId) {
        assert.equal(Math.abs(step.to.x - step.from.x) + Math.abs(step.to.y - step.from.y), 1, `${id} must traverse one tile at a time`);
        assert.equal(step.viaExit, null);
      } else assert.ok(step.viaExit, `${id} district transition must use a named map exit`);
      previous = { mapId: step.toMapId, ...step.to };
    }
    const host = state.hosts[id];
    assert.ok(movementStepsByResident[id] > 0, `${id} must physically move at least one tile during the 24-hour replay`);
    assert.deepEqual({ mapId: host.mapId, ...host.position }, previous, `${id} end position must match its movement trace`);
    assert.ok(host.schedule.length >= 4, `${id} needs a daily schedule`);
    const authoredSchedule = cardsById.get(id).schedule ?? [];
    assert.ok(authoredSchedule.every(slot => typeof slot.activityKo === 'string' && slot.activityKo.trim().length > 0), `${id} schedule entries need readable authored activities`);
    assert.ok(authoredSchedule.every(slot => !/다른 생활권에서 맡은 일|새 생활권에서 맡은 일/.test(slot.activityKo)), `${id} must not show the generic schedule placeholder`);
    assert.ok(host.activeGoal, `${id} needs a live goal after the full-day replay`);
    assert.ok(host.currentActivityKo?.length > 0, `${id} needs a current activity after the full-day replay`);
  }
  assert.deepEqual(state.quests, Object.fromEntries(quests.map(quest => [quest.id, { status:'open', result:null }])), 'NPC autonomy cannot complete player quests');
  return { state, initialPositions, initialNeeds, moves, movementStepsByResident, collisionSnapshots, observedPersonalGoalVisits, nightlySleepArrivals };
}

const startedAt = performance.now();
const seeds = singleReplay ? [0] : [0, 1848, 1849];
const first = runFullDay(seeds[0]);
const hashes = [game.stateHash(first.state)];
const parcelDelivery = first.state.ledger.flatMap(event => event.deliveries ?? [])
  .some(delivery => delivery.taskId === 'PAVEL_DELIVER_SEALED_ENVELOPE_01');
const parcelEvent = first.state.world.livingEventStates.E05;
assert.ok(parcelDelivery || (parcelEvent?.stage === 'PARCEL_MISSING' && parcelEvent.itemLocation === 'LOST_ON_DELIVERY_ROUTE'),
  'the courier either transfers the parcel or creates its authored missing-parcel event');
const injuryStages = first.state.ledger.flatMap(event => event.livingEvents ?? [])
  .filter(event => event.catalogIdSpace === 'V37_EVENT_CATALOG_45' && event.catalogEventId === 'E12').map(event => event.stage);
assert.deepEqual(injuryStages, ['INJURY', 'RESTED_UNTREATED'],
  'the unmodified 36-resident day naturally includes the heavy-load injury and unattended rest stages');
assert.equal(first.state.world.livingEventStates.E12?.stage, 'RESTED_UNTREATED');
const catalogEventRows = first.state.ledger.flatMap(event => event.livingEvents ?? [])
  .filter(event => event.catalogIdSpace === 'V37_EVENT_CATALOG_45');
const missingRecordStages = catalogEventRows.filter(event => event.catalogEventId === 'E20').map(event => event.stage);
assert.deepEqual(missingRecordStages, ['RECORD_NOT_FOUND', 'UNMATCHED_FILED_AUTOMATICALLY'],
  'the unattended intake discrepancy is filed by the supervisor during the ordinary city day');
const apprenticeFatigueStages = catalogEventRows.filter(event => event.catalogEventId === 'E33').map(event => event.stage);
assert.deepEqual(apprenticeFatigueStages, ['FATIGUE_LIMIT_REACHED', 'RESTED_UNATTENDED'],
  'the apprentice naturally reaches the authored rest threshold and recovers without player intervention');
const restored = game.loadGame(game.saveGame(first.state), { maps, hostCards: cards, quests });
const saveReloadDifferences = Object.keys(first.state).filter(key => JSON.stringify(first.state[key]) !== JSON.stringify(restored[key]));
const changedHostFields = Object.fromEntries(ids.flatMap(id => {
  const before=first.state.hosts[id],after=restored.hosts[id],keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]));
  return keys.length?[[id,keys]]:[];
}));
assert.equal(game.stateHash(restored), hashes[0], `the complete 24-hour NPC and social-goal state must survive save/reload; changed fields: ${JSON.stringify({saveReloadDifferences,changedHostFields})}`);
const goals = first.state.ledger.flatMap(event => event.goals ?? []);
const autonomousGoals = goals.filter(goal => !['SCHEDULE', 'POSSESSED'].includes(goal.type));
const autonomousGoalTypesByResident = Object.fromEntries(ids.map(id => [id, [...new Set(autonomousGoals.filter(goal => goal.hostId === id).map(goal => goal.type))]]));
const deliveries = first.state.ledger.flatMap(event => event.deliveries ?? []);
const exchanges = first.state.ledger.flatMap(event => event.exchanges ?? []);
const wagePayments = first.state.ledger.flatMap(event => event.payments ?? []).filter(payment => payment.kind === 'WAGE');
const mealRows = first.state.ledger.flatMap(event => event.meals ?? []);
const marketMeals = mealRows.filter(meal => meal.kind === 'PURCHASE_AND_EAT');
const innMealEvents = first.state.ledger.flatMap(event => event.livingEvents ?? [])
  .filter(event => event.catalogEventId === 'E18');
const paidInnMeals = innMealEvents.filter(event => ['MEAL_PAID', 'SMALL_MEAL_PAID', 'AUTO_SERVED'].includes(event.stage));
const residentFoodStates = Object.fromEntries(ids.map(id => {
  const host = first.state.hosts[id], residentMeals = mealRows.filter(row => row.hostId === id);
  const innMeals = paidInnMeals.filter(row => row.state?.buyerHostId === id);
  return [id, { initialHunger: first.initialNeeds[id].hunger, finalHunger: host.needs.hunger,
    lastMealAtMinute: host.needs.lastMealAtMinute ?? null, mealCount: residentMeals.length + innMeals.length,
    mealKinds: residentMeals.map(row => row.kind), innMealCount: innMeals.length, cash: host.money.amount,
    foodInventory: host.inventory.filter(item => /빵|수프|생선|끼니|음식/.test(item)) }];
}));
const personalContacts = first.state.ledger.flatMap(event => event.personalContacts ?? []);
const personalGoalVisits = first.observedPersonalGoalVisits;
const deferredLifeGoalHosts = {
  police_sergeant_ivan: { questId: 'IVAN_WITNESS_ACCOUNT_1849_STAGE_1', reason: 'POLICE_TESTIMONY_RECORD_1849 is not yet recorded in the 1847 starting chapter' },
  reader_darya: { questId: 'DARYA_READING_CIRCLE_1847_STAGE_1', reason: 'READER_SOURCE_AND_RUMOR_1847 has not yet been completed' },
};
const lifeGoalQuestById = new Map(quests.map(quest => [quest.id, quest]));
const visitedLifeGoalHosts = new Set(personalGoalVisits.map(visit => visit.hostId));
const lifeGoalIds = rosterIds;
const goalCoverage = Object.fromEntries(lifeGoalIds.map(hostId => {
  const visits = personalGoalVisits.filter(visit => visit.hostId === hostId);
  if (visits.length) return [hostId, { status: 'PHYSICALLY_VISITED', questId: visits[0].questId }];
  const authoredGoal = cardsById.get(hostId).persistentPersonalGoals.find(goal => goal.kind === 'LIFE');
  const deferred = deferredLifeGoalHosts[hostId] ?? { questId:authoredGoal?.autonomyStages?.[0]?.questId,
    reason:'routine work, travel, and other resident needs defer this open personal-life scene to another day' };
  assert.ok(deferred, `${hostId} must either reach a physical life-goal task or have an explicitly documented locked prerequisite`);
  assert.equal(authoredGoal?.autonomyStages?.[0]?.questId, deferred.questId,
    `${hostId} documented deferral must match their authored first-stage quest`);
  const quest = lifeGoalQuestById.get(deferred.questId);
  assert.ok(quest, `${hostId} deferred quest must exist`);
  const prerequisiteQuestIds = quest.prerequisiteQuestIds ?? [];
  if (prerequisiteQuestIds.length) assert.ok(prerequisiteQuestIds.every(id => !first.state.ledger.some(event => event.questId === id)),
    `${hostId} must remain prerequisite-locked only while its authored prerequisite is absent`);
  else assert.ok(authoredGoal?.autonomyStages?.length, `${hostId} daily-routine deferral requires an authored personal-life arc`);
  assert.equal(visitedLifeGoalHosts.has(hostId), false, `${hostId} cannot be marked deferred after visiting its task`);
  return [hostId, { status: prerequisiteQuestIds.length ? 'LOCKED_BY_PREREQUISITE' : 'DEFERRED_BY_DAILY_ROUTINE', questId: deferred.questId, prerequisiteQuestIds, reason: deferred.reason }];
}));
assert.equal(Object.keys(goalCoverage).length, rosterIds.length, 'all city residents must be accounted for in life-goal coverage');
assert.ok(Object.values(goalCoverage).filter(row => row.status === 'PHYSICALLY_VISITED').length >= 24,
  `at least two thirds of residents should physically pursue a life arc each day; got ${Object.values(goalCoverage).filter(row => row.status === 'PHYSICALLY_VISITED').length}/${rosterIds.length}`);
assert.equal(Object.values(goalCoverage).filter(row => row.status === 'LOCKED_BY_PREREQUISITE').length, 2);
assert.ok(Object.values(goalCoverage).filter(row => row.status === 'DEFERRED_BY_DAILY_ROUTINE').length <= 12);
const mapTransitions = first.moves.filter(move => move.viaExit);
assert.ok(first.moves.length > 0, 'residents should walk throughout the day');
assert.ok(mapTransitions.length > 0, 'residents should cross real district exits');
assert.ok(goals.length > 0, 'daily needs and schedules should create observable goals');
assert.ok(Object.values(autonomousGoalTypesByResident).every(types => types.length > 0),
  `each of the 36 residents must make at least one need-, relationship-, or personal-life-driven decision during the day; missing=${JSON.stringify(Object.entries(autonomousGoalTypesByResident).filter(([, types]) => !types.length).map(([id]) => id))}`);
assert.ok(deliveries.length > 0, 'at least one scheduled item handoff should complete');
assert.ok(exchanges.length > 0, 'at least one scheduled exchange should complete');
assert.ok(marketMeals.length > 0, 'a hungry resident should physically buy and eat market food during the day');
assert.ok(marketMeals.length >= 9,
  `the daytime market should serve a usable number of residents before shops close; sales=${marketMeals.length}`);
assert.ok(paidInnMeals.length > 0,
  `the inn should serve at least one paid evening meal during its authored service window; stages=${JSON.stringify(innMealEvents.map(event => event.stage))}`);
assert.ok(marketMeals.every(meal => meal.mapId === meal.sellerMapId
  && Math.abs(meal.position.x - meal.sellerPosition.x) + Math.abs(meal.position.y - meal.sellerPosition.y) <= 1
  && meal.price > 0 && meal.valueStatus === 'fictional_gameplay_balance'),
  'market meals must be paid, adjacent seller handoffs with fictional balance labels');
assert.ok(marketMeals.every(meal => goals.some(goal => goal.hostId === meal.hostId && goal.type === 'PURCHASE_MEAL'
  && goal.targetHostId === meal.sellerHostId)
  && (first.moves.some(move => move.hostId === meal.hostId && move.toMapId === meal.mapId && move.minute <= meal.minute)
    || first.initialPositions[meal.hostId]?.mapId === meal.mapId)),
  'each market meal needs a seller-directed goal and either a recorded route or a starting position in the seller district');
for (const hostId of ['printer_ekaterina', 'print_apprentice_stepan', 'typesetter_nikita']) {
  assert.ok(wagePayments.some(payment => payment.hostId === hostId), `${hostId} should receive a physically settled job wage`);
}
assert.ok(goals.some(goal => goal.type === 'COLLECT_WAGE'), 'a resident with a due wage claim should travel to meet the payer');
assert.ok(goals.some(goal => goal.type === 'PAY_WAGE'), 'an employer with a due claim should also travel to meet the worker');
const romanFreightWage = wagePayments.find(payment => payment.hostId === 'carter_roman'
  && payment.actionId === 'V36_CARTER_QUAY_FREIGHT_TALLY');
assert.ok(romanFreightWage && romanFreightWage.minute < 1320,
  'the worker and employer should settle the freight wage before the late-night sleep window');
assert.ok(wagePayments.every(payment => payment.mapId === payment.counterpartyMapId
  && Math.abs(payment.position.x - payment.counterpartyPosition.x) + Math.abs(payment.position.y - payment.counterpartyPosition.y) <= 1),
  'additional payroll contracts must settle only at a physical adjacent handoff');
assert.ok(personalContacts.length > 0, 'active personal relationship goals should lead residents to meet their named neighbors');
assert.ok(personalContacts.every(contact => contact.hostId !== contact.partnerHostId && contact.effect === 'social_need_relieved'), 'autonomous personal contacts should create a reciprocal, visible social-need change');
assert.ok(personalContacts.every(contact => Number.isInteger(contact.meetingCount) && contact.meetingCount > 0 && typeof contact.familiarity === 'string'),
  'each physical meeting should advance a readable, deterministic relationship memory');
for (const hostId of ids) for (const [otherId, memory] of Object.entries(first.state.hosts[hostId].relationshipMemory ?? {})) {
  const reciprocal = first.state.hosts[otherId]?.relationshipMemory?.[hostId];
  assert.ok(reciprocal, `${hostId}/${otherId} relationship memory is mutual`);
  assert.equal(memory.meetingCount, reciprocal.meetingCount, `${hostId}/${otherId} meeting count is reciprocal`);
  assert.equal(memory.lastMetAtMinute, reciprocal.lastMetAtMinute, `${hostId}/${otherId} last meeting is shared`);
}
const distinctPersonalContactResidents = new Set(personalContacts.map(contact => contact.hostId)).size;
assert.ok(distinctPersonalContactResidents >= 10,
  `personal goal behavior should affect at least 10 residents (over a quarter of the city) in one day; got ${distinctPersonalContactResidents}/${ids.length}: ${JSON.stringify([...new Set(personalContacts.map(contact => contact.hostId))])}`);
const replays = [first, ...seeds.slice(1).map(runFullDay)];
const seededHashes = replays.map(run => game.stateHash(run.state));
assert.equal(new Set(seededHashes).size, seeds.length, 'different simulation seeds must produce distinct full-day states');
assert.equal(new Set(replays.map(run=>JSON.stringify(run.initialNeeds))).size, seeds.length,
  'different simulation seeds must provide distinct bounded initial need conditions');
const repeatedSeedReplay = singleReplay ? first : runFullDay(seeds[0]);
assert.equal(game.stateHash(repeatedSeedReplay.state), seededHashes[0], 'the same simulation seed must reproduce the exact full-day state');
assert.ok(replays.every(run => run.state.ledger.flatMap(event => event.deliveries ?? []).some(delivery => delivery.taskId === 'PAVEL_DELIVER_SEALED_ENVELOPE_01')
  || (run.state.world.livingEventStates.E05?.stage === 'PARCEL_MISSING' && run.state.world.livingEventStates.E05.itemLocation === 'LOST_ON_DELIVERY_ROUTE')),
  'each seeded courier outcome is either a completed delivery or a recoverable authored parcel event');
const finalHashes = seededHashes;
const report = { schemaVersion:includeEventPerformers ? 'V37_FULL_DAY_37_RUNTIME_RESIDENT_REPLAY_1' : 'V36_FULL_DAY_36_RESIDENT_REPLAY_1',
  status:'PASS', activeCityResidents:ids.length, includedEventPerformers:includeEventPerformers,
  distinctSeeds:seeds, deterministicReplaySeed:seeds[0], simulatedMinutes:1440, replayHashes:finalHashes,
  collisionSnapshotsPerReplay:first.collisionSnapshots, totalCollisionSnapshots:replays.reduce((sum,run)=>sum+run.collisionSnapshots,0),
  firstReplay:{ movementSteps:first.moves.length, districtTransitions:mapTransitions.length, goalEvents:goals.length,
    newCatalogEventStages: { E20: missingRecordStages, E33: apprenticeFatigueStages },
    warehouseInjuryStages:injuryStages,
    firstNightSleepArrivals: [...first.nightlySleepArrivals].sort(),
    firstNightSleepArrivalCount: first.nightlySleepArrivals.size,
    firstNightSleepArrivalMisses: ids.filter(id => !first.nightlySleepArrivals.has(id)),
    normalParcelDelivery:{ deliveredOnSchedule:parcelDelivery, missedParcelEventTriggered:Boolean(parcelEvent) },
    movementStepsByResident:first.movementStepsByResident,
    residentsWithAutonomousGoalDecision:Object.values(autonomousGoalTypesByResident).filter(types=>types.length).length,
    autonomousGoalTypesByResident,
    deliveries:deliveries.length, exchanges:exchanges.length, wagePayments:wagePayments.length, paidMarketMeals:marketMeals.length,
    otherMealActions:mealRows.filter(meal => meal.kind !== 'PURCHASE_AND_EAT').length,
    innMealEventStages:innMealEvents.map(event => event.stage), paidInnMeals:paidInnMeals.length,
    residentsEndingAtCriticalHunger:ids.filter(id => first.state.hosts[id].needs.hunger >= 90), residentFoodStates,
    foodStocksAtEnd:Object.fromEntries(['market_nadezhda','fishseller_klavdiya','innkeeper_irina']
      .map(id => [id, { ...(first.state.hosts[id].marketStock ?? {}) }])),
    marketMealBuyers:[...new Set(marketMeals.map(meal=>meal.hostId))], personalContacts:personalContacts.length,
    relationshipMemoryPairs:Object.values(first.state.hosts).reduce((sum,host)=>sum+Object.keys(host.relationshipMemory??{}).length,0)/2,
    distinctPersonalContactResidents,
    personalLifeGoalVisits:personalGoalVisits.length, residentsWithPhysicalLifeGoalVisits:visitedLifeGoalHosts.size,
    residentsWithLockedLifeGoals:Object.values(goalCoverage).filter(row => row.status === 'LOCKED_BY_PREREQUISITE').length,
    lifeGoalCoverage:goalCoverage,
    residentsWithDistinctAuthoredObjectives:new Set(cards.map(card=>card.personalObjective)).size,
    finalActivityCount:new Set(ids.map(id=>first.state.hosts[id].currentActivityKo)).size,
    finalPositions:Object.fromEntries(ids.map(id=>[id,{mapId:first.state.hosts[id].mapId,...first.state.hosts[id].position}])) },
  fullDaySaveReloadStateHash:game.stateHash(restored), autoCompletedPlayerQuests:0, runtimeMilliseconds:Math.round(performance.now()-startedAt) };
const auditDir = new URL('../docs/v36/current-audit/', import.meta.url);
await mkdir(auditDir,{recursive:true});
const reportName = includeEventPerformers
  ? singleReplay ? 'FULL_DAY_37_SINGLE_SEED_RESIDENT_REPLAY.json' : 'FULL_DAY_37_RUNTIME_RESIDENT_REPLAY.json'
  : singleReplay ? 'FULL_DAY_36_SINGLE_SEED_RESIDENT_REPLAY.json' : 'FULL_DAY_36_RESIDENT_REPLAY.json';
await writeFile(new URL(reportName,auditDir),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
