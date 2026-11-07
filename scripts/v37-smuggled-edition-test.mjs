import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [mapFiles, cardFiles, catalog, censorshipQuest, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read(new URL('../data/event_catalog_45.json', import.meta.url)),
  read(new URL('../rpg/quests/censored-page-1847.json', import.meta.url)),
  read(new URL('../rpg/quests/smuggled-edition-1847.json', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/maps/${file}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(row => [row.mapId, row]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(new URL(`../rpg/characters/${file}`, import.meta.url)))),
]);
const eventObject = maps['bookshop-interior'].layers.find(row => row.name === 'Interactions').objects
  .find(row => row.id === quest.entry.objectId);
assert.ok(eventObject, 'E34 has a physical bookshop interaction');
assert.equal(catalog.find(row => row.event_id === 'E34')?.validation_status, 'DESIGN_SEED_NOT_VERIFIED');
const initial = game.createInitialState({ maps, hostCards: cards, quests: [censorshipQuest, quest], startMapId: 'printshop' });
initial.world.chapterId = 'V33_1847_PRINT'; initial.world.date = '1847-06-01';
initial.world.currentMapId = 'printshop';
const noCopy = game.advanceNpcWorld(initial, 1, maps);
assert.equal(noCopy.world.livingEventStates.E34, undefined, 'E34 cannot start without E06 producing a private copy');

let state = initial;
for (let minute = 0; minute < 1200 && state.world.livingEventStates.E06?.status !== 'ACTIVE'; minute += 5) {
  state = game.advanceNpcWorld(state, 5, maps);
}
assert.equal(state.world.livingEventStates.E06?.status, 'ACTIVE', 'the existing scheduled proof path produces E06');
const proof = maps.printshop.layers.find(row => row.name === 'Interactions').objects.find(row => row.id === 1174);
assert.ok(proof);
state.hosts.typesetter_nikita.mapId = 'printshop';
state.hosts.typesetter_nikita.position = { x: proof.x / 16, y: proof.y / 16 };
state.world.currentMapId = 'printshop'; state.player.embodiment = 'typesetter_nikita';
state.player.position = { ...state.hosts.typesetter_nikita.position };
const kept = game.performQuestAction(state, { questId: censorshipQuest.id, hostId: 'typesetter_nikita',
  actionId: 'E06_KEEP_COPY', objectId: censorshipQuest.entry.objectId }, { quests: [censorshipQuest, quest], maps });
assert.equal(kept.ok, true, `E06 private-copy choice: ${kept.reason ?? ''}`);
assert.ok(kept.state.hosts.typesetter_nikita.inventory.includes('삭제 표시가 남은 교정쇄 사본'));
state = game.releaseHost(kept.state, maps.printshop).state;
let ready = state;
for (let minute = 0; minute < 360 && ready.world.livingEventStates.E34?.stage !== 'READING_READY'; minute += 5) {
  ready = game.advanceNpcWorld(ready, 5, maps);
}
const event = ready.world.livingEventStates.E34;
assert.equal(event?.status, 'ACTIVE', 'the E06 private copy causes the bookshop scene');
assert.equal(event.stage, 'READING_READY', 'the carrier, bookseller, student and watchman travel to the shelf');
assert.equal(event.itemLocation, 'UNDER_BOOKSHOP_SHELF');
assert.ok(!ready.hosts.typesetter_nikita.inventory.includes('삭제 표시가 남은 교정쇄 사본'));
assert.equal(objectIsPresent(eventObject, ready, [censorshipQuest, quest]), true);
assert.ok(ready.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E34' && row.stage === 'READING_READY'));
const unattended = structuredClone(ready);
unattended.world.clockMinutes = unattended.world.livingEventStates.E34.resolvesAtMinute;
const autoReturned = game.advanceNpcWorld(unattended, 1, maps);
assert.equal(autoReturned.world.livingEventStates.E34.stage, 'COPY_RETURNED');
assert.equal(autoReturned.world.livingEventStates.E34.itemLocation, 'WITH_TYPESETTER');
assert.ok(autoReturned.hosts.typesetter_nikita.inventory.includes('삭제 표시가 남은 교정쇄 사본'));
assert.equal(game.stateHash(game.loadGame(game.saveGame(autoReturned), { maps, hostCards: cards,
  quests: [censorshipQuest, quest] })), game.stateHash(autoReturned), 'unattended return survives save/load');

for (const [hostId, actionId] of [['bookseller_lev', 'E34_HIDE_COPY'],
  ['student_vasily', 'E34_COMPARE_MARKS'], ['junior_guard_sergey', 'E34_REPORT_SHEET']]) {
  const branch = structuredClone(ready); branch.world.currentMapId = 'bookshop-interior';
  branch.hosts[hostId].position = { x: eventObject.x / 16, y: eventObject.y / 16 };
  branch.hosts[hostId].mapId = 'bookshop-interior';
  branch.player.embodiment = hostId; branch.player.position = { ...branch.hosts[hostId].position };
  const options = questChoices(quest, hostId, [], branch);
  assert.deepEqual(options.map(row => row.action.id), [actionId]);
  assert.ok(options[0].action.subcopyKo.length > 10);
  const result = game.performQuestAction(branch, { questId: quest.id, hostId, actionId, objectId: quest.entry.objectId },
    { quests: [censorshipQuest, quest], maps });
  assert.equal(result.ok, true, `${actionId}: ${result.reason ?? ''}`);
  assert.equal(result.state.world.livingEventStates.E34.status, 'RESOLVED');
  const record = result.state.world.smuggledEditionRecords.at(-1);
  assert.equal(record.actionId, actionId);
  if (actionId === 'E34_HIDE_COPY') assert.ok(result.state.hosts.bookseller_lev.inventory.includes('삭제 표시가 남은 교정쇄 사본'));
  if (actionId === 'E34_REPORT_SHEET') {
    assert.ok(result.state.hosts.junior_guard_sergey.inventory.includes('삭제 표시가 남은 교정쇄 사본'));
    assert.ok(result.state.world.officialBookshopReports.at(-1));
  }
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [censorshipQuest, quest] });
  assert.equal(game.stateHash(restored), game.stateHash(result.state));
}
console.log('E34 E06-causal copy travel, role-specific handling, local/official records and save/load passed');
