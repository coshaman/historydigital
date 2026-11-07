import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest, invitationQuest, packet, sourceIndex, register] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/v37-salon-debate-1847.json'), read('../rpg/quests/v37-salon-invitation-1847.json'),
  read('../rpg/data/historical-source-packets.json'),
  read('../rpg/data/source-reader-index.json'), read('../rpg/data/source-register.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const sourceId = 'LIT-BELINSKY-GOGOL-REVIEW-1847';
const source = packet.records.find(item => item.sourceId === sourceId);
assert.equal(source.paragraphs.length, 9, 'the source gives nine consecutive paragraphs of context');
assert.equal(source.range, 'Wikisource lines 142–150, nine consecutive paragraphs in the published review; includes Gogol passages quoted and discussed by Belinsky.');
assert.equal(sourceIndex.records.find(item => item.sourceId === sourceId).pageLocator,
  'Wikisource lines 142–150 · 벨린스키의 논평과 고골 인용이 이어지는 아홉 문단');
assert.ok(register.sources.some(item => item.sourceId === sourceId));
assert.match(source.paragraphs[0].ru, /суждение автора о славянофилах/);
assert.match(source.paragraphs[1].ko, /논쟁이 이미 응접실까지/);
assert.match(source.paragraphs[7].ru, /Многие у нас уже и теперь/);

const map = maps['bookshop-interior'];
const interactions = map.layers.find(layer => layer.name === 'Interactions').objects;
assert.ok(interactions.some(item => item.type === 'source' && item.properties.some(property => property.value === sourceId)));
assert.equal(interactions.find(item => item.id === 4014).properties[0].value, quest.id);
const state = game.createInitialState({ maps, hostCards: cards, quests: [quest, invitationQuest], startMapId: 'bookshop-interior' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 600;
state.world.currentMapId = 'bookshop-interior'; state.player.embodiment = 'reader_darya';
for (const [id, position] of [['reader_darya', { x: 13, y: 11 }], ['student_vasily', { x: 12, y: 12 }], ['editor_sofia', { x: 13, y: 12 }]]) {
  state.hosts[id].mapId = 'bookshop-interior'; state.hosts[id].position = position;
}
state.player.position = { ...state.hosts.reader_darya.position };
const readResult = game.recordSourceRead(state, sourceId, maps);
assert.equal(readResult.ok, true, readResult.reason);
assert.ok(readResult.state.hosts.reader_darya.knownEvidenceIds.includes(sourceId));
let opened = game.advanceWorldTime(readResult.state, 2, maps);
assert.equal(opened.world.livingEventStates.E21.status, 'ACTIVE');
opened = game.advanceWorldTime(opened, 90, maps);
assert.equal(opened.world.livingEventStates.E21.stage, 'DEBATE_READY');
assert.equal(opened.world.livingEventStates.E24, undefined, 'the courtyard circle waits while the source discussion is active');
assert.ok(opened.world.livingEventStates.E21.actorHostIds.every(id => opened.hosts[id].mapId === 'bookshop-interior'),
  `the other readers travel to the bookshop without teleporting: ${JSON.stringify(opened.world.livingEventStates.E21.actorHostIds.map(id => ({ id, mapId: opened.hosts[id].mapId, goal: opened.hosts[id].activeGoal, routine: opened.hosts[id].routineState })))}`);
const lateDiscussion = structuredClone(opened);
lateDiscussion.world.clockMinutes = 810;
const lateCircle = game.advanceWorldTime(lateDiscussion, 2, maps);
assert.equal(lateCircle.world.livingEventStates.E24?.stage, 'INVITATION_POSTED',
  `the courtyard circle remains scheduled after the review window passes: ${JSON.stringify({ date: lateCircle.world.date,
    minute: lateCircle.world.clockMinutes, e21: lateCircle.world.livingEventStates.E21, e24: lateCircle.world.livingEventStates.E24 })}`);
const choices = questChoices(quest, 'reader_darya', opened.hosts.reader_darya.knownEvidenceIds, opened);
assert.deepEqual(choices.map(item => item.action.id), ['E21_DEFEND_EUROPEAN_METHOD']);
const resolved = game.performQuestAction(opened, { questId: quest.id, hostId: 'reader_darya',
  actionId: 'E21_DEFEND_EUROPEAN_METHOD', objectId: 4014 }, { quests: [quest], maps });
assert.equal(resolved.ok, true, resolved.reason);
assert.equal(resolved.state.world.livingEventStates.E21.stage, 'EUROPEAN_METHOD_DEFENDED');
assert.ok(resolved.state.ledger.at(-1).sourceIds.includes(sourceId));
const invitationState = structuredClone(resolved.state);
invitationState.hosts.reader_darya.position = { x: 13, y: 12 };
invitationState.player.position = { x: 13, y: 12 };
assert.equal(invitationState.world.livingEventStates.E29?.stage, 'INVITATION_OFFERED');
const invite = game.performQuestAction(invitationState, { questId: invitationQuest.id, hostId: 'reader_darya',
  actionId: 'E29_ACCEPT_INVITATION', objectId: invitationQuest.entry.objectId }, { quests: [quest, invitationQuest], maps });
assert.equal(invite.ok, true, `the discussion opens the evening invitation (${invite.reason ?? 'unknown reason'})`);
let continued = game.advanceWorldTime(invite.state, 1, maps);
assert.equal(continued.world.livingEventStates.E24?.stage, 'INVITATION_POSTED',
  'the courtyard reading starts after the review discussion and invitation have ended');
const restored = game.loadGame(game.saveGame(continued), { maps, hostCards: cards, quests: [quest, invitationQuest] });
assert.equal(game.stateHash(restored), game.stateHash(continued));
console.log('V37 E21→E29→E24: contextual source, physical discussion, invitation choice, scheduled circle, and save/load passed');
