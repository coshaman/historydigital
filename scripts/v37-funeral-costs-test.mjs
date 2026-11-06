import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest, repaymentQuest, injuryQuest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/funeral-costs-1847.json'), read('../rpg/quests/funeral-debt-repayment-1847.json'),
  read('../rpg/quests/warehouse-injury-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const quests = [quest, repaymentQuest, injuryQuest];
const object = maps['communal-room'].layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === 4009);
const repaymentObject = maps['inn-interior'].layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === 4007);
assert.ok(object, 'the expense scene has a physical ledger in the shared room');
assert.ok(repaymentObject, 'the repayment scene has a physical ledger at the inn');

function initial() {
  const state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'communal-room' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 700;
  state.hosts.courier_pavel.mapId = 'communal-room'; state.hosts.courier_pavel.position = { x: 11, y: 10 };
  state.hosts.innkeeper_irina.mapId = 'communal-room'; state.hosts.innkeeper_irina.position = { x: 12, y: 10 };
  state.player.embodiment = 'courier_pavel'; state.player.position = { x: 11, y: 10 };
  state.world.livingEventStates.E28 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E28',
    status: 'ACTIVE', stage: 'FUNERAL_COSTS_DUE', trigger: 'fictional_relative_death_after_untreated_critical_injury',
    startedAtMinute: 700, deadlineMinute: 1060, deceasedHostId: 'porter_gavrila', organizerHostId: 'courier_pavel',
    lenderHostId: 'innkeeper_irina', actorHostIds: ['courier_pavel', 'innkeeper_irina'], witnessHostIds: [],
    venueMapId: 'communal-room', scenePosition: { x: 11, y: 10 }, cost: 4, unit: 'kopeks',
    occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
    valueStatus: 'fictional_gameplay_balance' };
  return state;
}

const base = initial();
assert.equal(objectIsPresent(object, base, quests), true);
assert.deepEqual(questChoices(quest, 'courier_pavel', [], base).map(row => row.action.id),
  ['E28_PAVEL_PAYS_COSTS', 'E28_IRINA_ADVANCES_COSTS']);

const paid = game.performQuestAction(base, { questId: quest.id, hostId: 'courier_pavel',
  actionId: 'E28_PAVEL_PAYS_COSTS', objectId: object.id }, { quests, maps });
assert.equal(paid.ok, true, `Pavel can pay the costs (${paid.reason ?? ''})`);
assert.equal(paid.state.hosts.courier_pavel.money.amount, base.hosts.courier_pavel.money.amount - 4);
assert.equal(paid.state.world.livingEventStates.E28.stage, 'FUNERAL_COSTS_PAID');

const borrowed = game.performQuestAction(base, { questId: quest.id, hostId: 'courier_pavel',
  actionId: 'E28_IRINA_ADVANCES_COSTS', objectId: object.id }, { quests, maps });
assert.equal(borrowed.ok, true, `Irina can advance the funeral costs (${borrowed.reason ?? ''})`);
assert.equal(borrowed.state.hosts.innkeeper_irina.money.amount, base.hosts.innkeeper_irina.money.amount - 4);
assert.deepEqual(borrowed.state.world.livingEventStates.E28.debt,
  { debtorHostId: 'courier_pavel', creditorHostId: 'innkeeper_irina', amount: 4, unit: 'kopeks',
    openedAtMinute: 705, status: 'OUTSTANDING', amountRepaid: 0, remainingAmount: 4,
    dueAtMinute: 1425, nextPaymentAtMinute: 1425, causeId: 'E28_FUNERAL_COSTS' });
const restored = game.loadGame(game.saveGame(borrowed.state), { maps, hostCards: cards, quests });
assert.equal(restored.world.livingEventStates.E28.debt.status, 'OUTSTANDING', 'the loan survives save/load');
assert.ok(restored.ledger.at(-1).livingEvents.some(row => row.catalogEventId === 'E28' && row.paidByHostId === 'innkeeper_irina'));

