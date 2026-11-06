import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { formatObservedNpcReactions } from '../rpg/engine/world-reaction-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const eventCatalog = await json('../data/event_catalog_45.json');
const rentSeed = eventCatalog.find(event => event.event_id === 'E01');
assert.equal(rentSeed?.validation_status, 'DESIGN_SEED_NOT_VERIFIED', 'the linked rent scenario remains a reconstruction seed');
const breadSeed = eventCatalog.find(event => event.event_id === 'E02');
assert.equal(breadSeed?.validation_status, 'DESIGN_SEED_NOT_VERIFIED', 'the linked bread scenario remains a reconstruction seed');
assert.equal(breadSeed?.trigger, 'bread_stockout', 'the catalog trigger must match the deterministic runtime price-change cause');
const fareSeed = eventCatalog.find(event => event.event_id === 'E10');
assert.equal(fareSeed?.validation_status, 'DESIGN_SEED_NOT_VERIFIED', 'the carriage event remains a reconstruction seed');
const injurySeed = eventCatalog.find(event => event.event_id === 'E12');
assert.equal(injurySeed?.validation_status, 'DESIGN_SEED_NOT_VERIFIED', 'the injury event remains a reconstruction seed');
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const cardFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.map(async file => json(`../rpg/maps/${file}`))).then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.map(file => json(`../rpg/characters/${file}`))),
]);
const coachFareQuest = await json('../rpg/quests/coach-fare-1847.json');
const injuryQuest = await json('../rpg/quests/warehouse-injury-1847.json');
const coachFareStart = game.createInitialState({ maps, hostCards: cards, quests: [coachFareQuest], startMapId: 'market-quay' });
coachFareStart.hosts.coachman_timofey.position = { x: 25, y: 14 };
coachFareStart.player.position = { ...coachFareStart.hosts.coachman_timofey.position };
const embodiedCoach = game.possessHost(coachFareStart, 'coachman_timofey', maps['market-quay']);
assert.equal(embodiedCoach.ok, true);
const fareChoice = game.performQuestAction(embodiedCoach.state, {
  questId: coachFareQuest.id, hostId: 'coachman_timofey', actionId: 'COACHMAN_TIMOFEY_CHOICE_2', objectId: coachFareQuest.entry.objectId,
}, { quests: [coachFareQuest], maps });
assert.equal(fareChoice.ok, true, `the fare decision is made at the actual in-world fare board (${fareChoice.reason ?? 'unknown reason'})`);
const fareEvent = fareChoice.state.world.livingEventStates.E10;
assert.equal(fareEvent.catalogIdSpace, 'V37_EVENT_CATALOG_45');
assert.equal(fareEvent.stage, 'FARE_ACCEPTED_WITH_RISK_DISCLOSED');
assert.equal(fareEvent.witnessedByPlayer, true);
assert.equal(fareChoice.state.ledger.at(-1).livingEvents[0].actionId, 'COACHMAN_TIMOFEY_CHOICE_2');
const fareReloaded = game.loadGame(game.saveGame(fareChoice.state), { maps, hostCards: cards });
assert.equal(game.stateHash(fareReloaded), game.stateHash(fareChoice.state), 'the carriage choice and visible event record survive save/load');
const injuryObject = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === injuryQuest.entry.objectId);
const injuryStart = game.createInitialState({ maps, hostCards: cards, quests: [injuryQuest], startMapId: 'market-quay' });
assert.equal(objectIsPresent(injuryObject, injuryStart, [injuryQuest]), false, 'the injury scene is not visible before its physical trigger');
let naturalInjury = game.advanceNpcWorld(injuryStart, 60, maps);
for (let elapsed = 0; elapsed < 120 && naturalInjury.world.livingEventStates.E12?.status !== 'ACTIVE'; elapsed += 5) {
  naturalInjury = game.advanceNpcWorld(naturalInjury, 5, maps);
}
assert.equal(naturalInjury.world.livingEventStates.E12?.status, 'ACTIVE', 'heavy scheduled work can trigger the injury without a player choice');
assert.equal(naturalInjury.hosts.porter_gavrila.healthState.condition, 'INJURED');
assert.equal(naturalInjury.world.livingEventStates.E12.workActionId, 'V37_PORTER_UNLOAD_HEAVY_SACK', 'the authored heavy-load task actually begins under the default autonomous schedule');
assert.equal(naturalInjury.hosts.porter_gavrila.workActionProgress?.['0:V37_PORTER_UNLOAD_HEAVY_SACK'], undefined);
assert.equal(objectIsPresent(injuryObject, naturalInjury, [injuryQuest]), true, 'the physical incident appears when it happens');
naturalInjury.hosts.midwife_avdotya.mapId = 'market-quay';
naturalInjury.hosts.midwife_avdotya.position = { ...naturalInjury.hosts.porter_gavrila.position, x: naturalInjury.hosts.porter_gavrila.position.x - 1 };
const untreatedInjury = game.advanceNpcWorld(structuredClone(naturalInjury), 35, maps);
assert.equal(untreatedInjury.world.livingEventStates.E12.stage, 'RESTED_UNTREATED', 'the world continues into rest without player intervention');
assert.equal(untreatedInjury.hosts.porter_gavrila.healthState.condition, 'RECOVERING');
assert.equal(untreatedInjury.world.livingEventStates.E12.cargo.status, 'LEFT_AT_WORKSITE');
const injuryPossession = game.possessHost({ ...naturalInjury, player: { ...naturalInjury.player, position: { ...naturalInjury.hosts.porter_gavrila.position } } },
  'porter_gavrila', maps['market-quay']);
assert.equal(injuryPossession.ok, true);
const treatedInjury = game.performQuestAction(injuryPossession.state, { questId: injuryQuest.id, hostId: 'porter_gavrila',
  actionId: 'GAVRILA_INJURY_MIDWIFE_CARE', objectId: injuryQuest.entry.objectId }, { quests: [injuryQuest], maps });
