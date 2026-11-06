import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const mapNames = await readdir(new URL('../rpg/maps/', import.meta.url));
const cardNames = await readdir(new URL('../rpg/characters/', import.meta.url));
const [maps, cards, quest] = await Promise.all([
  Promise.all(mapNames.filter(name => name.endsWith('.json')).map(name => read(`../rpg/maps/${name}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardNames.filter(name => name.endsWith('.json')).map(name => read(`../rpg/characters/${name}`))),
  read('../rpg/quests/rent-notice-1847.json'),
]);
const notice = maps.courtyard.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === 1175);
assert.ok(notice, 'the rent notice is a physical courtyard interaction');
let state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'courtyard' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 700;
state.world.livingEventStates.E26 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E26',
  status: 'ACTIVE', stage: 'NOTICE_POSTED', sourceEventId: 'E02', startedAtMinute: 700, closesAtMinute: 880,
  actorHostIds: ['tenant_mikhail', 'landlady_polina'], tenantHostId: 'tenant_mikhail', landlordHostId: 'landlady_polina',
  venueMapId: 'courtyard', scenePosition: { x: 12, y: 7 }, previousRent: 3, proposedRent: 4,
  valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
  validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
state.player.embodiment = 'tenant_mikhail';
state.hosts.tenant_mikhail.mapId = 'courtyard'; state.hosts.tenant_mikhail.position = { x: 11, y: 7 };
state.hosts.landlady_polina.mapId = 'courtyard'; state.hosts.landlady_polina.position = { x: 13, y: 7 };
assert.equal(objectIsPresent(notice, state, [quest]), true);
assert.deepEqual(questChoices(quest, 'tenant_mikhail', [], state).map(row => row.action.id),
  ['E26_KEEP_OLD_RENT', 'E26_ACCEPT_NEW_RENT', 'E26_SHARE_ROOM_COST']);
const accepted = game.performQuestAction(state, { questId: quest.id, hostId: 'tenant_mikhail',
  actionId: 'E26_ACCEPT_NEW_RENT', objectId: notice.id }, { quests: [quest], maps });
assert.equal(accepted.ok, true, `tenant can accept the new rate: ${accepted.reason ?? ''}`);
assert.equal(accepted.state.hosts.tenant_mikhail.housing.amount, 4);
assert.equal(accepted.state.world.livingEventStates.E26.status, 'RESOLVED');
assert.equal(objectIsPresent(notice, accepted.state, [quest]), false);
const saved = game.loadGame(game.saveGame(accepted.state), { maps, hostCards: cards, quests: [quest] });
assert.equal(saved.hosts.tenant_mikhail.housing.amount, 4, 'the rent amount survives save/load');
assert.equal(saved.world.livingEventStates.E26.status, 'RESOLVED', 'the event outcome survives save/load');
console.log('V37 rent notice: physical trigger surface, choices, housing update, and save/load passed');