const atInn = structuredClone(borrowed.state);
atInn.world.currentMapId = 'inn-interior';
atInn.hosts.courier_pavel.mapId = 'inn-interior'; atInn.hosts.courier_pavel.position = { x: 12, y: 10 };
atInn.hosts.innkeeper_irina.mapId = 'inn-interior'; atInn.hosts.innkeeper_irina.position = { x: 14, y: 10 };
atInn.player.position = { x: 12, y: 10 };
assert.equal(objectIsPresent(repaymentObject, atInn, quests), true);
const firstRepayment = game.performQuestAction(atInn, { questId: repaymentQuest.id, hostId: 'courier_pavel',
  actionId: 'E28_REPAY_FUNERAL_COSTS', objectId: repaymentObject.id }, { quests, maps });
assert.equal(firstRepayment.ok, true);
assert.equal(firstRepayment.state.hosts.courier_pavel.money.amount, 9);
assert.equal(firstRepayment.state.hosts.innkeeper_irina.money.amount, base.hosts.innkeeper_irina.money.amount - 2);
assert.equal(firstRepayment.state.world.livingEventStates.E28.debt.remainingAmount, 2);
assert.equal(firstRepayment.state.quests[repaymentQuest.id].status, 'open', 'the debt ledger stays available for the last installment');
const partialSave = game.loadGame(game.saveGame(firstRepayment.state), { maps, hostCards: cards, quests });
assert.equal(partialSave.world.livingEventStates.E28.debt.amountRepaid, 2);
const finalRepayment = game.performQuestAction(partialSave, { questId: repaymentQuest.id, hostId: 'courier_pavel',
  actionId: 'E28_REPAY_FUNERAL_COSTS', objectId: repaymentObject.id }, { quests, maps });
assert.equal(finalRepayment.ok, true);
assert.equal(finalRepayment.state.hosts.courier_pavel.money.amount, 7);
assert.equal(finalRepayment.state.hosts.innkeeper_irina.money.amount, base.hosts.innkeeper_irina.money.amount);
assert.equal(finalRepayment.state.world.livingEventStates.E28.debt.status, 'SETTLED');
assert.equal(finalRepayment.state.world.livingEventStates.E28.debt.remainingAmount, 0);
assert.equal(finalRepayment.state.quests[repaymentQuest.id].status, 'resolved');
const settledSave = game.loadGame(game.saveGame(finalRepayment.state), { maps, hostCards: cards, quests });
assert.equal(settledSave.world.livingEventStates.E28.debt.status, 'SETTLED');

const legacyEnvelope = JSON.parse(game.saveGame(borrowed.state));
delete legacyEnvelope.state.world.livingEventStates.E28.debt.amountRepaid;
delete legacyEnvelope.state.world.livingEventStates.E28.debt.remainingAmount;
delete legacyEnvelope.state.world.livingEventStates.E28.debt.dueAtMinute;
delete legacyEnvelope.state.world.livingEventStates.E28.debt.nextPaymentAtMinute;
legacyEnvelope.checksum = game.stateHash(legacyEnvelope.state);
const migratedLegacyLoan = game.loadGame(legacyEnvelope, { maps, hostCards: cards, quests });
assert.equal(migratedLegacyLoan.world.livingEventStates.E28.debt.remainingAmount, 4);
assert.equal(migratedLegacyLoan.world.livingEventStates.E28.debt.dueAtMinute, 1425);

const releasedBorrower = game.releaseHost(borrowed.state, maps['communal-room']);
assert.equal(releasedBorrower.ok, true);
const autonomousRepayment = game.advanceNpcWorld(releasedBorrower.state, 1250, maps);
const autonomousDebt = autonomousRepayment.world.livingEventStates.E28.debt;
assert.ok(autonomousDebt.amountRepaid >= 2, 'unpossessed Pavel pays an installment after its due time');
assert.ok(autonomousRepayment.ledger.flatMap(row => row.livingEvents ?? []).some(row =>
  row.catalogEventId === 'E28' && row.actionId === 'AUTO_E28_DEBT_INSTALLMENT' && row.mapId === 'inn-interior'));

const unattended = game.advanceNpcWorld(base, 361, maps);
assert.equal(unattended.world.livingEventStates.E28.status, 'RESOLVED');
assert.ok(['FUNERAL_COSTS_PAID_UNATTENDED', 'FUNERAL_COSTS_ON_CREDIT_UNATTENDED'].includes(unattended.world.livingEventStates.E28.stage));
assert.ok(unattended.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E28'));
console.log('V37 E28: funeral costs, two real debt installments, settlement, legacy-save migration, unattended continuation, and save/load passed');