assert.equal(treatedInjury.ok, true, `the embodied porter can accept nearby midwife care (${treatedInjury.reason ?? 'unknown reason'})`);
assert.equal(treatedInjury.state.world.livingEventStates.E12.stage, 'TREATED');
assert.equal(treatedInjury.state.hosts.porter_gavrila.healthState.condition, 'RECOVERING');
assert.equal(treatedInjury.state.hosts.midwife_avdotya.money.amount, naturalInjury.hosts.midwife_avdotya.money.amount + 2);
assert.equal(treatedInjury.state.hosts.porter_gavrila.money.amount, naturalInjury.hosts.porter_gavrila.money.amount - 2);
const treatedReloaded = game.loadGame(game.saveGame(treatedInjury.state), { maps, hostCards: cards, quests: [injuryQuest] });
assert.equal(game.stateHash(treatedReloaded), game.stateHash(treatedInjury.state), 'injury, recovery, caregiver payment and event choice survive save/load');
assert.ok(treatedInjury.state.ledger.at(-1).livingEvents.some(event => event.catalogEventId === 'E12' && event.stage === 'TREATED'));
let canalTrafficDay = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
for (let dayPart = 0; dayPart < 3; dayPart += 1) canalTrafficDay = game.advanceNpcWorld(canalTrafficDay, 480, maps);
const canalTrafficRows = canalTrafficDay.ledger.flatMap(entry => entry.livingEvents ?? []).filter(event => event.catalogEventId === 'E11');
assert.deepEqual(canalTrafficRows.map(event => event.stage), ['BOAT_TRAFFIC', 'CLEARED'], 'the natural schedule starts and clears canal traffic without player action');
assert.deepEqual(canalTrafficRows[0].actorHostIds, ['coachman_timofey', 'watercarrier_luka']);
assert.equal(canalTrafficRows[0].delayMinutes, 20);
assert.deepEqual(canalTrafficRows.at(-1).waitMinutesByHost, { coachman_timofey: 20, watercarrier_luka: 20 },
  'the boat queue consumes exactly 20 work or travel minutes for both route participants rather than merely adding narrative text');
assert.equal(canalTrafficDay.world.livingEventStates.E11.status, 'RESOLVED');
const canalTrafficReloaded = game.loadGame(game.saveGame(canalTrafficDay), { maps, hostCards: cards });
assert.equal(game.stateHash(canalTrafficReloaded), game.stateHash(canalTrafficDay), 'the autonomous canal event and its waiting record survive save/load');
assert.equal(formatObservedNpcReactions(canalTrafficRows.map(event => ({ eventType: 'NPC_SIMULATION', date: event.date, livingEvents: [event] })), cards).length, 0,
  'the observer journal does not reveal canal traffic outside the player’s sight');
const witnessedCanalRows = canalTrafficRows.map(event => ({ ...event, witnessedByPlayer: true }));
assert.ok(formatObservedNpcReactions(witnessedCanalRows.map(event => ({ eventType: 'NPC_SIMULATION', date: event.date, livingEvents: [event] })), cards)
  .some(line => line.includes('배 통과 · 운하 길 통행 지연')));

const occludedView = game.createInitialState({ maps, hostCards: cards, startMapId: 'bakery-interior' });
occludedView.player.position = { x: 4, y: 1 };
assert.equal(game.playerCanObserveWorldEvent(occludedView, 'bakery-interior', { x: 5, y: 6 }, 6, maps), false,
  'a collision wall blocks a nearby event from the observer journal');

const normal = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
const authoredSocialEdgeCount = cards.reduce((sum, card) => sum + Object.keys(card.relations ?? {}).length, 0);
assert.equal(Object.values(normal.hosts).flatMap(host => host.relationshipEdges).filter(edge => edge.kind === 'AUTHORED_SOCIAL_TIE').length,
  authoredSocialEdgeCount, 'freeform authored ties migrate into directed relationship edges without inventing kinship');
const annaKinship = normal.hosts.seamstress_anna.relationshipEdges.find(edge => edge.kind === 'KINSHIP');
assert.equal(annaKinship?.toHostId, 'laundress_mariya');
assert.equal(annaKinship?.relationshipType, 'SIBLING');
assert.equal(annaKinship?.status, 'FICTIONAL_CHARACTER_DESIGN', 'the new sister relationship is explicitly authored as fiction');
assert.deepEqual(annaKinship?.knownByHostIds, ['seamstress_anna']);
assert.ok(normal.hosts.laundress_mariya.relationshipEdges.some(edge => edge.reciprocalEdgeId === annaKinship.edgeId),
  'the older sister has her own reciprocal kinship edge');
const annaHouseholdEdge = normal.hosts.seamstress_anna.relationshipEdges.find(edge => edge.kind === 'HOUSEHOLD_MEMBER');
assert.equal(annaHouseholdEdge?.toHostId, 'laundress_mariya');
assert.equal(annaHouseholdEdge?.householdId, 'COURTYARD_SISTERS_1847');
assert.equal(normal.hosts.seamstress_anna.places.homeLocation.unitLabelKo, '안뜰 공동 셋방');
assert.deepEqual(normal.hosts.seamstress_anna.places.homeLocation.position, normal.hosts.laundress_mariya.places.homeLocation.position,
  'the household members share one walkable authored home location');
