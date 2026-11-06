import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState, readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles, quest, catalog] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  readJson(new URL('../rpg/quests/sick-lodger-1847.json', import.meta.url)), readJson(new URL('../data/event_catalog_45.json', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(name => name.endsWith('.json')).map(name => readJson(new URL(`../rpg/maps/${name}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(name => name.endsWith('.json')).map(name => readJson(new URL(`../rpg/characters/${name}`, import.meta.url)))),
]);
assert.equal(catalog.find(row => row.event_id === 'E15').validation_status, 'DESIGN_SEED_NOT_VERIFIED');
const bed = maps['inn-interior'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(bed, 'the scene uses the shared room bed as its physical focal object');

function initial() {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'inn-interior' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-06'; state.world.clockMinutes = 418;
  state.hosts.lodging_tatyana.needs.hunger = 80;
  return state;
}
assert.equal(game.advanceNpcWorld(initial(), 1, maps).world.livingEventStates.E15, undefined,
  'the event waits for the fixed scene time');
const belowThreshold = initial(); belowThreshold.hosts.lodging_tatyana.needs.hunger = 0; belowThreshold.hosts.lodging_tatyana.needs.fatigue = 0;
assert.equal(game.advanceNpcWorld(belowThreshold, 3, maps).world.livingEventStates.E15, undefined,
  'the fictional scene is conditional on severe gameplay need, not a medical claim');
let active = game.advanceNpcWorld(initial(), 2, maps);
const event = active.world.livingEventStates.E15;
assert.equal(event?.status, 'ACTIVE'); assert.equal(event.stage, 'CARE_REQUESTED');
assert.match(event.triggerMechanism, /NO_MEDICAL_CAUSATION_CLAIM/);
assert.equal(active.hosts.lodging_tatyana.healthState.condition, 'UNWELL');
assert.equal(objectIsPresent(bed, active, [quest]), true, 'the bed appears as the event object');
assert.equal(questChoices(quest, 'lodging_tatyana', [], active).length, 2, 'both immediate choices are available');
active.player.embodiment = 'lodging_tatyana'; active.player.position = { ...event.scenePosition };
active.hosts.lodging_tatyana.position = { ...event.scenePosition };

for (const [actionId, expectedStage, expectedCare] of [
  ['E15_REQUEST_NEIGHBOR_HELP', 'MIDWIFE_REQUESTED', 'MIDWIFE_VISIT_REQUESTED_GAMEPLAY'],
  ['E15_KEEP_PRIVATE', 'PRIVACY_CHOSEN', 'PRIVATE_REST'],
]) {
  const choice = game.performQuestAction(structuredClone(active), { questId: quest.id, hostId: 'lodging_tatyana', actionId,
    objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(choice.ok, true, `player can choose ${actionId}: ${choice.reason ?? ''}`);
  const afterAction = choice.state.world.livingEventStates.E15;
  assert.equal(afterAction.stage, expectedStage); assert.equal(afterAction.status, 'ACTIVE');
  assert.equal(choice.state.hosts.lodging_tatyana.healthState.illness.care, expectedCare);
  if (actionId === 'E15_REQUEST_NEIGHBOR_HELP') {
    assert.equal(choice.state.hosts.lodging_tatyana.money.amount, active.hosts.lodging_tatyana.money.amount - 2);
    assert.equal(choice.state.hosts.midwife_avdotya.money.amount, active.hosts.midwife_avdotya.money.amount + 2);
    assert.match(quest.actions.find(item => item.id === actionId).resultKo, /재봉은 늦어져도 괜찮아요.*와 줬으면 해요/,
      'Tatyana speaks hesitantly and politely about the immediate cost to her work');
  }
  const restored = game.loadGame(game.saveGame(choice.state), { maps, hostCards: cards, quests: [quest] });
  assert.equal(restored.world.livingEventStates.E15.stage, expectedStage, 'the selected route survives save and reload');
  const finished = game.advanceNpcWorld(restored, actionId === 'E15_REQUEST_NEIGHBOR_HELP' ? 120 : 45, maps);
  assert.equal(finished.world.livingEventStates.E15.status, 'RESOLVED');
  assert.ok(['RECOVERING', 'FIT'].includes(finished.hosts.lodging_tatyana.healthState.condition));
  if (actionId === 'E15_REQUEST_NEIGHBOR_HELP') {
    assert.equal(finished.world.livingEventStates.E15.stage, 'CARE_COMPLETED');
    assert.ok(finished.world.livingEventStates.E15.actorHostIds.includes('midwife_avdotya'), 'the caregiver physically arrives');
    assert.ok(finished.hosts.midwife_avdotya.needs.fatigue > active.hosts.midwife_avdotya.needs.fatigue, 'travel and visit consume caregiver time');
    const arrival = finished.ledger.flatMap(row => row.livingEvents ?? []).find(row => row.catalogEventId === 'E15' && row.stage === 'MIDWIFE_PRESENT');
    assert.ok(arrival, 'the physical arrival is recorded in the event ledger');
    assert.match(arrival.changeKo, /어디가 제일 불편해\?.*여기 앉아 있을게/,
      'Avdotya answers in short, familiar speech, distinct from Tatyana’s polite request');
  }
  if (actionId === 'E15_KEEP_PRIVATE') assert.deepEqual(finished.world.livingEventStates.E15.witnessHostIds, []);
}

const unattended = game.advanceNpcWorld(active, 121, maps);
assert.equal(unattended.world.livingEventStates.E15.stage, 'RESTED_UNATTENDED');
assert.equal(unattended.world.livingEventStates.E15.resolutionActionId, 'AUTO_REST');
assert.equal(unattended.hosts.lodging_tatyana.healthState.condition, 'RECOVERING');
const restored = game.loadGame(game.saveGame(unattended), { maps, hostCards: cards, quests: [quest] });
assert.equal(restored.hosts.lodging_tatyana.healthState.illness.id, 'FICTIONAL_TRANSIENT_MALAISE');
assert.equal(game.advanceNpcWorld(restored, 181, maps).hosts.lodging_tatyana.healthState.condition, 'FIT');
console.log('E15 sick lodger event, privacy choice, non-diagnostic rest, and save validation passed.');
