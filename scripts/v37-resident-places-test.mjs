import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const cardFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.map(file => json(`../rpg/maps/${file}`))).then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.map(file => json(`../rpg/characters/${file}`))),
]);
const fictionalCards = cards.filter(card => card.kind === 'FICTIONAL');
const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });

assert.equal(fictionalCards.length, 37, 'include the event performer as a resident in the world population');
let workLocationCount = 0, scheduledHomeCueCount = 0, sleepLocationCount = 0, explicitResidenceCount = 0, streetSleeperCount = 0;
for (const card of fictionalCards) {
  const host = state.hosts[card.id], places = host.places;
  const workSlots = card.schedule.filter(slot => slot.workAction || slot.task?.type === 'WORK');
  assert.equal(places.status, 'FICTIONAL_GAMEPLAY_PROFILE', `${card.id}: provenance status`);
  assert.equal(places.workLocations.length, workSlots.length, `${card.id}: every authored work activity has a place`);
  if (card.rosterClass === 'EVENT_PERFORMER') {
    assert.ok(card.schedule.some(slot => /연주/.test(slot.activityKo ?? '') && slot.mapId === 'nevsky'),
      `${card.id}: performance routine is authored in the public street scene`);
  } else assert.ok(places.workLocations.length, `${card.id}: work destination is authored in schedule`);
  const hasResidenceOrHomelessness = Boolean(card.residence || card.housing || card.household || places.homeLocation);
  assert.ok(hasResidenceOrHomelessness, `${card.id}: explicit fictional residence or homelessness state`);
  assert.notEqual(places.homeLocationStatus, 'NOT_AUTHORED', `${card.id}: no silently missing home record`);
  const sleepSlot = host.schedule.find(slot => slot.routineKind === 'FICTIONAL_HOME_SLEEP');
  assert.ok(sleepSlot, `${card.id}: daily home/street sleep routine exists`);
  assert.ok(host.allowedMaps.includes(sleepSlot.mapId), `${card.id}: can path to nightly sleep destination`);
  if (card.residence?.kind === 'STREET_SLEEPER') {
    assert.equal(places.homeLocation, null, `${card.id}: homelessness is not represented as an invented house`);
    assert.equal(places.homeLocationStatus, 'FICTIONAL_HOMELESSNESS_DESIGN');
    assert.ok(places.sleepLocations.some(place => place.mapId === card.residence.sleepLocation.mapId), `${card.id}: street sleep location is modeled`);
    streetSleeperCount += 1;
  } else assert.ok(places.homeLocation, `${card.id}: a home address exists`);
  if (card.residence) explicitResidenceCount += 1;
  for (const place of [...places.workLocations, ...places.sleepLocations, ...(places.homeLocation ? [places.homeLocation] : [])]) {
    const map = maps[place.mapId];
    assert.ok(map, `${card.id}: place map ${place.mapId} exists`);
    assert.ok(place.position.x >= 0 && place.position.y >= 0 && place.position.x < map.width && place.position.y < map.height,
      `${card.id}: place is inside ${place.mapId}`);
  }
  workLocationCount += places.workLocations.length;
  scheduledHomeCueCount += places.homeLocation && !card.housing && !card.household ? 1 : 0;
  sleepLocationCount += places.sleepLocations.length;
}
const householdCards = fictionalCards.filter(card => card.household);
const careTasks = fictionalCards.flatMap(card => card.schedule.filter(slot => slot.task?.type === 'CARE_TRANSFER').map(slot => ({ card, task: slot.task })));
assert.equal(householdCards.length, 2, 'the current sample household has two explicitly named members');
assert.equal(careTasks.length, 1, 'the household pilot has one explicitly authored conditional care task');
assert.equal(careTasks[0].task.recipientHostId, 'seamstress_anna');
assert.ok(householdCards.every(card => state.hosts[card.id].places.homeLocationStatus === 'AUTHORED_FICTIONAL_HOUSEHOLD'));
assert.equal(new Set(householdCards.map(card => card.household.id)).size, 1, 'both sisters share one authored household');

const serialized = game.saveGame(state);
const restored = game.loadGame(serialized, { maps, hostCards: cards });
assert.deepEqual(restored.hosts.tenant_mikhail.places, state.hosts.tenant_mikhail.places, 'authored residence/work profile survives save/load');
for (const card of fictionalCards) {
  assert.deepEqual(restored.hosts[card.id].places, state.hosts[card.id].places, `${card.id}: housing/sleep profile survives save/load`);
  assert.deepEqual(restored.hosts[card.id].schedule, state.hosts[card.id].schedule, `${card.id}: overnight routine survives save/load`);
}
console.log(JSON.stringify({ status: 'PASS', fictionalResidents: fictionalCards.length, workLocations: workLocationCount,
  scheduleDerivedHomeCues: scheduledHomeCueCount, sleepLocations: sleepLocationCount,
  explicitResidenceProfiles: explicitResidenceCount, streetSleepers: streetSleeperCount,
  explicitRentContracts: fictionalCards.filter(card => card.housing).length,
  sharedHouseholds: new Set(householdCards.map(card => card.household.id)).size,
  sharedHouseholdResidents: householdCards.length,
  conditionalCareTasks: careTasks.length,
  unresolvedHomeRecords: fictionalCards.filter(card => !state.hosts[card.id].places.homeLocation
    && state.hosts[card.id].places.homeLocationStatus !== 'FICTIONAL_HOMELESSNESS_DESIGN').length,
  saveLoad: 'PASS' }, null, 2));