assert.equal(normal.hosts.seamstress_anna.places.homeLocationStatus, 'AUTHORED_FICTIONAL_HOUSEHOLD');
const familySupportBase = game.createInitialState({ maps, hostCards: cards, startMapId: 'courtyard' });
familySupportBase.world.clockMinutes = 1080;
familySupportBase.hosts.laundress_mariya.mapId = familySupportBase.hosts.seamstress_anna.mapId = 'courtyard';
familySupportBase.hosts.laundress_mariya.position = { x: 11, y: 13 };
familySupportBase.hosts.seamstress_anna.position = { x: 10, y: 13 };
familySupportBase.player.position = { x: 11, y: 12 };
familySupportBase.hosts.laundress_mariya.money.amount = 10;
familySupportBase.hosts.seamstress_anna.money.amount = 2;
const familySupport = game.advanceNpcWorld(familySupportBase, 1, maps);
const familyTransfer = familySupport.ledger.flatMap(event => event.careTransfers ?? []).find(row => row.taskId === 'MARIYA_SIBLING_SUPPORT_ANNA_1847');
assert.equal(familyTransfer?.amount, 2, 'a co-located sibling transfers support only when the recipient is low on funds');
assert.equal(familySupport.hosts.laundress_mariya.money.amount, 8, 'the support has a real cost to the giver');
assert.equal(familySupport.hosts.seamstress_anna.money.amount, 4, 'the support changes the recipient wallet');
assert.equal(familyTransfer?.status, 'FICTIONAL_CHARACTER_DESIGN', 'family care remains explicitly fictional');
assert.equal(familyTransfer?.witnessedByPlayer, true, 'the nearby player can observe the household transfer');
assert.ok(formatObservedNpcReactions(familySupport.ledger, cards).some(line => line.includes('목격한 가족 부양') && line.includes('마리야') && line.includes('안나')));
assert.equal(game.stateHash(game.loadGame(game.saveGame(familySupport), { maps, hostCards: cards })), game.stateHash(familySupport),
  'household care transfers survive save/load without changing either balance');
const guardedSupport = structuredClone(familySupportBase);
guardedSupport.hosts.seamstress_anna.money.amount = 6;
assert.equal(game.advanceNpcWorld(guardedSupport, 1, maps).ledger.flatMap(event => event.careTransfers ?? []).length, 0,
  'the support task does not transfer money once the recipient is above the authored need threshold');
const printDeadlineBase = game.createInitialState({ maps, hostCards: cards, startMapId: 'printshop' });
printDeadlineBase.player.position = { x: 14, y: 12 };
const printProofObserved = game.advanceNpcWorld(printDeadlineBase, 50, maps);
printProofObserved.world.currentMapId = 'bookshop-lane';
printProofObserved.player.position = { x: 12, y: 14 };
const printDeadline = game.advanceNpcWorld(printProofObserved, 650, maps);
const printEventRows = printDeadline.ledger.flatMap(event => event.livingEvents ?? []).filter(row => row.catalogIdSpace === 'V37_EVENT_CATALOG_45' && row.catalogEventId === 'E07');
assert.deepEqual(printEventRows.map(row => row.stage).slice(0, 2), ['PROOF_PREPARED', 'TYPESET_CHECKED'],
  'the residents produce a proof sheet and a typesetter checks its marked errors through their authored schedules');
assert.ok(['TYPESET_CHECKED', 'RESOLVED'].includes(printDeadline.world.livingEventStates.E07.stage));
assert.ok(printEventRows.every(row => row.validationStatus === 'DESIGN_SEED_NOT_VERIFIED'));
assert.ok(formatObservedNpcReactions(printDeadline.ledger, cards).some(line => line.includes('인쇄 마감 · 교정쇄 작성')));
assert.equal(game.stateHash(game.loadGame(game.saveGame(printDeadline), { maps, hostCards: cards })), game.stateHash(printDeadline),
  'the completed print deadline and its linked wage survive a save/load round trip');
const naturalPrintBase = game.createInitialState({ maps, hostCards: cards, startMapId: 'printshop' });
naturalPrintBase.world.clockMinutes = 0;
naturalPrintBase.world.date = '1847-06-01';
naturalPrintBase.player.position = { x: 14, y: 12 };
const naturalPrintRun = game.advanceNpcWorld(naturalPrintBase, 1000, maps);
const naturalPrintRows = naturalPrintRun.ledger.flatMap(event => event.livingEvents ?? [])
  .filter(row => row.catalogIdSpace === 'V37_EVENT_CATALOG_45' && row.catalogEventId === 'E07');
assert.deepEqual(naturalPrintRows.map(row => row.stage), ['PROOF_PREPARED', 'TYPESET_CHECKED', 'WAGE_PAID'],
  'the scheduled typesetting work, proof correction, and generated wage claim complete E07 without test injection');
assert.equal(naturalPrintRun.world.livingEventStates.E07.status, 'RESOLVED');
assert.ok(naturalPrintRows.every(row => row.validationStatus === 'DESIGN_SEED_NOT_VERIFIED'));
assert.equal(game.stateHash(game.loadGame(game.saveGame(naturalPrintRun), { maps, hostCards: cards })), game.stateHash(naturalPrintRun),
  'the naturally completed E07 chain survives save/load');
const brokenHouseholdCards = structuredClone(cards);
brokenHouseholdCards.find(card => card.id === 'laundress_mariya').household.memberHostIds = ['laundress_mariya'];
assert.throws(() => game.createInitialState({ maps, hostCards: brokenHouseholdCards, startMapId: 'market-quay' }), /do not share one authored home/i,
  'household definitions cannot silently drift between members');
const mikhailAnnaEdge = normal.hosts.tenant_mikhail.relationshipEdges.find(edge => edge.toHostId === 'seamstress_anna');
assert.equal(mikhailAnnaEdge.reciprocalEdgeId, 'SOCIAL:seamstress_anna:tenant_mikhail');
assert.deepEqual(mikhailAnnaEdge.knownByHostIds, ['tenant_mikhail'], 'relationship knowledge remains scoped to the host whose card states it');
const tenantLandlordEdge = normal.hosts.tenant_mikhail.relationshipEdges.find(edge => edge.kind === 'RENTAL_OBLIGATION');
assert.equal(tenantLandlordEdge?.toHostId, 'landlady_polina');
assert.ok(normal.hosts.landlady_polina.relationshipEdges.some(edge => edge.edgeId === tenantLandlordEdge.edgeId),
  'the contractual edge is indexed from both parties while retaining its tenant-to-landlord direction');
const leakedRelationship = structuredClone(mikhailAnnaEdge);
leakedRelationship.knownByHostIds = ['student_vasily'];
const tamperedRelations = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
tamperedRelations.hosts.student_vasily.relationshipEdges.push(leakedRelationship);
const forgedSave = { saveVersion: 37, state: tamperedRelations, checksum: game.stateHash(tamperedRelations) };
assert.throws(() => game.loadGame(forgedSave, { maps, hostCards: cards }), /invalid relationship edge/i,
  'valid endpoints cannot be injected into a non-party resident notebook through a recomputed save checksum');
