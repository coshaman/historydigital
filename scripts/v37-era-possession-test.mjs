import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const [registry, files] = await Promise.all([json('../data/era_character_registry.json'), readdir(new URL('../rpg/characters/', import.meta.url))]);
const rawCards = await Promise.all(files.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`)));
const cards = decorateCardsWithEraProfiles(rawCards, registry);
const maps = Object.fromEntries(await Promise.all(['nevsky','printshop','chancery','courtyard','market-quay','police-station','dead-souls','overcoat','raskolnikov-tavern'].map(async id => [id, await json(`../rpg/maps/${id}.json`)])));
const byId = Object.fromEntries(cards.map(card => [card.id, card]));

assert.equal(cards.length, rawCards.length);
assert.ok(cards.every(card => card.eraProfile?.layer && card.eraProfile.allowedChapterIds.length), 'every runtime host has an era boundary');
for (const id of ['literary_chichikov','literary_akaky','literary_petrovich','literary_raskolnikov','literary_marmeladov']) {
  const profile = byId[id].eraProfile;
  assert.equal(profile.layer, 'LITERARY');
  assert.ok(profile.realmId && profile.sourceIds.length);
}

const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
for (const card of cards.filter(item => item.kind === 'FICTIONAL')) {
  const candidate = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
  const host = candidate.hosts[card.id];
  candidate.world.currentMapId = host.mapId;
  candidate.player.position = { ...host.position };
  assert.equal(game.possessHost(candidate, card.id, maps[host.mapId]).ok, true, `${card.id} is possessable in the campaign era`);
}
const nekrasov = state.hosts.nekrasov_reconstruction;
state.world.currentMapId = nekrasov.mapId = 'printshop';
state.player.position = { ...nekrasov.position };
assert.deepEqual(game.possessHost(state, nekrasov.id, maps.printshop).reason, 'era_layer_mismatch', 'a reconstruction cannot be possessed from 1847');
state.world.chapterId = 'V33_1848_PUBLIC';
assert.equal(game.possessHost(state, nekrasov.id, maps.printshop).ok, true, 'scenario-gated reconstruction is accessible in its allowed chapter');

const literaryState = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
const chichikov = literaryState.hosts.literary_chichikov;
literaryState.world.currentMapId = 'dead-souls';
literaryState.player.position = { ...chichikov.position };
assert.equal(game.possessHost(literaryState, chichikov.id, maps['dead-souls']).reason, 'era_layer_mismatch', 'literary host is blocked outside a labeled realm');
literaryState.world.activeRealm = { id: 'LITERARY_DEAD_SOULS', mapClass: 'LITERARY_REALM', sourceIds: ['LIT-GOGOL-DEAD-SOULS-1842'] };
assert.equal(game.possessHost(literaryState, chichikov.id, maps['dead-souls']).ok, true, 'literary host can be possessed inside the exact source realm');
literaryState.world.activeRealm.id = 'LITERARY_OVERCOAT';
assert.equal(game.possessHost(literaryState, chichikov.id, maps['dead-souls']).reason, 'era_layer_mismatch', 'literary hosts cannot cross between unrelated literary worlds');
for (const card of cards.filter(item => item.kind === 'LITERARY')) {
  const realmState = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
  const host = realmState.hosts[card.id], realmId = card.eraProfile.realmId;
  realmState.world.currentMapId = host.mapId;
  realmState.world.activeRealm = { id: realmId, mapClass: 'LITERARY_REALM', sourceIds: [...card.eraProfile.sourceIds] };
  realmState.player.position = { ...host.position };
  assert.equal(game.possessHost(realmState, card.id, maps[host.mapId]).ok, true, `${card.id} is possessable in its exact realm`);
}

console.log(JSON.stringify({ status: 'PASS', runtimeHosts: cards.length, profiles: Object.fromEntries([...new Set(cards.map(card => card.eraProfile.layer))].map(layer => [layer, cards.filter(card => card.eraProfile.layer === layer).length])), checks: ['registry coverage','all 36 fictional campaign hosts possessable','1847 historical reconstruction block','1848 scenario gate','all five literary realm character gates','cross-realm block'] }, null, 2));
