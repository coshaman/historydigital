import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [campaign, source, reader, sourceRegister, quest, map, registry, cardsData, startMap] = await Promise.all([
  json('../rpg/quests/campaign.json'), json('../rpg/data/alyosha-source.json'), json('../rpg/data/source-reader-index.json'),
  json('../rpg/data/source-register.json'), json('../rpg/quests/literary-alyosha-1879.json'),
  json('../rpg/maps/alyosha-snegiryov-room.json'), json('../data/era_character_registry.json'),
  Promise.all(['literary_alyosha', 'literary_ilyusha', 'literary_kolya', 'literary_snegiryov']
    .map(id => json(`../rpg/characters/${id}.json`))), json('../rpg/maps/nevsky.json'),
]);

const realm = campaign.literaryRealms.find(item => item.id === 'LITERARY_KARAMAZOV_1879');
assert.ok(realm, 'Alyosha has a distinct late-nineteenth-century literary realm');
assert.equal(realm.mapId, 'alyosha-snegiryov-room');
assert.equal(realm.hostId, 'literary_alyosha');
assert.equal(realm.sourceId, source.sourceId);
assert.equal(realm.realmClass, 'LITERARY_REALM');
assert.equal(realm.date, '1879-01-01');
assert.equal(map.metadata.realmId, realm.id);
assert.equal(map.metadata.datePrecision, 'YEAR');
assert.equal(map.metadata.mapClass, 'LITERARY_REALM');
assert.equal(map.metadata.districtId, undefined);
assert.equal(registry.runtime_profiles.literary_alyosha.realmId, realm.id);
assert.equal(registry.runtime_profiles.literary_alyosha.mapId, realm.mapId);
assert.equal(source.sourceUrl, 'https://rvb.ru/dostoevski/01text/vol10/01br_karamazov/35_2-04.htm');
assert.match(source.range, /Book X, Chapter V.*153–205/);
assert.ok(source.paragraphs.length >= 10, 'the excerpt includes enough consecutive dialogue and its immediate dispute');
assert.ok(source.paragraphs.every(item => item.ru && item.ko));
assert.match(source.paragraphs[0].ru, /Коля уже стоял у постельки Илюши/);
assert.match(source.paragraphs.at(-1).ru, /твоя Жучка/);
assert.equal(reader.records.find(item => item.sourceId === source.sourceId)?.excerptId, source.excerptId);
assert.ok(sourceRegister.sources.some(item => item.sourceId === source.sourceId && item.url === source.sourceUrl));
assert.equal(quest.realmId, realm.id);
assert.equal(quest.entry.mapId, realm.mapId);
assert.ok(quest.actions.length >= 3);
assert.ok(quest.actions.every(action => action.requiredKnowledgeId === source.sourceId));
const sourceObject = map.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.type === 'source');
assert.ok(sourceObject, 'the passage can be read as a physical book inside the room');
assert.ok(quest.actions.every(action => action.subcopyKo && action.effects?.situationKo));
const actors = decorateCardsWithEraProfiles(cardsData, registry);
assert.equal(actors[0].eraProfile.realmId, realm.id);
assert.ok(actors.every(card => card.allowedMaps.length === 1 && card.allowedMaps[0] === realm.mapId));
assert.ok(actors[0].sourceIds.includes(source.sourceId));
assert.equal(game.nearTile(actors[0].start, { x: sourceObject.x / 16, y: sourceObject.y / 16 }), true,
  'Alyosha can reach the book without a long walk');

const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const allMaps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const item = await json(`../rpg/maps/${file}`); return [item.mapId, item];
})));
let state = game.createInitialState({ maps: allMaps, hostCards: actors, quests: [quest], startMapId: 'nevsky' });
assert.equal(state.hosts.literary_ilyusha.healthState.condition, 'UNWELL', 'the bedbound story state carries into the room');
assert.equal(game.enterLiteraryRealm(state, map, actors[0]).reason, 'literary_source_unread');
const archiveRead = game.recordSourceRead(state, source.sourceId, allMaps, [source.sourceId], 'PLAYER_ARCHIVE');
assert.equal(archiveRead.ok, true, `archive reading discovers the realm's passage (${archiveRead.reason})`);
state = archiveRead.state;
const entered = game.enterLiteraryRealm(state, map, actors[0]);
assert.equal(entered.ok, true, 'the source opens the novel realm');
state = game.possessHost(entered.state, actors[0].id, map).state;
assert.equal(state.world.date, '1879-01-01');
assert.equal(state.world.currentMapId, realm.mapId);
assert.equal(state.player.embodiment, 'literary_alyosha');
const physicalRead = game.recordSourceRead(state, source.sourceId, allMaps);
assert.equal(physicalRead.ok, true, `the passage remains readable in its literary setting (${physicalRead.reason})`);
state = physicalRead.state;
const action = game.performQuestAction(state, { questId: quest.id, hostId: 'literary_alyosha',
  actionId: 'KEEP_KOLYA_PROMISE', objectId: quest.entry.objectId }, { quests: [quest], maps: allMaps });
assert.equal(action.ok, true, `Alyosha's sourced response resolves in the room (${action.reason})`);
assert.equal(action.state.quests[quest.id].status, 'resolved');
assert.equal(action.state.world.date, '1879-01-01', 'literary time stays within the novel route');
const left = game.leaveLiteraryRealm(action.state, allMaps);
assert.equal(left.ok, true);
assert.equal(left.state.world.date, '1847-06-01', 'leaving restores the historical campaign date');
assert.equal(left.state.player.embodiment, null);
console.log(JSON.stringify({ status: 'PASS', realm: realm.id, sourceParagraphs: source.paragraphs.length,
  possessableActors: actors.length, actions: quest.actions.length, checks: ['separate literary era', 'source-gated entry', 'Alyosha possession', 'source-backed scene response', 'campaign return'] }, null, 2));