const forgedKinshipState = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
forgedKinshipState.hosts.student_vasily.relationshipEdges.push(structuredClone(annaKinship));
assert.throws(() => game.loadGame({ saveVersion: 37, state: forgedKinshipState, checksum: game.stateHash(forgedKinshipState) }, { maps, hostCards: cards }), /invalid relationship edge/i,
  'a checksum-recomputed save cannot inject a fictional household or kinship link into another notebook');
const manualRentBase = game.createInitialState({ maps, hostCards: cards, startMapId: 'courtyard' });
const manualPossession = game.possessHost(manualRentBase, 'tenant_mikhail', maps.courtyard);
assert.equal(manualPossession.ok, true);
const manualRent = manualPossession.state;
manualRent.hosts.tenant_mikhail.position = { x: 20, y: 12 };
manualRent.hosts.landlady_polina.position = { x: 19, y: 12 };
manualRent.player.position = { x: 20, y: 12 };
manualRent.hosts.tenant_mikhail.money.amount = 4;
manualRent.hosts.landlady_polina.money.amount = 9;
manualRent.hosts.tenant_mikhail.housing.arrears = 2;
const manualPaid = game.payRent(manualRent, { tenantHostId: 'tenant_mikhail' }, maps);
assert.equal(manualPaid.ok, true, 'an embodied tenant can pay the nearby landlord directly');
assert.equal(manualPaid.paidAmount, 4);
assert.equal(manualPaid.amountDueRemaining, 1, 'a short wallet pays what it can and keeps the rest due');
assert.equal(manualPaid.state.hosts.tenant_mikhail.money.amount, 0);
assert.equal(manualPaid.state.hosts.landlady_polina.money.amount, 13);
assert.equal(manualPaid.state.world.clockMinutes, manualRent.world.clockMinutes + 5, 'rent action consumes five minutes');
const manualHousingRow = manualPaid.state.ledger.flatMap(event => event.housing ?? []).at(-1);
assert.equal(manualHousingRow.kind, 'RENT_PARTIAL');
assert.equal(manualHousingRow.catalogIdSpace, 'V37_EVENT_CATALOG_45');
assert.equal(manualHousingRow.catalogEventId, 'E01');
assert.equal(manualHousingRow.validationStatus, rentSeed.validation_status);
assert.equal(manualHousingRow.witnessedByPlayer, true);
assert.equal(manualPaid.state.world.livingEventStates.E01.stage, 'PARTIAL_PAYMENT');
assert.equal(manualPaid.state.world.livingEventStates.E01.status, 'ACTIVE');
assert.ok(manualPaid.state.ledger.flatMap(event => event.livingEvents ?? []).some(event => event.catalogEventId === 'E01' && event.stage === 'PARTIAL_PAYMENT'));
assert.equal(game.payRent(manualPaid.state, { tenantHostId: 'tenant_mikhail' }, maps).reason, 'insufficient_funds');
const day = game.advanceNpcWorld(normal, 905, maps);
assert.ok(day.world.livingEventStates.E01, 'an NPC rent deadline creates a persistent catalog event state');
const dayBreadEvents = day.ledger.flatMap(event => event.livingEvents ?? []).filter(event => event.catalogEventId === 'E02');
const nextDay = game.advanceNpcWorld(day, 1000, maps);
const nextDayBreadEvents = nextDay.ledger.flatMap(event => event.livingEvents ?? []).filter(event => event.catalogEventId === 'E02');
const laundryStages = [day, nextDay].flatMap(state => state.ledger.flatMap(event => event.livingEvents ?? [])
  .filter(event => event.catalogIdSpace === 'V37_EVENT_CATALOG_45' && event.catalogEventId === 'E04').map(event => event.stage));
const laundryRows = [day, nextDay].flatMap(state => state.ledger.flatMap(event => event.livingEvents ?? [])
  .filter(event => event.catalogIdSpace === 'V37_EVENT_CATALOG_45' && event.catalogEventId === 'E04'));
assert.ok(laundryRows.some(event => event.stage === 'LINEN_WASHED'));
assert.ok(laundryRows.some(event => event.stage === 'LINEN_EXCHANGED' && event.payment === 2),
  'the produced linen inventory is sold through the authored daily work exchange');
assert.ok(laundryRows.every(event => event.validationStatus === 'DESIGN_SEED_NOT_VERIFIED'));
assert.ok([day, nextDay].some(state => state.world.livingEventStates.E04), 'E04 retains a serializable current stage');
assert.ok(laundryRows.some(event => formatObservedNpcReactions([
  { eventType: 'NPC_SIMULATION', date: event.date, livingEvents: [{ ...event, witnessedByPlayer: true }] },
], cards).some(line => line.includes('린넨 납품 · 세탁값 수령'))));
const laundryNatural = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
laundryNatural.world.clockMinutes = 0;
laundryNatural.player.position = { x: 8, y: 11 };
const completedLaundry = game.advanceNpcWorld(laundryNatural, 2400, maps);
const completedLaundryEvents = completedLaundry.ledger.flatMap(event => event.livingEvents ?? []);
assert.deepEqual(completedLaundryEvents.filter(event => event.catalogIdSpace === 'V37_EVENT_CATALOG_45' && event.catalogEventId === 'E04')
  .map(event => event.stage), ['LINEN_WASHED', 'LINEN_EXCHANGED', 'ACCOUNTS_RECONCILED'],
  'an unmodified three-day resident schedule naturally completes E04 in causal order');
assert.ok(completedLaundryEvents.some(event => event.catalogIdSpace === 'V37_EVENT_CATALOG_45' && event.catalogEventId === 'E04' && event.stage === 'ACCOUNTS_RECONCILED'),
  'Mariya completes the scheduled reconciliation work action after the real linen sale');
