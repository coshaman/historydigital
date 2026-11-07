import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles, quest, packet, catalog, sourceRegister] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read(new URL('../rpg/quests/household-tutor-offer-1847.json', import.meta.url)),
  read(new URL('../rpg/data/historical-source-packets.json', import.meta.url)),
  read(new URL('../data/event_catalog_45.json', import.meta.url)), read(new URL('../rpg/data/source-register.json', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url)))),
]);
const eventId = 'E37', sourceId = 'OBJ-WS-HOME-TEACHERS-1834', questId = 'V37_HOUSEHOLD_TUTOR_OFFER_1847';
assert.equal(catalog.find(row => row.event_id === eventId)?.title, '가정교사 일자리 조건');
assert.equal(packet.records.find(row => row.sourceId === sourceId)?.verificationStatus, 'DIGITAL_SCAN_LOCATED_TEXT_NOT_TRANSCRIBED');
assert.ok(sourceRegister.sources.some(row => row.sourceId === sourceId));
assert.deepEqual(quest.sourceIds, [sourceId]);
const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'courtyard' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 959;
state.world.currentMapId = 'courtyard'; state.player.embodiment = 'teacher_lyubov';
state.hosts.teacher_lyubov.mapId = 'courtyard'; state.hosts.teacher_lyubov.position = { x: 17, y: 13 };
state.player.position = { ...state.hosts.teacher_lyubov.position };
state.hosts.minor_noble_andrei.mapId = 'courtyard'; state.hosts.minor_noble_andrei.position = { x: 18, y: 13 };
const target = maps.courtyard.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(target);
const active = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: ['teacher_lyubov'] });
assert.equal(active.world.livingEventStates[eventId]?.status, 'ACTIVE');
assert.equal(active.world.livingEventStates[eventId].stage, 'OFFER_DELIVERED');
assert.deepEqual(active.world.livingEventStates[eventId].sourceIds, [sourceId]);
assert.equal(objectIsPresent(target, active, [quest]), true);
const choices = questChoices(quest, 'teacher_lyubov', [], active);
assert.deepEqual(choices.map(row => row.action.id), ['E37_ACCEPT_OFFER', 'E37_AGREE_LIGHTER_SCHEDULE', 'E37_DECLINE_OFFER']);
const result = game.performQuestAction(active, { questId, hostId: 'teacher_lyubov', actionId: 'E37_ACCEPT_OFFER', objectId: target.id }, { quests: [quest], maps });
assert.equal(result.ok, true, result.reason);
assert.equal(result.state.hosts.teacher_lyubov.money.amount, state.hosts.teacher_lyubov.money.amount + 10);
assert.equal(result.state.hosts.minor_noble_andrei.money.amount, state.hosts.minor_noble_andrei.money.amount - 10);
assert.equal(result.state.world.livingEventStates[eventId].stage, 'OFFER_ACCEPTED');
assert.equal(result.state.world.householdTutorContract.hostId, 'teacher_lyubov');
assert.equal(result.state.world.householdTutorContract.weeklyPay, 10);
assert.ok(result.state.ledger.at(-1)?.livingEvents?.some(row => row.catalogEventId === eventId && row.stage === 'OFFER_ACCEPTED'));
assert.equal(game.stateHash(game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] })), game.stateHash(result.state));

const tutorWeekTwo = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
tutorWeekTwo.player.embodiment = null;
for (const resident of Object.values(tutorWeekTwo.hosts)) resident.historicalAliveAndPresent = false;
const tutor = tutorWeekTwo.hosts.teacher_lyubov, employer = tutorWeekTwo.hosts.minor_noble_andrei;
for (const [person, position] of [[tutor, { x: 17, y: 13 }], [employer, { x: 18, y: 13 }]]) {
  person.historicalAliveAndPresent = true; person.mapId = 'courtyard'; person.position = position; person.activeGoal = null;
}
tutorWeekTwo.world.clockMinutes = 7 * 1440 + 840;
tutorWeekTwo.world.date = '1847-06-08';
const nonSessionDay = game.advanceNpcWorld(tutorWeekTwo, 20, maps);
assert.ok(!(nonSessionDay.hosts.teacher_lyubov.workRecords ?? []).some(row => row.actionId === 'V37_TUTOR_HOUSEHOLD_LESSON'),
  'a two-day weekly contract does not create a lesson on its unscheduled day');
tutorWeekTwo.world.clockMinutes = 8 * 1440 + 840;
tutorWeekTwo.world.date = '1847-06-09';
const firstLesson = game.advanceNpcWorld(tutorWeekTwo, 20, maps);
assert.ok((firstLesson.hosts.teacher_lyubov.workRecords ?? []).some(row => row.actionId === 'V37_TUTOR_HOUSEHOLD_LESSON'),
  'the first contracted lesson produces a persistent work record');
assert.equal(firstLesson.hosts.teacher_lyubov.money.amount, result.state.hosts.teacher_lyubov.money.amount + 5,
  'the completed lesson pays one half of the weekly wage');
assert.equal(firstLesson.hosts.minor_noble_andrei.money.amount, result.state.hosts.minor_noble_andrei.money.amount - 5);
assert.ok(firstLesson.ledger.flatMap(row => row.payments ?? []).some(row => row.actionId === 'V37_TUTOR_HOUSEHOLD_LESSON'
  && row.hostId === tutor.id && row.payerHostId === employer.id && row.amount === 5));
const firstLessonReload = game.loadGame(game.saveGame(firstLesson), { maps, hostCards: cards, quests: [quest] });
assert.equal(game.stateHash(firstLessonReload), game.stateHash(firstLesson), 'the paid lesson and contract schedule survive save/load');
firstLessonReload.world.clockMinutes = 11 * 1440 + 840;
firstLessonReload.world.date = '1847-06-12';
const secondLesson = game.advanceNpcWorld(firstLessonReload, 20, maps);
assert.equal(secondLesson.hosts.teacher_lyubov.money.amount, result.state.hosts.teacher_lyubov.money.amount + 10,
  'the second weekly lesson pays the remaining half of the contracted wage');
assert.equal(secondLesson.hosts.minor_noble_andrei.money.amount, result.state.hosts.minor_noble_andrei.money.amount - 10);

for (const [actionId, stage, payment, contract] of [
  ['E37_AGREE_LIGHTER_SCHEDULE', 'SCHEDULE_REDUCED', 6, 1],
  ['E37_DECLINE_OFFER', 'OFFER_DECLINED', 0, undefined],
]) {
  const branch = game.performQuestAction(active, { questId, hostId: 'teacher_lyubov', actionId, objectId: target.id }, { quests: [quest], maps });
  assert.equal(branch.ok, true, `${actionId} resolves (${branch.reason ?? ''})`);
  assert.equal(branch.state.world.livingEventStates[eventId].stage, stage);
  assert.equal(branch.state.hosts.teacher_lyubov.money.amount, state.hosts.teacher_lyubov.money.amount + payment);
  assert.equal(branch.state.world.householdTutorContract?.weeklyDays, contract);
  assert.equal(branch.state.world.householdTutorRecord.disposition, actionId);
}

const unattended = game.advanceNpcWorld(active, 181, maps, { pausedHostIds: ['teacher_lyubov'] });
assert.equal(unattended.world.livingEventStates[eventId].stage, 'OFFER_EXPIRED');
assert.equal(unattended.world.householdTutorContract, undefined);
console.log('V37 E37 household teaching offer, located regulation scan, choices, contract payment, timeout and save/load passed');
