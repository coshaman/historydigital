import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, characterFiles, registry, quest, campaign, sources, sourceIndex, investigation, letter] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  json('../data/era_character_registry.json'), json('../rpg/quests/dostoevsky-execution-1849.json'),
  json('../rpg/quests/campaign.json'), json('../rpg/data/historical-source-packets.json'),
  json('../rpg/data/source-reader-index.json'),
  json('../rpg/quests/circle-investigation-1849.json'), json('../rpg/quests/circle-letter-1849-may.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(characterFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`))),
]);
const sourceId = 'OBJ-WS-DOSTOEVSKY-LETTER-1849-DEC22';
const actor = cards.find(card => card.id === 'dostoevsky_1849');
assert.ok(actor, 'the historical scene has a dedicated runtime host');
assert.equal(actor.kind, 'HISTORICAL_RECONSTRUCTION');
assert.equal(actor.presenceWindow.startDate, '1849-12-22');
assert.equal(registry.runtime_profiles.dostoevsky_1849.layer, 'HISTORICAL_RECONSTRUCTION');
assert.ok(registry.runtime_profiles.dostoevsky_1849.sourceIds.includes(sourceId));
assert.ok(decorateCardsWithEraProfiles(cards, registry).some(card => card.id === actor.id && card.eraProfile.allowedChapterIds.includes(quest.chapterId)));
assert.equal(quest.date, '1849-12-22');
assert.deepEqual(campaign.arcs.find(arc => arc.id === quest.chapterId).questIds.slice(-1), [quest.id]);
assert.deepEqual(quest.historicalOutcome.sourceIds, [sourceId]);
assert.equal(sources.records.find(record => record.sourceId === sourceId).range,
  'РВБ, строки 115–117: датировка и два последовательных абзаца письма № 37 от 22 декабря 1849 года.');
const executionSource = sources.records.find(record => record.sourceId === sourceId);
assert.equal(executionSource.paragraphs.length, 2, 'the source packet preserves the two consecutive event paragraphs');
assert.match(executionSource.paragraphs[0].ru, /Сегодня 22 декабря нас отвезли на Семеновский плац/);
assert.match(executionSource.paragraphs[1].ru, /Наконец ударили отбой.*Затем последовали настоящие приговоры/s);
assert.match(executionSource.paragraphs[0].ko, /흰 셔츠/);
assert.doesNotMatch(quest.fixedEvent.trigger, /10:00/);
assert.ok(sourceIndex.records.some(record => record.sourceId === sourceId));
assert.equal(maps['semenovsky-square'].metadata.date, quest.date);
assert.ok(maps['semenovsky-square'].layers.find(layer => layer.name === 'Interactions').objects.some(object => object.type === 'quest-object' && object.properties.some(property => property.name === 'questId' && property.value === quest.id)));
const squareExit = maps.nevsky.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.name === '세묘노프스키 광장으로');
assert.ok(squareExit, 'the player has a physical route to the dated scene');

const quests = [investigation, letter, quest];
const state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
state.world.chapterId = quest.chapterId;
state.world.date = '1849-05-05';
state.world.currentMapId = 'semenovsky-square';
state.player.position = { x: 14, y: 15 };
state.quests[investigation.id].status = 'resolved';
state.quests[letter.id].status = 'resolved';
assert.equal(game.recordSourceRead(state, sourceId, maps).ok, false, 'the letter is not accessible before its date');
assert.equal(objectIsPresent(squareExit, state, quests), false, 'the route is closed before the date');
assert.equal(state.hosts.dostoevsky_1849.historicalAliveAndPresent, false, 'he cannot appear in the 1847 opening');
state.world.currentMapId = 'nevsky';
const advanced = game.advanceCampaignDate(state, quest.date, campaign, quests);
assert.equal(advanced.ok, true, advanced.reason);
assert.equal(advanced.state.hosts.dostoevsky_1849.historicalAliveAndPresent, true);
assert.equal(advanced.state.world.livingEventStates.E41.status, 'SCHEDULED');
assert.equal(objectIsPresent(squareExit, advanced.state, quests), true, 'the route opens on the documented date');
const reachedSquare = game.transitionMap(advanced.state, 'nevsky-semenovsky-square', maps);
assert.equal(reachedSquare.ok, true, reachedSquare.reason);
assert.equal(reachedSquare.state.world.currentMapId, 'semenovsky-square');
const started = game.advanceNpcWorld(advanced.state, 60, maps);
assert.equal(started.world.livingEventStates.E41.status, 'ACTIVE');
assert.equal(started.world.livingEventStates.E41.stage, 'MOCK_EXECUTION_PREPARATION');
const object = maps['semenovsky-square'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.type === 'quest-object');
assert.equal(objectIsPresent(object, started, [quest]), true);
assert.ok(questChoices(quest, 'dostoevsky_1849', [], started).every(row => row.missingSourceId === sourceId));
started.world.currentMapId = 'semenovsky-square';
started.player.embodiment = 'dostoevsky_1849';
const read = game.recordSourceRead(started, sourceId, maps);
assert.equal(read.ok, true, read.reason);
assert.ok(questChoices(quest, 'dostoevsky_1849', game.knowledgeForHost(read.state, 'dostoevsky_1849'), read.state).every(row => !row.missingSourceId));
const chosen = game.performQuestAction(read.state, { questId: quest.id, hostId: 'dostoevsky_1849', actionId: 'KEEP_PRIVATE_NOTE', objectId: quest.entry.objectId }, { quests, maps });
assert.equal(chosen.ok, true, chosen.reason);
assert.equal(chosen.state.world.livingEventStates.E41.status, 'ACTIVE', 'private recording does not change the fixed historical sequence');
assert.equal(chosen.state.world.livingEventStates.E41.playerChoiceActionId, 'KEEP_PRIVATE_NOTE');

const unattended = game.advanceNpcWorld(structuredClone(started), 181, maps);
assert.equal(unattended.world.livingEventStates.E41.status, 'RESOLVED');
assert.equal(unattended.world.livingEventStates.E41.stage, 'COMMUTATION_ANNOUNCED');
assert.equal(unattended.quests[quest.id].status, 'resolved');
assert.ok(unattended.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E41' && row.unattended && row.historicalOutcomeFixed));
assert.ok(!chosen.state.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E41' && row.unattended));
const restored = game.loadGame(game.saveGame(unattended), { maps, hostCards: cards, quests });
assert.equal(game.stateHash(restored), game.stateHash(unattended), 'historical outcome and unattended record persist through save/load');
console.log('V37 E41 execution scene: PASS (date gate, host era, live scene, choices, unattended outcome, save/load)');