assert.ok(formatObservedNpcReactions(completedLaundry.ledger, cards).some(line => line.includes('세탁값 장부 정리')));
assert.equal(completedLaundry.world.livingEventStates.E04.status, 'RESOLVED');
assert.equal(completedLaundry.world.livingEventStates.E04.stage, 'ACCOUNTS_RECONCILED');
assert.equal(game.stateHash(game.loadGame(game.saveGame(completedLaundry), { maps, hostCards: cards })), game.stateHash(completedLaundry),
  'the resolved linen event stage survives save/load');
assert.deepEqual(dayBreadEvents.map(event => event.stage), ['PRICE_NOTICE', 'RESTOCKED'], 'stockout and conditional bakery restock are observed in causal order');
assert.equal(day.world.livingEventStates.E02.stage, 'RESTOCKED');
assert.ok(nextDayBreadEvents.some(event => event.stage === 'FIRST_PURCHASE' && event.currentPrice === event.basePrice + 1 && event.pricePaid === event.currentPrice),
  'a later customer pays the displayed game-only surcharge and resolves the event');
assert.equal(nextDay.world.livingEventStates.E02.status, 'RESOLVED');
assert.equal(nextDay.hosts.market_nadezhda.marketStock['빵 한 묶음'], 0, 'the later purchase consumes the restocked bread');
const rentNoticeRows = nextDay.ledger.flatMap(event => event.livingEvents ?? [])
  .filter(event => event.catalogIdSpace === 'V37_EVENT_CATALOG_45' && event.catalogEventId === 'E26');
assert.ok(rentNoticeRows.some(event => event.stage === 'NOTICE_POSTED' && event.sourceEventId === 'E02'),
  'the adjusted-price purchase causally posts a physical rent notice in the courtyard');
assert.ok(['ACTIVE', 'RESOLVED'].includes(nextDay.world.livingEventStates.E26?.status),
  'the household event persists after the market trigger, including its unattended resolution');
assert.ok(rentNoticeRows.some(event => event.stage === 'INCREASE_ACCEPTED'),
  'if no player intervenes, the posted increase changes the next rent obligation');
const witnessedBreadStages = [...dayBreadEvents, ...nextDayBreadEvents].map(event => formatObservedNpcReactions([
  { eventType: 'NPC_SIMULATION', date: event.date, livingEvents: [{ ...event, witnessedByPlayer: true }] },
], cards)[0]);
assert.ok(witnessedBreadStages.some(line => line.includes('가격표 조정')));
assert.ok(witnessedBreadStages.some(line => line.includes('빵 재입고')));
assert.ok(witnessedBreadStages.some(line => line.includes('조정 가격으로 첫 구매') && line.includes('2코페이카')));
const eventReplay = game.advanceNpcWorld(game.loadGame(game.saveGame(day), { maps, hostCards: cards }), 1000, maps);
assert.equal(game.stateHash(eventReplay), game.stateHash(nextDay), 'saving between restock and purchase preserves the remaining causal steps');
const simulation = day.ledger.find(event => event.eventType === 'NPC_SIMULATION');
const simulationEntries = day.ledger.filter(event => event.eventType === 'NPC_SIMULATION');
const wage = simulationEntries.flatMap(event => event.payments ?? []).find(event => event.hostId === 'tenant_mikhail' && event.payerHostId === 'carter_roman');
const rent = simulationEntries.flatMap(event => event.housing ?? []).find(event => event.hostId === 'tenant_mikhail' && event.landlordHostId === 'landlady_polina');
assert.ok(wage, 'Mikhail receives the completed day-labor wage from Roman');
assert.equal(wage.amount, 3);
assert.equal(wage.mapId, wage.counterpartyMapId);
assert.ok(Math.abs(wage.position.x - wage.counterpartyPosition.x) + Math.abs(wage.position.y - wage.counterpartyPosition.y) <= 1,
  'wage changes hands only while both residents are physically adjacent');
assert.equal(day.hosts.tenant_mikhail.money.amount, 9, `starting funds + wage - rent equals the ending balance: ${JSON.stringify({ start: normal.hosts.tenant_mikhail.money, end: day.hosts.tenant_mikhail.money, rent, housing: day.hosts.tenant_mikhail.housing, purchaseMeals: day.ledger.flatMap(event => event.meals ?? []).filter(meal => meal.kind === 'PURCHASE_AND_EAT') })}`);
assert.equal(day.hosts.carter_roman.money.amount, 25, 'employer funds are debited');
assert.equal(day.hosts.landlady_polina.money.amount, 12, 'rent is credited to the landlord');
assert.equal(rent?.kind, 'RENT_PAID');
assert.equal(rent.catalogIdSpace, 'V37_EVENT_CATALOG_45');
assert.equal(rent.catalogEventId, 'E01', 'rent payment resolves the matching staged catalog scenario');
assert.equal(rent.validationStatus, rentSeed.validation_status, 'runtime does not promote an unverified seed to historical fact');
const courtyardObserver = game.createInitialState({ maps, hostCards: cards, startMapId: 'courtyard' });
courtyardObserver.player.position = { x: 13, y: 4 };
courtyardObserver.hosts.tenant_mikhail.money.amount = 0;
courtyardObserver.hosts.carter_roman.money.amount = 0;
const observedDay = game.advanceNpcWorld(courtyardObserver, 840, maps);
const observedSimulation = observedDay.ledger.find(event => event.eventType === 'NPC_SIMULATION');
const observedRent = observedSimulation?.housing?.find(event => event.hostId === 'tenant_mikhail' && event.landlordHostId === 'landlady_polina');
assert.equal(observedRent?.kind, 'RENT_OVERDUE');
assert.equal(observedRent?.catalogEventId, 'E01');
assert.equal(observedRent.witnessedByPlayer, true, 'nearby observer receives a real witnessed rent event from the engine');
assert.equal(observedRent.validationStatus, rentSeed.validation_status);
assert.equal(observedDay.world.livingEventStates.E01.stage, 'OVERDUE');
assert.ok(observedSimulation.livingEvents.some(event => event.catalogEventId === 'E01' && event.stage === 'OVERDUE' && event.witnessedByPlayer));
assert.equal(rent.causedByClaimId, wage.claimId, 'rent settlement links back to the same-day paid work claim');
assert.equal(day.hosts.tenant_mikhail.housing.arrears, 0);
assert.equal(day.hosts.tenant_mikhail.pendingWageClaims[0]?.status, 'PAID');
const visibleEconomy = formatObservedNpcReactions([observedSimulation], cards);
assert.ok(visibleEconomy.some(line => line.includes('목격한 방세') && line.includes('체납')));
const wageCopy = formatObservedNpcReactions([{ ...simulation, payments: [{ ...wage, witnessedByPlayer: true }], housing: [] }], cards);
assert.ok(wageCopy.some(line => line.includes('목격한 품삯 지급')));
const reloaded = game.loadGame(game.saveGame(day), { maps, hostCards: cards });
assert.equal(game.stateHash(reloaded), game.stateHash(day), 'wage, rent, arrears and resident state survive save/load');
assert.deepEqual(reloaded.hosts.seamstress_anna.places.homeLocation, day.hosts.seamstress_anna.places.homeLocation,
  'a shared fictional household address persists through save/load');
