import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { dialogueSceneContext } from '../rpg/engine/dialogue-context.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, questFiles, districts] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)),
  readdir(new URL('../rpg/characters/', import.meta.url)),
  readdir(new URL('../rpg/quests/', import.meta.url)),
  readJson('../rpg/data/city-districts-v36.json'),
]);
const [maps, allCards, quests] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => readJson(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => readJson(`../rpg/characters/${file}`))),
  Promise.all(questFiles.filter(file => file.endsWith('.json')).map(file => readJson(`../rpg/quests/${file}`))),
]);
const ids = [...new Set([...districts.districts.flatMap(district => district.residentIds ?? []), 'street_musician_ivan'])];
const cards = ids.map(id => allCards.find(card => card.id === id));
const cardById = new Map(allCards.map(card => [card.id, card]));
assert.equal(ids.length, 37, 'the player-free sample includes the active city residents');
assert.ok(cards.every(Boolean), 'every simulated resident has an authored character card');

let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky', simulationSeed: 1847 });
state.hosts.street_musician_ivan.historicalAliveAndPresent = false;
assert.equal(state.player.embodiment, null, 'the player starts outside every resident');
state = game.advanceNpcWorld(state, 1440, maps);
assert.equal(state.player.embodiment, null, 'NPC events run while the player remains unembodied');

const rows = state.ledger.flatMap(entry => entry.livingEvents ?? [])
  .filter(row => row.catalogIdSpace === 'V37_EVENT_CATALOG_45');
const eventIds = [...new Set(rows.map(row => row.catalogEventId))];
assert.ok(eventIds.length >= 10,
  `at least ten distinct catalog events should occur without player input; found ${eventIds.length}: ${eventIds.join(', ')}`);

const discoverable = eventIds.flatMap(catalogEventId => {
  const informedHosts = ids.filter(hostId => state.hosts[hostId].heardEventReports
    ?.some(report => report.catalogEventId === catalogEventId));
  return informedHosts.some(hostId => dialogueSceneContext(cardById.get(hostId), state.hosts[hostId],
    state.world.date, state.hosts[hostId].mapId).heardEvents.some(report => report.catalogEventId === catalogEventId))
    ? [catalogEventId] : [];
});
assert.ok(discoverable.length >= 10,
  `at least ten unplayed event IDs should later be discoverable through resident dialogue context; found ${discoverable.length}: ${discoverable.join(', ')}`);

const relayedEventIds = new Set(state.ledger.flatMap(entry => entry.personalContacts ?? [])
  .map(contact => contact.sharedReport?.catalogEventId).filter(Boolean));
assert.ok(relayedEventIds.size >= 5,
  `at least five player-free events should travel through resident conversation; found ${relayedEventIds.size}: ${[...relayedEventIds].join(', ')}`);

const restored = game.loadGame(game.saveGame(state), { maps, hostCards: cards, quests });
assert.equal(game.stateHash(restored), game.stateHash(state), 'event history and resident knowledge survive save/load');
for (const catalogEventId of discoverable) {
  assert.ok(ids.some(hostId => restored.hosts[hostId].heardEventReports
    ?.some(report => report.catalogEventId === catalogEventId)),
  `${catalogEventId} remains discoverable after loading the player-free simulation`);
}

console.log(`V37 player-free event discovery: PASS (${eventIds.length} events occurred, ${discoverable.length} remain available in dialogue, ${relayedEventIds.size} spread between residents, save/load exact)`);
