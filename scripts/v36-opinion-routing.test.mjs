import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { guideToResident } from '../rpg/engine/quest-guidance.mjs';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const map = await readJson(`rpg/maps/${file}`);
  return [map.mapId, map];
})));
const ids = ['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','senior_clerk_konstantin',
  'reader_darya','editor_sofia','police_sergeant_ivan','yardkeeper_semyon','laundress_mariya','baker_fyodor','market_nadezhda','porter_gavrila'];
const hostCards = await Promise.all(ids.map(id => readJson(`rpg/characters/${id}.json`)));

test('an opinion inquiry points to its respondent across a real exit and explains possession correctly', () => {
  const state = game.createInitialState({ maps, hostCards, startMapId: 'nevsky' });
  const guide = guideToResident({ state, maps, hostCards, targetHostId: 'editor_sofia' });
  assert.equal(guide.blocked, false);
  assert.equal(guide.target.kind, 'exit');
  assert.equal(guide.target.finalMapId, 'printshop');
  assert.ok(Number.isInteger(guide.target.objectId));
  assert.match(guide.howKo, /출구/);

  state.player.embodiment = 'market_nadezhda';
  state.world.currentMapId = 'nevsky';
  state.hosts.market_nadezhda.mapId = 'nevsky';
  state.hosts.market_nadezhda.position = { x: 19, y: 13 };
  const restrictedGuide = guideToResident({ state, maps, hostCards, targetHostId: 'editor_sofia' });
  assert.equal(restrictedGuide.blocked, false);
  assert.equal(restrictedGuide.requiresRelease, true);
  assert.equal(restrictedGuide.target, null, 'do not pin an exit the current body cannot use');
  assert.match(restrictedGuide.howKo, /몸을 놓아준 뒤/);
});