assert.deepEqual(reloaded.hosts.seamstress_anna.relationshipEdges.filter(edge => edge.kind === 'KINSHIP' || edge.kind === 'HOUSEHOLD_MEMBER'),
  day.hosts.seamstress_anna.relationshipEdges.filter(edge => edge.kind === 'KINSHIP' || edge.kind === 'HOUSEHOLD_MEMBER'),
  'kinship and household edges persist through save/load');

const possessed = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
const inCourtyard = game.createInitialState({ maps, hostCards: cards, startMapId: 'courtyard' });
const possession = game.possessHost(inCourtyard, 'tenant_mikhail', maps.courtyard);
assert.equal(possession.ok, true, 'the tenant can be possessed from the adjacent courtyard spawn');
const possessedDay = game.advanceNpcWorld(possession.state, 840, maps);
const possessedRent = possessedDay.ledger.flatMap(event => event.housing ?? []).filter(event => event.hostId === 'tenant_mikhail');
const possessedPayments = possessedDay.ledger.flatMap(event => event.payments ?? []).filter(event => event.hostId === 'tenant_mikhail');
assert.equal(possessedPayments.length, 0, 'the engine does not pay wages for a possessed resident');
assert.ok(possessedRent.some(event => event.kind === 'RENT_OVERDUE' && event.arrears === 3),
  'possession pauses rent transfer but does not erase the due date or arrears');
assert.equal(possessedDay.hosts.tenant_mikhail.money.amount, 9);
assert.equal(possessedDay.hosts.tenant_mikhail.housing.arrears, 3);

const hardship = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
hardship.hosts.carter_roman.money.amount = 0;
hardship.hosts.tenant_mikhail.money.amount = 0;
const beforeClose = game.advanceNpcWorld(hardship, 660, maps);
assert.equal(beforeClose.hosts.tenant_mikhail.housing.arrears, 0, 'unpaid rent remains open during the grace window');
const beforeCloseReloaded = game.loadGame(game.saveGame(beforeClose), { maps, hostCards: cards });
const unpaid = game.advanceNpcWorld(beforeClose, 180, maps);
const unpaidAfterReload = game.advanceNpcWorld(beforeCloseReloaded, 180, maps);
assert.equal(game.stateHash(unpaidAfterReload), game.stateHash(unpaid), 'save/load preserves a pending rent deadline and its later outcome');
const unpaidEvents = unpaid.ledger.flatMap(event => event.housing ?? []).filter(event => event.hostId === 'tenant_mikhail');
assert.ok(unpaidEvents.some(event => event.kind === 'RENT_OVERDUE' && event.arrears === 3), 'unpaid rent becomes explicit, persistent arrears');
assert.equal(unpaid.hosts.tenant_mikhail.housing.arrears, 3);
assert.equal(unpaid.hosts.tenant_mikhail.money.amount, 0, 'the engine never creates money to cover a shortfall');

const partial = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
partial.hosts.carter_roman.money.amount = 0;
partial.hosts.tenant_mikhail.money.amount = 4;
partial.hosts.tenant_mikhail.housing.arrears = 3;
const partialState = game.advanceNpcWorld(partial, 840, maps);
const partialEvents = partialState.ledger.flatMap(event => event.housing ?? []).filter(event => event.hostId === 'tenant_mikhail');
assert.ok(partialEvents.some(event => event.kind === 'RENT_PARTIAL' && event.amount === 4 && event.amountDueRemaining === 2),
  'available funds partially pay the rent and reduce outstanding arrears');
assert.equal(partialState.hosts.tenant_mikhail.housing.arrears, 2);
assert.equal(partialState.hosts.tenant_mikhail.money.amount, 0);

const marketMeal = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
const buyer = marketMeal.hosts.porter_gavrila, foodSeller = marketMeal.hosts.market_nadezhda;
const breadSupplier = marketMeal.hosts.baker_fyodor;
marketMeal.world.clockMinutes = 1020;
marketMeal.player.position = { x: 16, y: 12 };
buyer.mapId = foodSeller.mapId = 'market-quay';
buyer.position = { x: 15, y: 12 };
foodSeller.position = { x: 14, y: 12 };
breadSupplier.mapId = 'market-quay';
breadSupplier.position = { x: 13, y: 12 };
buyer.money = { amount: 10, unit: 'kopeks' };
foodSeller.money = { amount: 32, unit: 'kopeks' };
buyer.needs.hunger = 90;
buyer.inventory = buyer.inventory.filter(item => item !== '빵 한 묶음');
const fed = game.advanceNpcWorld(marketMeal, 5, maps);
const mealPurchase = fed.ledger.flatMap(event => event.meals ?? []).find(meal => meal.kind === 'PURCHASE_AND_EAT');
assert.ok(mealPurchase, `a hungry resident autonomously buys food from a stocked market seller: ${JSON.stringify({ goal: fed.hosts.porter_gavrila.activeGoal, buyer: { money: fed.hosts.porter_gavrila.money, hunger: fed.hosts.porter_gavrila.needs.hunger, inventory: fed.hosts.porter_gavrila.inventory }, seller: { money: fed.hosts.market_nadezhda.money, inventory: fed.hosts.market_nadezhda.inventory }, meals: fed.ledger.flatMap(event => event.meals ?? []) })}`);
const stockDelivery = fed.ledger.flatMap(event => event.exchanges ?? []).find(exchange => exchange.hostId === 'baker_fyodor'
  && exchange.recipientHostId === 'market_nadezhda' && exchange.itemKo === '빵 한 묶음' && exchange.marketStockAdded);
