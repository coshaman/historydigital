import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles, quest, discussionQuest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read(new URL('../rpg/quests/v37-salon-invitation-1847.json', import.meta.url)),
  read(new URL('../rpg/quests/v37-salon-debate-1847.json', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url)))),
]);
const sourceId = 'LIT-BELINSKY-GOGOL-REVIEW-1847';
let state = game.createInitialState({ maps, hostCards: cards, quests: [discussionQuest, quest], startMapId: 'bookshop-interior' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 840;
state.world.currentMapId = 'bookshop-interior'; state.player.embodiment = 'reader_darya';
for (const id of ['reader_darya', 'student_vasily', 'editor_sofia']) {
  state.hosts[id].mapId = 'bookshop-interior'; state.hosts[id].position = { x: 13, y: 12 };
}
state.player.position = { ...state.hosts.reader_darya.position };
const object = maps['bookshop-interior'].layers.find(layer => layer.name === 'Interactions').objects
  .find(item => item.id === quest.entry.objectId);
assert.ok(object, 'the invitation has a physical paper object in the bookshop');
assert.equal(objectIsPresent(object, state, [quest]), false, 'the invitation stays hidden before the readers finish their discussion');
const sourceRead = game.recordSourceRead(state, sourceId, maps);
assert.equal(sourceRead.ok, true, sourceRead.reason);
state = game.advanceWorldTime(sourceRead.state, 2, maps);
state = game.advanceWorldTime(state, 90, maps);
assert.equal(state.world.livingEventStates.E21?.stage, 'DEBATE_READY', 'the three readers gather after a verified source is opened');
const debate = game.performQuestAction(state, { questId: discussionQuest.id, hostId: 'reader_darya',
  actionId: 'E21_DEFEND_EUROPEAN_METHOD', objectId: discussionQuest.entry.objectId }, { quests: [discussionQuest, quest], maps });
assert.equal(debate.ok, true, debate.reason);
const triggered = debate.state;
assert.equal(triggered.world.livingEventStates.E29?.status, 'ACTIVE', 'the source-based discussion causes the invitation');
assert.equal(triggered.world.livingEventStates.E29.trigger, 'sofia_invites_the_readers_after_belinsky_review_discussion');
assert.equal(triggered.world.livingEventStates.E29.stage, 'INVITATION_OFFERED');
assert.equal(objectIsPresent(object, triggered, [quest]), true, 'the invitation paper appears after it is offered');
assert.ok(!triggered.hosts.bookseller_lev.knownEvidenceIds.includes(sourceId), 'the literary source is not granted to a resident who was not present');
const choices = questChoices(quest, 'reader_darya', [sourceId], triggered);
assert.deepEqual(choices.map(row => row.action.id), ['E29_ACCEPT_INVITATION', 'E29_DECLINE_INVITATION', 'E29_REQUEST_SHARED_READING']);

for (const [actionId, stage] of [
  ['E29_ACCEPT_INVITATION', 'INVITATION_ACCEPTED'],
  ['E29_DECLINE_INVITATION', 'INVITATION_DECLINED'],
  ['E29_REQUEST_SHARED_READING', 'TEXT_COPIES_REQUESTED'],
]) {
  const branch = structuredClone(triggered);
  const result = game.performQuestAction(branch, { questId: quest.id, hostId: 'reader_darya', actionId,
    objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId} resolves at the physical invitation (${result.reason ?? 'unknown'})`);
  const event = result.state.world.livingEventStates.E29;
  assert.equal(event.status, 'RESOLVED'); assert.equal(event.stage, stage);
  assert.ok(result.state.hosts.reader_darya.personalEventNotes.some(note => note.eventId === 'E29'));
  if (actionId === 'E29_ACCEPT_INVITATION') {
    assert.ok(result.state.hosts.reader_darya.inventory.includes('저녁 독서회 초대장'));
    assert.equal(result.state.world.readingCircleAccess?.reader_darya, 'INVITED');
  }
  if (actionId === 'E29_REQUEST_SHARED_READING') {
    assert.ok(result.state.hosts.editor_sofia.inventory.includes('독서회에서 함께 볼 서평 사본'));
    assert.ok(result.state.hosts.student_vasily.personalEventNotes.some(note => note.eventId === 'E29'));
  }
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.equal(game.stateHash(restored), game.stateHash(result.state), `${actionId} persists through save/load`);
}
console.log('V37 E29 source-based invitation, physical note, distinct responses, audience, and save/load passed');
