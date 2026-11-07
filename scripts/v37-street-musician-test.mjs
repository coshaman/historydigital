import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/street-music-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'courtyard' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 540;
let started = state;
for (let minute = 0; minute < 360 && !started.world.livingEventStates.E38; minute += 1) {
  started = game.advanceNpcWorld(started, 1, maps);
}
const event = started.world.livingEventStates.E38;
assert.equal(event?.catalogEventId, 'E38', `the scheduled Nevsky performance starts as a living event: ${JSON.stringify({ clock: started.world.clockMinutes, host: started.hosts.street_musician_ivan })}`);
assert.equal(event.status, 'ACTIVE'); assert.equal(event.stage, 'PERFORMING');
assert.equal(event.musicianHostId, 'street_musician_ivan');
assert.equal(event.venueMapId, 'nevsky');
assert.ok(started.ledger.some(row => row.moves?.some(move => move.hostId === 'street_musician_ivan' && move.toMapId === 'nevsky')),
  'the musician walks from the courtyard to Nevsky before performing');
assert.ok(started.ledger.at(-1).livingEvents.some(row => row.catalogEventId === 'E38' && row.stage === 'PERFORMING'));
const eventObject = maps.nevsky.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === quest.entry.objectId);
assert.ok(objectIsPresent(eventObject, started, [quest]), 'the instrument and listener choices appear only while the performer is playing');
const listener = started.hosts.street_vendor_matryona;
listener.mapId = 'nevsky'; listener.position = { x: 21, y: 15 };
started.world.currentMapId = 'nevsky';
started.player.embodiment = listener.id; started.player.position = { ...listener.position };
const availableChoices = questChoices(quest, listener.id, [], started);
assert.ok(availableChoices.some(item => item.action.id === 'E38_TIP_MUSICIAN'),
  `E38 choices require the on-site passerby and musician: ${JSON.stringify({ event: started.world.livingEventStates.E38, listener: { map: listener.mapId, position: listener.position }, choices: availableChoices.map(item => item.action.id) })}`);
const cashBefore = { listener: listener.money.amount, musician: started.hosts.street_musician_ivan.money.amount };
const tipped = game.performQuestAction(started, { questId: quest.id, hostId: listener.id, actionId: 'E38_TIP_MUSICIAN', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(tipped.ok, true, `the player can tip the musician at the live performance (${tipped.reason ?? ''})`);
assert.equal(tipped.state.hosts[listener.id].money.amount, cashBefore.listener - 1);
assert.equal(tipped.state.hosts.street_musician_ivan.money.amount, cashBefore.musician + 1);
assert.equal(tipped.state.world.livingEventStates.E38.playerTipHostId, listener.id);
const saved = game.loadGame(game.saveGame(tipped.state), { maps, hostCards: cards, quests: [quest] });
assert.equal(saved.world.livingEventStates.E38.playerTipAmount, 1);

const unattended = game.advanceNpcWorld(started, 60, maps, { pausedHostIds: ['street_musician_ivan', listener.id] });
assert.equal(unattended.world.livingEventStates.E38.status, 'RESOLVED');
assert.equal(unattended.world.livingEventStates.E38.stage, 'TIP_RECEIVED');
assert.equal(unattended.hosts[listener.id].money.amount, cashBefore.listener - 1,
  'an on-site passerby pays without any player action');
assert.equal(unattended.hosts.street_musician_ivan.money.amount, cashBefore.musician + 1);
assert.ok(unattended.ledger.some(row => row.livingEvents?.some(item => item.catalogEventId === 'E38' && item.paidAmount === 1)));

console.log('V37 E38 street performance: scheduled scene, live choice, real tip transfer, unattended audience tip, and save/load passed');
