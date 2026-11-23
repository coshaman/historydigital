import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const maps = Object.fromEntries(await Promise.all((await readdir(path.join(root, 'rpg/maps')))
  .filter(file => file.endsWith('.json')).map(async file => [path.basename(file, '.json'), await json(`rpg/maps/${file}`)])));
const hostCards = await Promise.all((await readdir(path.join(root, 'rpg/characters')))
  .filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));

test('an AI reply still records after its nearby speaker moves during the open conversation', () => {
  const state = game.createInitialState({ maps, hostCards });
  state.world.currentMapId = 'nevsky';
  state.player.embodiment = 'courier_pavel';
  state.player.position = { x: 9, y: 15 };
  state.hosts.courier_pavel.mapId = 'nevsky';
  state.hosts.courier_pavel.position = { x: 9, y: 15 };
  state.hosts.printer_ekaterina.mapId = 'nevsky';
  state.hosts.printer_ekaterina.position = { x: 10, y: 15 };

  const dialogueStartContext = game.captureDialogueStartContext(state, 'printer_ekaterina', 'courier_pavel', maps);
  assert.ok(dialogueStartContext, 'the opening context is captured only when the player is near the visible NPC');
  const afterAmbientMove = structuredClone(state);
  afterAmbientMove.hosts.printer_ekaterina.mapId = 'printshop';
  afterAmbientMove.hosts.printer_ekaterina.position = { x: 18, y: 10 };
  assert.equal(game.recordDialogueTurn(afterAmbientMove, { hostId: 'printer_ekaterina', actorHostId: 'courier_pavel',
    sceneId: 'V33_TALK_PRINTER_EKATERINA' }, maps).reason, 'dialogue_host_unavailable', 'an unopened or stale turn cannot bypass location checks');

  const recorded = game.recordDialogueTurn(afterAmbientMove, { hostId: 'printer_ekaterina', actorHostId: 'courier_pavel',
    sceneId: 'V33_TALK_PRINTER_EKATERINA', dialogueStartContext, aiGenerated: true }, maps);
  assert.equal(recorded.ok, true);
  assert.equal(recorded.state.ledger.at(-1).eventType, 'DIALOGUE_TURN');
  assert.equal(recorded.state.ledger.at(-1).aiGenerated, true);
});
