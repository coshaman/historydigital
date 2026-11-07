import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles, quest, packet] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read(new URL('../rpg/quests/circle-investigation-1849.json', import.meta.url)),
  read(new URL('../rpg/data/historical-source-packets.json', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url)))),
]);
const reportId = 'OBJ-WS-PETRASHEVSKY-REPORT-1849';
const orderId = 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849';
const report = packet.records.find(row => row.sourceId === reportId);
assert.equal(report.paragraphs.length, 7, 'the report includes seven contiguous paragraphs through the named arrests');
assert.match(report.paragraphs[3].ru, /22 день апреля сего 1849 года/);
assert.match(report.contextKo, /국가 조사 보고서의 서술/);
const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'chancery' });
state.world.chapterId = 'V33_1849_CIRCLE'; state.world.date = '1849-04-22'; state.world.clockMinutes = 539;
state.world.currentMapId = 'chancery'; state.player.embodiment = 'clerk_alexei';
state.hosts.clerk_alexei.mapId = 'chancery'; state.hosts.clerk_alexei.position = { x: 9, y: 9 };
state.player.position = { ...state.hosts.clerk_alexei.position };
const interactions = maps.chancery.layers.find(layer => layer.name === 'Interactions').objects;
const register = interactions.find(item => item.id === quest.entry.objectId);
assert.ok(register);
assert.equal(objectIsPresent(register, state, [quest]), false, 'case register is unavailable before the fixed report reaches the office');

const ongoing = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: ['clerk_alexei'] });
assert.equal(ongoing.world.livingEventStates.E40?.status, 'ACTIVE', 'the historical report event opens on its documented date');
assert.equal(ongoing.world.livingEventStates.E40.stage, 'REPORT_ARRIVED');
assert.equal(ongoing.world.livingEventStates.E40.historicalOutcomeFixed, true);
assert.deepEqual(ongoing.world.livingEventStates.E40.outcomeSourceIds, [reportId, orderId]);
assert.equal(objectIsPresent(register, ongoing, [quest]), true);
assert.ok(ongoing.ledger.some(row => row.livingEvents?.some(event => event.catalogEventId === 'E40'
  && event.stage === 'REPORT_ARRIVED' && event.historicalOutcomeFixed)));

let readable = game.recordSourceRead(ongoing, reportId, maps);
assert.equal(readable.ok, true, readable.reason);
let prepared = readable.state;
prepared.hosts.clerk_alexei.position = { x: 8, y: 9 }; prepared.player.position = { x: 8, y: 9 };
readable = game.recordSourceRead(prepared, orderId, maps);
assert.equal(readable.ok, true, readable.reason);
prepared = readable.state;
prepared.hosts.clerk_alexei.position = { x: 12, y: 11 }; prepared.player.position = { x: 12, y: 11 };
const choices = questChoices(quest, 'clerk_alexei', [reportId, orderId], prepared);
assert.deepEqual(choices.map(row => row.action.id), ['FILE_OFFICIAL_REPORT', 'REFUSE_NAMING', 'REGISTER_SEPARATE_OWNERSHIP']);

for (const [actionId, stage, recordKind] of [
  ['FILE_OFFICIAL_REPORT', 'OFFICIAL_REPORT_FILED', 'OFFICIAL_REGISTER'],
  ['REFUSE_NAMING', 'NAMES_WITHHELD', 'PRIVATE_HOLD_NOTE'],
  ['REGISTER_SEPARATE_OWNERSHIP', 'OWNERSHIP_AND_ORDER_SEPARATED', 'SEPARATE_OWNERSHIP_INDEX'],
]) {
  const result = game.performQuestAction(prepared, { questId: quest.id, hostId: 'clerk_alexei', actionId,
    objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId} resolves with the source in hand (${result.reason ?? 'unknown'})`);
  assert.equal(result.state.world.livingEventStates.E40.status, 'RESOLVED');
  assert.equal(result.state.world.livingEventStates.E40.stage, stage);
  assert.equal(result.state.world.petrashevskyCaseRecord.disposition, recordKind);
  assert.equal(result.state.world.petrashevskyCaseRecord.historicalOutcomeFixed, true);
  assert.equal(result.state.world.immutableOutcomes.PETRASHEVSKY_ARRESTS_1849, quest.historicalOutcome.value);
  assert.equal(objectIsPresent(register, result.state, [quest]), false, 'the physical record stand closes after a disposition');
  assert.ok(result.state.ledger.at(-1)?.livingEvents?.some(event => event.catalogEventId === 'E40'
    && event.stage === stage && event.historicalOutcomeFixed));
  const invalidHost = cards.find(card => !maps[result.state.hosts[card.id].mapId]
    || (!card.allowedMaps.includes(result.state.hosts[card.id].mapId)
      && !(result.state.world.livingEventStates.E24?.organizerHostId === card.id
        && result.state.world.livingEventStates.E24?.actorHostIds?.includes(card.id)
        && result.state.world.livingEventStates.E24?.venueMapId === result.state.hosts[card.id].mapId))
    || result.state.hosts[card.id].privateKnowledgeIds.some(id => !card.privateKnowledgeIds.includes(id)));
  assert.equal(invalidHost, undefined, `all saved residents remain valid: ${invalidHost?.id ?? ''}`);
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.equal(game.stateHash(restored), game.stateHash(result.state), `${actionId} persists through save/load`);
}

const unattended = game.advanceNpcWorld(ongoing, 181, maps, { pausedHostIds: ['clerk_alexei'] });
assert.equal(unattended.world.livingEventStates.E40.status, 'RESOLVED', 'the report is handled when the player does nothing');
assert.equal(unattended.world.livingEventStates.E40.stage, 'AUTO_FILED');
assert.equal(unattended.world.petrashevskyCaseRecord.disposition, 'AUTOMATIC_OFFICIAL_REGISTER');
assert.equal(unattended.world.petrashevskyCaseRecord.historicalOutcomeFixed, true);
assert.ok(unattended.ledger.at(-1)?.livingEvents?.some(event => event.catalogEventId === 'E40'
  && event.stage === 'AUTO_FILED' && event.unattended));
console.log('V37 E40 fixed arrest report, contiguous source, three clerk records, unattended filing, and save/load passed');