assert.ok(stockDelivery, 'the bakery exchange must supply the market stock before a customer buys it');
assert.equal(mealPurchase.hostId, buyer.id);
assert.equal(mealPurchase.sellerHostId, foodSeller.id);
assert.equal(fed.hosts.porter_gavrila.money.amount, 9, 'the buyer pays the shopkeeper from their own wallet');
assert.equal(fed.hosts.market_nadezhda.money.amount, 30, 'the seller receives the meal payment after paying for bakery stock');
assert.ok(fed.hosts.porter_gavrila.needs.hunger < 60 && mealPurchase.hungerAfter < 60, 'purchased food relieves hunger below the purchase threshold');
assert.equal(fed.hosts.porter_gavrila.inventory.includes('빵 한 묶음'), false, 'purchased bread is consumed rather than retained as free inventory');
assert.equal(fed.hosts.market_nadezhda.marketStock['빵 한 묶음'], 0, 'a sale decrements the separately tracked market stock');
const witnessedMeal = formatObservedNpcReactions([fed.ledger.find(event => event.eventType === 'NPC_SIMULATION')], cards);
assert.ok(witnessedMeal.some(line => line.includes('목격한 시장 식사')));
const breadEventRows = fed.ledger.flatMap(event => event.livingEvents ?? []);
assert.ok(breadEventRows.some(event => event.catalogEventId === 'E02' && event.stage === 'PRICE_NOTICE'),
  'emptying the stall through an actual bread purchase starts the staged market scenario');
assert.equal(breadEventRows.find(event => event.catalogEventId === 'E02')?.catalogIdSpace, 'V37_EVENT_CATALOG_45');
assert.equal(breadEventRows.find(event => event.catalogEventId === 'E02')?.validationStatus, breadSeed.validation_status);
assert.ok(formatObservedNpcReactions([fed.ledger.find(event => event.eventType === 'NPC_SIMULATION')], cards)
  .some(line => line.includes('빵 재고 소진 · 가격표 조정')),
  'the witnessed stock change is readable without an extra status notice');
const fedReloaded = game.loadGame(game.saveGame(fed), { maps, hostCards: cards });
assert.equal(game.stateHash(fedReloaded), game.stateHash(fed), 'market stock, wallets and hunger survive save/load');
assert.equal(fedReloaded.world.livingEventStates.E02.catalogIdSpace, 'V37_EVENT_CATALOG_45');
assert.equal(fedReloaded.world.livingEventStates.E02.stage, 'PRICE_NOTICE', 'the staged event survives save/load');
assert.equal(fedReloaded.world.marketPriceModifiers['market_nadezhda:빵 한 묶음'], 1, 'the gameplay price modifier survives save/load');
const tamperedMarketState = structuredClone(fed);
tamperedMarketState.world.marketPriceModifiers['market_nadezhda:빵 한 묶음'] = -1;
assert.throws(() => game.loadGame({ saveVersion: 37, state: tamperedMarketState, checksum: game.stateHash(tamperedMarketState) }, { maps, hostCards: cards }), /invalid market price modifiers/i,
  'a rechecksummed save cannot inject an invalid market modifier');
const ambiguousEventState = structuredClone(fed);
delete ambiguousEventState.world.livingEventStates.E02.catalogIdSpace;
assert.doesNotThrow(() => game.loadGame({ saveVersion: 37, state: ambiguousEventState, checksum: game.stateHash(ambiguousEventState) }, { maps, hostCards: cards }),
  'earlier V37 bread-event saves migrate into the namespaced catalog id');
const fedFromMidRouteSave = game.advanceNpcWorld(game.loadGame(game.saveGame(marketMeal), { maps, hostCards: cards }), 5, maps);
assert.equal(game.stateHash(fedFromMidRouteSave), game.stateHash(fed), 'resuming before supply, travel and purchase reproduces the same result');

const closedMarket = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
closedMarket.world.clockMinutes = 700;
const closedBuyer = closedMarket.hosts.porter_gavrila, closedSeller = closedMarket.hosts.market_nadezhda;
closedBuyer.mapId = closedSeller.mapId = 'nevsky';
closedBuyer.position = { x: 15, y: 12 };
closedSeller.position = { x: 14, y: 12 };
closedBuyer.needs.hunger = 90;
closedBuyer.money.amount = 10;
closedBuyer.inventory = closedBuyer.inventory.filter(item => item !== '빵 한 묶음');
closedSeller.marketStock['빵 한 묶음'] = 1;
const closedTick = game.advanceNpcWorld(closedMarket, 1, maps);
assert.equal(closedTick.ledger.flatMap(event => event.meals ?? []).some(meal => meal.kind === 'PURCHASE_AND_EAT'), false,
  'a resident cannot buy from the seller while she is away from her market stall');
assert.equal(closedTick.hosts.market_nadezhda.marketStock['빵 한 묶음'], 1, 'closed-location stock remains untouched');

const possessedMarket = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
possessedMarket.world.clockMinutes = 1020;
possessedMarket.player.embodiment = 'market_nadezhda';
possessedMarket.player.position = { x: 14, y: 12 };
const possessedBuyer = possessedMarket.hosts.porter_gavrila, possessedSeller = possessedMarket.hosts.market_nadezhda;
possessedBuyer.mapId = possessedSeller.mapId = 'market-quay';
possessedBuyer.position = { x: 15, y: 12 };
possessedSeller.position = { x: 14, y: 12 };
possessedBuyer.needs.hunger = 90;
possessedBuyer.money.amount = 10;
possessedBuyer.inventory = possessedBuyer.inventory.filter(item => item !== '빵 한 묶음');
possessedSeller.marketStock['빵 한 묶음'] = 1;
const possessedSellerTick = game.advanceNpcWorld(possessedMarket, 1, maps);
assert.equal(possessedSellerTick.ledger.flatMap(event => event.meals ?? []).some(meal => meal.kind === 'PURCHASE_AND_EAT'), false,
  'an embodied seller pauses automatic sales');
