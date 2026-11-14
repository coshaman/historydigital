import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { v47RoleProfiles } from '../rpg/data/v47-character-roles.mjs';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse);
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const runtime = globalThis.V47MainStories;
const [mapFiles, characterFiles, registry] = await Promise.all([
  (await import('node:fs/promises')).readdir(path.join(root, 'rpg/maps')),
  (await import('node:fs/promises')).readdir(path.join(root, 'rpg/characters')),
  readJson('data/era_character_registry.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(name => name.endsWith('.json')).map(name => readJson(`rpg/maps/${name}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(characterFiles.filter(name => name.endsWith('.json')).map(name => readJson(`rpg/characters/${name}`))),
]);
const hostCards = decorateCardsWithEraProfiles(cards, {
  ...registry, runtime_profiles: { ...registry.runtime_profiles, ...v47RoleProfiles },
});
const quests = [...v47StoryQuests, ...toV47StoryQuests()];
runtime.registerStoryBeats(quests.filter(quest => quest.storyId));

function dateOffset(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function createSeededWorld() {
  const state = game.createInitialState({ maps, hostCards, quests, startMapId: 'market-quay' });
  state.world.chapterId = 'V33_1848_PUBLIC';
  state.world.date = '1848-06-14';
  state.world.clockMinutes = 540;
  state.world.currentMapId = 'market-quay';
  state.world.v47.focusStoryId = 'MAIN05';
  for (const host of Object.values(state.hosts)) {
    if (!host.presenceWindow) continue;
    host.historicalAliveAndPresent = host.presenceWindow.startDate <= state.world.date
      && state.world.date <= host.presenceWindow.endDate;
  }
  return runtime.advanceV47World(state, { date: state.world.date, clockMinutes: state.world.clockMinutes });
}

function traceFor(state, simulatedMinutes) {
  const changes = state.ledger.filter(row => row.eventType === 'NPC_SIMULATION');
  return {
    seed: 'V47_MAIN05_1848-06-14_NO_PLAYER_V1',
    days: 14,
    anchorDate: '1848-06-14',
    elapsedDays: simulatedMinutes / 1440,
    projectedElapsedDate: dateOffset('1848-06-14', simulatedMinutes / 1440),
    activeResidents: Object.values(state.hosts).filter(host => host.historicalAliveAndPresent !== false).length,
    totalResidents: Object.keys(state.hosts).length,
    simulatedMinutes,
    movementRows: changes.reduce((sum, row) => sum + row.moves.length, 0),
    paymentRows: changes.reduce((sum, row) => sum + row.payments.length, 0),
    deliveryRows: changes.reduce((sum, row) => sum + row.deliveries.length, 0),
    worldEvents: Object.keys(state.world.v47.events),
    cholera: {
      status: state.world.v47.cholera.status,
      counters: state.world.v47.cholera.counters,
      waterRisk: state.world.v47.cholera.waterRisk,
      foodRisk: state.world.v47.cholera.foodRisk,
      sourceDeliveries: Object.values(state.world.v47.cholera.waterSources).reduce((sum, source) => sum + source.deliveries, 0),
      interventions: state.world.v47.cholera.interventions.length,
    },
    stateHash: game.stateHash(state),
  };
}

function runNoPlayerFourteenDays(dayCount = 14) {
  let state = createSeededWorld();
  let simulatedMinutes = 0;
  const dailyDiseaseTrace = [];
  const foodTrace = [];
  const startHostPositions = Object.fromEntries(Object.values(state.hosts).map(host => [host.id,
    { mapId: host.mapId, position: { ...host.position } }]));
  for (let day = 0; day < dayCount; day += 1) {
    const firstDayLedgerIndex = state.ledger.length;
    if (process.argv.includes('--food-trace')) {
      for (let interval = 0; interval < 1440; interval += 60) {
        state.world.date = dateOffset('1848-06-14', Math.floor(state.world.clockMinutes / 1440));
        state = game.advanceNpcWorld(state, 60, maps);
        simulatedMinutes += 60;
        const minute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
        foodTrace.push({ day: day + 1, clockMinute: minute,
          sellers: ['fishseller_klavdiya', 'innkeeper_irina', 'market_nadezhda'].map(id => {
            const host = state.hosts[id];
            return { id, mapId: host.mapId, position: host.position, goal: host.activeGoal?.type,
              targetMapId: host.activeGoal?.targetMapId, taskId: host.activeGoal?.taskId,
              stock: host.marketStock, preparedWork: (host.completedWorkActionKeys ?? []).slice(-4),
              offers: (host.marketOffers ?? []).filter(offer => offer.category === 'food').map(offer => ({
                itemKo: offer.itemKo, mapId: offer.mapId, open: isOfferOpenAt(offer, state.world.clockMinutes),
                stock: host.marketStock?.[offer.itemKo] ?? 0 })) };
          }), buyers: Object.values(state.hosts).filter(host => host.historicalAliveAndPresent !== false
            && (host.needs?.hunger ?? 0) >= 70).map(host => ({ id: host.id, hunger: host.needs.hunger,
              mapId: host.mapId, goal: host.activeGoal?.type, seller: host.activeGoal?.targetHostId,
              selectedAtMinute: host.activeGoal?.selectedAtMinute, routine: host.routineState?.state })),
          meals: [...(state.ledger.at(-1)?.meals ?? [])].map(row => ({ hostId: row.hostId, seller: row.sellerHostId,
            kind: row.kind, minute: row.minute })) });
      }
    } else {
      let remainingMinutes = 1440;
      while (remainingMinutes > 0) {
        state.world.date = dateOffset('1848-06-14', Math.floor(state.world.clockMinutes / 1440));
        const minutesToDateBoundary = 1440 - (state.world.clockMinutes % 1440);
        const stepMinutes = Math.min(remainingMinutes, minutesToDateBoundary);
        state = game.advanceNpcWorld(state, stepMinutes, maps);
        simulatedMinutes += stepMinutes;
        remainingMinutes -= stepMinutes;
      }
    }
    assert.equal(state.world.date, dateOffset('1848-06-14', day + 1),
      'the unattended simulation date advances with the absolute world clock');
    dailyDiseaseTrace.push({
      simulatedDate: dateOffset('1848-06-14', day + 1),
      stateDate: state.world.date,
      clockMinutes: state.world.clockMinutes,
      dayIndex: state.world.v47.cholera.dayIndex,
      counts: Object.fromEntries(['S', 'E', 'I', 'R', 'D'].map(code => [code,
        Object.values(state.world.v47.cholera.hosts).filter(patient => patient.state === code).length])),
      counters: structuredClone(state.world.v47.cholera.counters),
      patients: Object.entries(state.world.v47.cholera.hosts).filter(([, patient]) => patient.state !== 'S')
        .map(([hostId, patient]) => ({ hostId, state: patient.state, exposedDays: patient.exposedDays,
          infectiousDays: patient.infectiousDays, aliveAndPresent: state.hosts[hostId]?.historicalAliveAndPresent,
          hostCondition: state.hosts[hostId]?.healthState?.condition ?? 'HEALTHY',
          deathCause: state.hosts[hostId]?.deathRecord?.causeId ?? null })),
      starvationDeaths: Object.values(state.hosts).filter(host => host.deathRecord?.causeId === 'FOOD_DEPRIVATION')
        .map(host => ({ hostId: host.id, hunger: host.needs?.hunger, deprivedMinutes: host.needs?.foodDeprivationMinutes,
          money: host.money?.amount, inventory: (host.inventory ?? []).filter(item => /빵|수프|생선|음식|감자|양배추/.test(item)),
          allowedMaps: host.allowedMaps, healthCondition: host.healthState?.condition,
          mapId: host.mapId, position: host.position, activeGoal: host.activeGoal?.type,
          targetMapId: host.activeGoal?.targetMapId, targetHostId: host.activeGoal?.targetHostId,
          currentActivityKo: host.currentActivityKo, routineState: host.routineState?.state,
          foodOfferMaps: Object.values(state.hosts).flatMap(seller => (seller.marketOffers ?? [])
            .filter(offer => offer.category === 'food').map(offer => ({ sellerId: seller.id, itemKo: offer.itemKo,
              offerMapId: offer.mapId, isOpen: offer.openWindows?.some(window => {
                const localMinute = ((state.world.clockMinutes % 1440) + 1440) % 1440;
                return localMinute >= window.startMinute && localMinute < window.endMinute;
              }) ?? true, stock: seller.marketStock?.[offer.itemKo] ?? 0, sellerMapId: seller.mapId,
              sellerAlive: seller.historicalAliveAndPresent !== false,
              sellerMoneyUnit: seller.money?.unit }))) })),
      meals: (() => {
        const meals = state.ledger.slice(firstDayLedgerIndex)
          .filter(row => row.eventType === 'NPC_SIMULATION')
          .flatMap(row => row.meals ?? []);
        return { count: meals.length, byKind: Object.fromEntries(Object.groupBy(meals, row => row.kind)
          ? Object.entries(Object.groupBy(meals, row => row.kind)).map(([kind, rows]) => [kind, rows.length]) : []),
          bySeller: Object.fromEntries(Object.entries(Object.groupBy(meals.filter(row => row.sellerHostId), row => row.sellerHostId))
            .map(([sellerId, rows]) => [sellerId, rows.length])) };
      })(),
      mealMarket: Object.values(state.hosts).filter(seller => (seller.marketOffers ?? []).some(offer => offer.category === 'food'))
        .map(seller => ({ sellerId: seller.id, alive: seller.historicalAliveAndPresent !== false, mapId: seller.mapId,
          stock: seller.marketStock, servingGoal: seller.activeGoal?.type,
          openFoodOffers: (seller.marketOffers ?? []).filter(offer => offer.category === 'food'
            && isOfferOpenAt(offer, state.world.clockMinutes)).map(offer => ({ itemKo: offer.itemKo, mapId: offer.mapId })) })),
      reservedMealTrips: Object.values(state.hosts).filter(host => host.historicalAliveAndPresent !== false
        && host.activeGoal?.type === 'PURCHASE_MEAL').map(host => ({ hostId: host.id,
          sellerHostId: host.activeGoal.targetHostId, mapId: host.mapId, targetMapId: host.activeGoal.targetMapId,
          position: host.position, targetPosition: state.hosts[host.activeGoal.targetHostId]?.position,
          hunger: host.needs?.hunger, goalSinceMinute: host.activeGoal.selectedAtMinute,
          routineState: host.routineState?.state, route: host.mapRoutePlan,
          plannedPathLength: host.plannedPath?.length ?? null })),
    });
  }
  if (dayCount >= 4 && dayCount < 7) {
    const earlyFoodFatalities = (state.world.deathRecords ?? []).filter(record => record.causeId === 'FOOD_DEPRIVATION');
    assert.equal(earlyFoodFatalities.length, 0,
      `short unattended cholera replay must not kill residents from food deprivation before the seven-day survival window: ${earlyFoodFatalities.map(row => row.hostId).join(', ')}`);
    const finalDay = dailyDiseaseTrace.at(-1);
    assert.ok((finalDay?.meals?.bySeller?.fishseller_klavdiya ?? 0) > 0,
      'the fish seller must complete public sales during the fourth unattended day');
    const fishOffer = finalDay?.mealMarket?.find(seller => seller.sellerId === 'fishseller_klavdiya');
    assert.ok((fishOffer?.stock?.['생선 한 점'] ?? 0) > 0,
      'fish stock must remain available after the fourth day without player intervention');
  }
  if (dayCount >= 14 && !process.argv.includes('--diagnostic')) {
    const foodFatalities = (state.world.deathRecords ?? []).filter(record => record.causeId === 'FOOD_DEPRIVATION');
    assert.equal(foodFatalities.length, 0,
      `unattended two-week replay must not starve residents while affordable food service exists: ${foodFatalities.map(row => row.hostId).join(', ')}`);
  }
  const summary = traceFor(state, simulatedMinutes);
  const moved = Object.values(state.hosts).filter(host => {
    const start = startHostPositions[host.id];
    return start && (host.mapId !== start.mapId || host.position.x !== start.position.x || host.position.y !== start.position.y);
  }).map(host => host.id);
  assert.equal(summary.simulatedMinutes, dayCount * 1440, `the simulation must account for ${dayCount} full days`);
  assert.equal(summary.cholera.status, 'ACTIVE', 'the cholera world system stays active through the window');
  assert.ok(summary.totalResidents >= 36, `world state includes the full resident roster: ${summary.totalResidents}`);
  assert.ok(summary.movementRows > 0 && moved.length > 0, 'NPCs move during the unattended simulation');
  assert.ok(summary.worldEvents.includes('MAIN05_CHOLERA_SCENE_OPEN'), 'the authored cholera scene enters the world');
  assert.ok(summary.cholera.counters.exposures >= 1, 'the scenario has an authored initial exposure');
  return { ...summary, days: dayCount, movedHostIds: moved, dailyDiseaseTrace, ...(foodTrace.length ? { foodTrace } : {}),
    finalDeathRecords: structuredClone(state.world.deathRecords ?? []) };
}

function isOfferOpenAt(offer, absoluteMinute) {
  const minute = ((absoluteMinute % 1440) + 1440) % 1440;
  return offer.openWindows?.some(window => minute >= window.startMinute && minute < window.endMinute) ?? true;
}

const requestedDays = Number(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1]) || 14;
const first = runNoPlayerFourteenDays(requestedDays);
if (process.argv.includes('--diagnostic')) {
  console.log(JSON.stringify({ days: first.dailyDiseaseTrace, ...(first.foodTrace ? { foodTrace: first.foodTrace } : {}), hash: first.stateHash }, null, 2));
  process.exit(0);
}
const second = runNoPlayerFourteenDays(requestedDays);
assert.equal(first.stateHash, second.stateHash, 'same seed and schedule must reproduce the exact final state');
assert.deepEqual(first.movedHostIds, second.movedHostIds, 'same seed must reproduce movement outcomes');
const output = {
  status: 'PASS',
  scope: `${requestedDays} consecutive no-player in-world days in the MAIN05 1848 cholera scene; deterministic duplicate-seed replay`,
  replayA: first,
  replayB: second,
  identicalFinalState: true,
  note: 'This is unattended simulation evidence, not human playtest or 30–60 minute browser playtime measurement.',
};
const outputDir = path.join(root, 'artifacts/v47/14_DAY_SIMULATION');
await mkdir(outputDir, { recursive: true });
const evidenceFilename = requestedDays === 14 ? 'V47_14_DAY_NO_PLAYER_REPLAY.json' : `V47_${requestedDays}_DAY_NO_PLAYER_REPLAY.json`;
await writeFile(path.join(outputDir, evidenceFilename), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ status: output.status, days: first.days, simulatedMinutes: first.simulatedMinutes,
  activeResidents: first.activeResidents, totalResidents: first.totalResidents,
  movementRows: first.movementRows, movedHosts: first.movedHostIds.length,
  cholera: first.cholera, worldEvents: first.worldEvents, deterministic: output.identicalFinalState,
  evidence: `artifacts/v47/14_DAY_SIMULATION/${evidenceFilename}` }, null, 2));
