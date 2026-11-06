import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles, quest, catalog] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  readJson(new URL('../rpg/quests/apprentice-literacy-1847.json', import.meta.url)),
  readJson(new URL('../data/event_catalog_45.json', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(name => name.endsWith('.json')).map(name => readJson(new URL(`../rpg/maps/${name}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(name => name.endsWith('.json')).map(name => readJson(new URL(`../rpg/characters/${name}`, import.meta.url)))),
]);
assert.equal(catalog.find(row => row.event_id === 'E19').validation_status, 'DESIGN_SEED_NOT_VERIFIED');
assert.equal(cards.find(row => row.id === 'teacher_lyubov').skills.basicReading, 4);
assert.equal(cards.find(row => row.id === 'print_apprentice_stepan').skills.basicReading, 1);
const map = maps.printshop, object = map.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(object, 'the physical exercise sheet is at the printshop workbench');

function initial(clockMinutes = 999) {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'printshop' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = clockMinutes;
  return state;
}
const before = initial();
assert.equal(game.advanceNpcWorld(initial(998), 1, maps).world.livingEventStates.E19, undefined,
  'the event does not begin before the after-work hour');
const triggered = game.advanceNpcWorld(initial(), 2, maps);
const event = triggered.world.livingEventStates.E19;
assert.equal(event?.status, 'ACTIVE'); assert.equal(event.stage, 'LESSON_REQUESTED');
assert.equal(event.venueBasis, 'FICTIONAL_AFTER_WORK_PRINTSHOP_PRACTICE');
assert.equal(objectIsPresent(object, triggered, [quest]), true, 'the exercise sheet appears only after the natural trigger');
assert.ok(triggered.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E19'
  && row.stage === 'LESSON_REQUESTED' && row.validationStatus === 'DESIGN_SEED_NOT_VERIFIED'));

let ready = triggered;
for (let step = 0; step < 360 && ready.world.livingEventStates.E19.stage !== 'LESSON_READY'; step += 1) {
  ready = game.advanceNpcWorld(ready, 1, maps);
}
assert.equal(ready.world.livingEventStates.E19.stage, 'LESSON_READY',
  `teacher and apprentice should meet through real pathing: ${JSON.stringify(['teacher_lyubov','print_apprentice_stepan'].map(id => ({id, map:ready.hosts[id].mapId, pos:ready.hosts[id].position})))}`);
assert.ok(ready.ledger.flatMap(row => row.moves ?? []).some(row => row.hostId === 'teacher_lyubov' && row.toMapId === 'printshop'),
  'the teacher physically travels from the courtyard to the shop');
assert.ok(ready.ledger.flatMap(row => row.moves ?? []).some(row => row.hostId === 'print_apprentice_stepan'),
  'the apprentice continues his own routine while joining the lesson');

const cases = [
  { actionId: 'E19_ASK_FOR_LESSON', hostId: 'print_apprentice_stepan', stage: 'LESSON_COMPLETED', paid: false },
  { actionId: 'E19_OFFER_KOPEK', hostId: 'print_apprentice_stepan', stage: 'LESSON_PAID', paid: true },
  { actionId: 'E19_TEACH_FREE', hostId: 'teacher_lyubov', stage: 'LESSON_COMPLETED', paid: false },
  { actionId: 'E19_REQUEST_KOPEK', hostId: 'teacher_lyubov', stage: 'LESSON_PAID', paid: true },
  { actionId: 'E19_STUDENT_DECLINE', hostId: 'print_apprentice_stepan', stage: 'LESSON_DECLINED', paid: false, learned: false },
  { actionId: 'E19_TEACHER_POSTPONE', hostId: 'teacher_lyubov', stage: 'LESSON_DECLINED', paid: false, learned: false },
];
for (const scenario of cases) {
  const branch = structuredClone(ready), tile = { x: object.x / 16, y: object.y / 16 };
  branch.world.currentMapId = 'printshop'; branch.player.embodiment = scenario.hostId;
  branch.hosts.teacher_lyubov.mapId = 'printshop'; branch.hosts.teacher_lyubov.position = { ...tile };
  branch.hosts.print_apprentice_stepan.mapId = 'printshop'; branch.hosts.print_apprentice_stepan.position = { x: tile.x + 1, y: tile.y };
  branch.player.position = { ...branch.hosts[scenario.hostId].position };
  const choices = questChoices(quest, scenario.hostId, [], branch).map(row => row.action.id);
  assert.ok(choices.includes(scenario.actionId), `${scenario.actionId} is shown only for its available actor`);
  const moneyBefore = { student: branch.hosts.print_apprentice_stepan.money.amount, teacher: branch.hosts.teacher_lyubov.money.amount };
  const skillBefore = branch.hosts.print_apprentice_stepan.skills.basicReading;
  const result = game.performQuestAction(branch, { questId: quest.id, hostId: scenario.hostId,
    actionId: scenario.actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${scenario.actionId} resolves at the workbench (${result.reason ?? ''})`);
  const resolved = result.state.world.livingEventStates.E19;
  assert.equal(resolved.status, 'RESOLVED'); assert.equal(resolved.stage, scenario.stage);
  assert.equal(result.state.hosts.print_apprentice_stepan.skills.basicReading, skillBefore + (scenario.learned === false ? 0 : 1));
  assert.equal(result.state.hosts.print_apprentice_stepan.inventory.includes('류보프와 함께 읽은 연습지 (게임 재구성)'), scenario.learned !== false);
  assert.equal(result.state.hosts.print_apprentice_stepan.money.amount, moneyBefore.student - Number(scenario.paid));
  assert.equal(result.state.hosts.teacher_lyubov.money.amount, moneyBefore.teacher + Number(scenario.paid));
  assert.ok(result.state.ledger.at(-1).livingEvents.some(row => row.catalogEventId === 'E19' && row.stage === scenario.stage));
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.equal(restored.world.livingEventStates.E19.stage, scenario.stage, 'lesson choice persists after save/load');
  assert.equal(restored.hosts.print_apprentice_stepan.skills.basicReading, result.state.hosts.print_apprentice_stepan.skills.basicReading);
}

const unattended = structuredClone(ready);
const practiceDuration = unattended.world.livingEventStates.E19.practiceDurationMinutes;
assert.equal(practiceDuration, 30, 'the brief evening practice has a bounded authored duration');
unattended.world.clockMinutes = unattended.world.livingEventStates.E19.resolvesAtMinute - practiceDuration;
unattended.hosts.teacher_lyubov.mapId = 'printshop'; unattended.hosts.teacher_lyubov.position = { x: object.x / 16, y: object.y / 16 };
unattended.hosts.print_apprentice_stepan.mapId = 'printshop'; unattended.hosts.print_apprentice_stepan.position = { x: object.x / 16 + 1, y: object.y / 16 };
const automatic = game.advanceNpcWorld(unattended, practiceDuration, maps);
assert.equal(automatic.world.livingEventStates.E19.stage, 'PRACTICED_UNATTENDED');
assert.equal(automatic.hosts.print_apprentice_stepan.skills.basicReading, 2);
assert.ok(automatic.hosts.print_apprentice_stepan.inventory.includes('류보프와 함께 읽은 연습지 (게임 재구성)'));

const missed = structuredClone(triggered), oldEvent = missed.world.livingEventStates.E19;
oldEvent.resolvesAtMinute = missed.world.clockMinutes + 1;
missed.hosts.teacher_lyubov.historicalAliveAndPresent = false;
const postponed = game.advanceNpcWorld(missed, 2, maps);
assert.equal(postponed.world.livingEventStates.E19.stage, 'LESSON_POSTPONED');
assert.equal(postponed.hosts.print_apprentice_stepan.skills.basicReading, 1, 'absence does not award free learning');

console.log(JSON.stringify({ status: 'PASS', eventId: 'E19', triggerMinute: 1000, choices: cases.length,
  teacherTravel: 'verified', unattendedLesson: 'verified', missedMeeting: 'no skill granted', saveReload: true,
  validationStatus: event.validationStatus }, null, 2));
