import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/typesetter-speed-censorship-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const map = maps.printshop;
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === quest.entry.objectId);
assert.ok(object, 'the deadline response uses the real printshop time board');
const stateFor = (stage = 'PROOF_PREPARED', embodiment = 'typesetter_nikita') => {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'printshop' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 560;
  state.world.currentMapId = 'printshop'; state.player.embodiment = embodiment;
  state.player.position = embodiment === 'printer_ekaterina' ? { x: 16, y: 13 } : { x: 17, y: 13 };
  state.quests[quest.id] = { status: 'open' };
  for (const [id, position] of Object.entries({ typesetter_nikita: { x: 17, y: 13 }, printer_ekaterina: { x: 16, y: 13 } })) {
    state.hosts[id].mapId = 'printshop'; state.hosts[id].position = position;
  }
  state.hosts.printer_ekaterina.inventory.push('수정 표시가 된 교정쇄');
  state.world.livingEventStates.E07 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E07',
    status: 'ACTIVE', stage, startedAtMinute: 560, typesetterHostId: 'typesetter_nikita', printerHostId: 'printer_ekaterina',
    payerHostId: 'printer_ekaterina', wageActionId: 'PRINTSHOP_RELATED_WAGE', wagePaid: true,
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance' };
  return state;
};

const before = stateFor();
delete before.world.livingEventStates.E07;
assert.equal(objectIsPresent(object, before, [quest]), false, 'the workboard stays quiet before an E07 proof is prepared');
const state = stateFor();
assert.equal(objectIsPresent(object, state, [quest]), true, 'the workboard opens for the live deadline');
assert.deepEqual(questChoices(quest, 'typesetter_nikita', [], state).map(row => row.action.id),
  ['E07_PROOFREAD_NOW'], 'the typesetter can start an early correction beside the printer');
assert.deepEqual(questChoices(quest, 'printer_ekaterina', [], state).map(row => row.action.id),
  ['E07_PRINT_WITHOUT_CORRECTION', 'E07_STOP_PRESS'], 'the printer controls dispatch or cancellation');

const corrected = game.performQuestAction(state, { questId: quest.id, hostId: 'typesetter_nikita',
  actionId: 'E07_PROOFREAD_NOW', objectId: object.id }, { quests: [quest], maps });
assert.equal(corrected.ok, true, `proofreading advances E07 (${corrected.reason ?? ''})`);
assert.equal(corrected.state.world.livingEventStates.E07.stage, 'RESOLVED');
assert.equal(corrected.state.world.livingEventStates.E07.playerDecision.response, 'PROOFREAD_NOW');
assert.equal(corrected.state.world.livingEventStates.E06?.stage, 'CENSOR_MARK_RETURNED', 'proof review starts the linked marked-page choice');
assert.ok(corrected.state.hosts.typesetter_nikita.inventory.includes('교정이 끝난 인쇄 교정쇄'));

const printedState = stateFor('PROOF_PREPARED', 'printer_ekaterina');
const printed = game.performQuestAction(printedState, { questId: quest.id, hostId: 'printer_ekaterina',
  actionId: 'E07_PRINT_WITHOUT_CORRECTION', objectId: object.id }, { quests: [quest], maps });
assert.equal(printed.ok, true, `the printer can dispatch the current proof (${printed.reason ?? ''})`);
assert.equal(printed.state.world.livingEventStates.E07.stage, 'PRINTED_WITHOUT_RECHECK');
assert.ok(printed.state.world.livingEventStates.E07.playerDecision);
assert.ok(!printed.state.hosts.printer_ekaterina.inventory.includes('수정 표시가 된 교정쇄'));

const cancelledState = stateFor('PROOF_PREPARED', 'printer_ekaterina');
const cancelled = game.performQuestAction(cancelledState, { questId: quest.id, hostId: 'printer_ekaterina',
  actionId: 'E07_STOP_PRESS', objectId: object.id }, { quests: [quest], maps });
assert.equal(cancelled.ok, true, `the printer can stop the fictional job (${cancelled.reason ?? ''})`);
assert.equal(cancelled.state.world.livingEventStates.E07.stage, 'JOB_CANCELLED');
assert.ok(cancelled.state.hosts.printer_ekaterina.inventory.includes('수정 표시가 된 교정쇄'));

for (const result of [corrected, printed, cancelled]) {
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.deepEqual(restored.world.livingEventStates.E07, result.state.world.livingEventStates.E07,
    'the chosen print deadline outcome survives save/load');
}
console.log('V37 E07 print deadline choice: event-gated workboard, correction, dispatch, cancellation, linked censorship, and save/load passed.');
