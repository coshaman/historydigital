import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [campaign, source, reader, sourceRegister, quest, map, registry, card, marmeladov, startMap] = await Promise.all([
  json('../rpg/quests/campaign.json'),
  json('../rpg/data/raskolnikov-source.json'),
  json('../rpg/data/source-reader-index.json'),
  json('../rpg/data/source-register.json'),
  json('../rpg/quests/literary-raskolnikov.json'),
  json('../rpg/maps/raskolnikov-tavern.json'),
  json('../data/era_character_registry.json'),
  json('../rpg/characters/literary_raskolnikov.json'),
  json('../rpg/characters/literary_marmeladov.json'),
  json('../rpg/maps/nevsky.json')
]);

const realm = campaign.literaryRealms.find(item => item.id === 'LITERARY_RASKOLNIKOV_1866');
const runtimeCards = decorateCardsWithEraProfiles([card, marmeladov], registry);
assert.ok(realm, 'the 1860s novel has an independent campaign entry');
assert.equal(realm.mapId, 'raskolnikov-tavern');
assert.equal(realm.sourceId, source.sourceId);
assert.equal(map.metadata.realmId, realm.id);
assert.equal(map.metadata.mapId, map.mapId);
assert.equal(map.metadata.date, '1866-01-01');
assert.equal(map.metadata.datePrecision, 'YEAR');
assert.equal(map.metadata.dateDisplayKo, '1866년');
assert.equal(map.metadata.mapClass, 'LITERARY_REALM');
assert.equal(map.metadata.districtId, undefined, 'the literary tavern has no inherited 1847 housing district');
assert.equal(map.metadata.access, undefined, 'the literary scene does not inherit 1847 lodging restrictions');
assert.ok(map.layers.some(layer => layer.type === 'objectgroup' && layer.objects.some(object => object.name.includes('마르멜라도프'))));
assert.match(card.objectiveByChapter[realm.id], /마르멜라도프/);
assert.equal(card.start.mapId, realm.mapId);
assert.equal(runtimeCards[0].eraProfile.layer, 'LITERARY');
assert.equal(runtimeCards[0].eraProfile.sourceIds[0], source.sourceId);
assert.equal(registry.runtime_profiles.literary_raskolnikov.realmId, realm.id);
assert.equal(registry.runtime_profiles.literary_raskolnikov.mapId, realm.mapId);
assert.equal(source.paragraphs.length, 17, 'the source preserves every contiguous paragraph in RVB lines 121–146');
assert.ok(source.paragraphs.every(item => item.ru && item.ko), 'Russian witness and new Korean translation remain aligned');
assert.match(source.range, /121–146/);
assert.match(source.paragraphs[0].ru, /Наконец он прямо посмотрел на Раскольникова/);
assert.match(source.paragraphs[1].ru, /Мармеладов — такая фамилия/);
assert.match(source.paragraphs.at(-1).ru, /дочь моя по желтому билету живет/);
assert.ok(source.paragraphs.findIndex(item => item.ru.includes('нищета, милостивый государь')) < source.paragraphs.findIndex(item => item.ru.includes('денег взаймы безнадежно')));
assert.equal(reader.records.find(item => item.sourceId === source.sourceId)?.excerptId, source.excerptId);
assert.ok(sourceRegister.sources.some(item => item.sourceId === source.sourceId && item.url === source.sourceUrl));
assert.equal(quest.realmId, realm.id);
assert.ok(quest.actions.length >= 3, 'the scene offers multiple materially distinct responses');
assert.ok(quest.actions.every(action => action.subcopyKo && action.effects?.situationKo), 'choices expose practical direction and consequences');
assert.ok(quest.actions.every(action => action.requiredKnowledgeId === source.sourceId), 'the verified text gates the literary scene');

const cards = runtimeCards;
const maps = { nevsky: startMap, [map.mapId]: map };
let state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });
assert.equal(game.enterLiteraryRealm(state, map, cards[0]).reason, 'literary_source_unread');
state = game.recordSourceRead(state, source.sourceId, maps, [source.sourceId], 'PLAYER_ARCHIVE').state;
const entered = game.enterLiteraryRealm(state, map, cards[0]);
assert.equal(entered.ok, true, 'reading the literary source unlocks its realm');
state = entered.state;
assert.equal(state.world.date, '1866-01-01', 'realm time advances into its own decade');
const possessed = game.possessHost(state, card.id, map);
assert.equal(possessed.ok, true, 'the player can inhabit Raskolnikov inside the realm');
state = game.recordSourceRead(possessed.state, source.sourceId, maps).state;
const action = game.performQuestAction(state, { questId: quest.id, hostId: card.id, actionId: 'ASK_WHY_GO', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(action.ok, true, `a source-informed response resolves in the tavern (got ${action.reason})`);
assert.equal(action.state.quests[quest.id].status, 'resolved');
const left = game.leaveLiteraryRealm(action.state, maps);
assert.equal(left.ok, true);
assert.equal(left.state.world.date, '1847-06-01', 'leaving restores the campaign date');

const [mapFiles, cardFiles] = await Promise.all([readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url))]);
const allMaps = Object.fromEntries(await Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(async file => {
  const item = await json(`../rpg/maps/${file}`); return [item.mapId, item];
})));
const allCards = decorateCardsWithEraProfiles(await Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`))), registry);
const oldRosterState = game.createInitialState({ maps: allMaps, hostCards: allCards, quests: [], startMapId: 'nevsky' });
delete oldRosterState.hosts.literary_marmeladov;
const migrated = game.loadGame(game.saveGame(oldRosterState), { maps: allMaps, hostCards: allCards, quests: [quest] });
assert.ok(migrated.hosts.literary_marmeladov, 'older saves receive newly registered hosts without losing existing progress');

console.log(JSON.stringify({ status: 'PASS', realm: realm.id, contiguousSourceParagraphs: source.paragraphs.length, choices: quest.actions.length, checks: ['source gated entry','1866 realm date','possession','source-backed response','campaign date restored','older save roster migration'] }));