assert.equal(possessedSellerTick.hosts.market_nadezhda.marketStock['빵 한 묶음'], 1);

const bookbindingSeed = eventCatalog.find(event => event.event_id === 'E08');
assert.equal(bookbindingSeed?.trigger, 'scheduled_binding_order', 'the catalog names the schedule that starts the runtime binding order');
assert.equal(bookbindingSeed?.validation_status, 'DESIGN_SEED_NOT_VERIFIED', 'the linked bookbinding scenario remains a reconstruction seed');
const naturalBookbindingBase = game.createInitialState({ maps, hostCards: cards, startMapId: 'market-quay' });
naturalBookbindingBase.world.clockMinutes = 420;
naturalBookbindingBase.world.date = '1847-06-01';
naturalBookbindingBase.player.position = { x: 6, y: 10 };
const naturalBookbindingRun = game.advanceNpcWorld(naturalBookbindingBase, 700, maps);
const naturalBookbindingRows = naturalBookbindingRun.ledger.flatMap(event => event.livingEvents ?? [])
  .filter(row => row.catalogIdSpace === 'V37_EVENT_CATALOG_45' && row.catalogEventId === 'E08');
assert.deepEqual(naturalBookbindingRows.map(row => row.stage), ['ORDER_ACCEPTED', 'BOOK_BOUND', 'DELIVERED_PAID'],
  'the authored binding schedule, completed work, and delivery exchange resolve E08 without test injection');
assert.equal(naturalBookbindingRun.world.livingEventStates.E08.status, 'RESOLVED');
assert.equal(naturalBookbindingRun.hosts.bookbinder_elizaveta.inventory.includes('제본 중인 책 한 권'), false);
assert.equal(naturalBookbindingRun.hosts.bookseller_lev.inventory.includes('제본 중인 책 한 권'), true);
assert.equal(naturalBookbindingRows.at(-1).payment, 2);
assert.ok(naturalBookbindingRows.every(row => row.validationStatus === 'DESIGN_SEED_NOT_VERIFIED'));
assert.ok(formatObservedNpcReactions([{ eventType: 'NPC_SIMULATION', date: naturalBookbindingRows.at(-1).date,
  livingEvents: naturalBookbindingRows.map(row => ({ ...row, witnessedByPlayer: true })) }], cards)
  .some(line => line.includes('제본품 납품 · 대금 수령')));
assert.equal(game.stateHash(game.loadGame(game.saveGame(naturalBookbindingRun), { maps, hostCards: cards })), game.stateHash(naturalBookbindingRun),
  'the naturally completed bookbinding chain survives save/load');

console.log(JSON.stringify({ status: 'PASS', residentCount: cards.filter(card => card.kind === 'FICTIONAL').length,
  wage: { amount: wage.amount, payer: wage.payerHostId, recipient: wage.hostId, coLocated: true },
  rent: { kind: rent.kind, amount: rent.amount, arrears: day.hosts.tenant_mikhail.housing.arrears },
  familyCareTransfer: { amount: familyTransfer.amount, giverBalance: familySupport.hosts.laundress_mariya.money.amount,
    recipientBalance: familySupport.hosts.seamstress_anna.money.amount, status: familyTransfer.status },
  unpaidRentArrears: unpaid.hosts.tenant_mikhail.housing.arrears, partialRentArrears: partialState.hosts.tenant_mikhail.housing.arrears,
  possessionDefersTransferAndKeepsDueDate: true, marketMeal: { buyer: buyer.id, seller: foodSeller.id, price: mealPurchase.price, hungerAfter: fed.hosts.porter_gavrila.needs.hunger },
  breadEvent: { focusedFixture: breadEventRows.map(event => event.stage), fullDay: dayBreadEvents.map(event => event.stage),
    followingDay: nextDayBreadEvents.map(event => event.stage), finalState: nextDay.world.livingEventStates.E02?.stage ?? null,
    saveResumeParity: true },
  laundryEvent: { witnessedDayStages: laundryStages, completedLedgerStage: completedLaundryEvents.find(event => event.stage === 'ACCOUNTS_RECONCILED')?.stage ?? null,
    naturalThreeDaySequence: completedLaundryEvents.filter(event => event.catalogEventId === 'E04').map(event => event.stage),
    persistentWitnessedRows: laundryRows.length },
  bookbindingEvent: { naturalScheduleStages: naturalBookbindingRows.map(event => event.stage),
    finalState: naturalBookbindingRun.world.livingEventStates.E08?.status ?? null, payment: naturalBookbindingRows.at(-1)?.payment ?? null,
    saveReloadParity: true },
  canalTrafficEvent: { naturalScheduleStages: canalTrafficRows.map(event => event.stage),
    finalState: canalTrafficDay.world.livingEventStates.E11?.status ?? null,
    residentWaitMinutes: canalTrafficRows.at(-1)?.waitMinutesByHost ?? {}, saveReloadParity: true },
  warehouseInjuryEvent: { naturalStages: naturalInjury.ledger.flatMap(entry => entry.livingEvents ?? [])
      .filter(event => event.catalogEventId === 'E12').map(event => event.stage),
    unattendedStage: untreatedInjury.world.livingEventStates.E12?.stage ?? null,
    treatedStage: treatedInjury.state.world.livingEventStates.E12?.stage ?? null, saveReloadParity: true },
  printDeadline: { naturalScheduleStages: naturalPrintRows.map(event => event.stage),
    finalState: naturalPrintRun.world.livingEventStates.E07?.status ?? null, saveReloadParity: true },
  bakerySuppliesMarketStock: true, closedStallBlocksPurchase: true, possessionPausesSales: true,
  saveResumeDeterminism: true, manualPartialRentPayment: true, rejectsCrossHostRelationInjection: true,
  saveReloadParity: true }, null, 2));
