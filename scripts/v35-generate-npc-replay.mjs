import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const game = require('../rpg/engine/game-state.js');
const json = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const maps = Object.fromEntries(['nevsky','printshop','chancery','courtyard','dead-souls','overcoat'].map(id => [id, json(`rpg/maps/${id}.json`)]));
const hostIds = ['seamstress_anna','printer_ekaterina','clerk_alexei','courier_pavel','tenant_mikhail','bookseller_lev'];
const cards = hostIds.map(id => json(`rpg/characters/${id}.json`));
const quests = ['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','literary-dead-souls','literary-overcoat'].map(id => json(`rpg/quests/${id}.json`));
const initial = game.createInitialState({ maps, hostCards: cards, quests });
initial.world.clockMinutes = 590;
const beforeHash = game.stateHash(initial);
const replay = game.advanceNpcWorld(initial, 30, maps);
const replayAgain = game.advanceNpcWorld(initial, 30, maps);
assert.equal(game.stateHash(initial), beforeHash, 'advanceNpcWorld must not mutate its input');
assert.equal(game.stateHash(replay), game.stateHash(replayAgain), 'replay must be deterministic');
const event = replay.ledger.find(row => row.eventType === 'NPC_SIMULATION');
assert.ok(event, '30-minute replay must produce movement evidence');
assert.equal(event.simulatedMinutes, 30);
assert.equal(replay.world.clockMinutes - initial.world.clockMinutes, 30);
assert.ok(new Set(event.moves.map(row => row.hostId)).size >= 4, 'at least four resident routines must move');

const positions = new Map(cards.map(card => [card.id, { mapId: card.start.mapId, x: card.start.x, y: card.start.y }]));
const collisionChecks = [];
for (const move of [...event.moves].sort((a,b) => a.minute - b.minute || a.hostId.localeCompare(b.hostId))) {
  const prior = positions.get(move.hostId);
  assert.equal(prior.mapId, move.fromMapId, `movement origin map mismatch: ${move.hostId}`);
  assert.deepEqual({x: prior.x, y: prior.y}, move.from, `movement origin mismatch: ${move.hostId}`);
  if (move.fromMapId !== move.toMapId) assert.ok(move.viaExit, `map crossing must use a door: ${move.hostId}`);
  else assert.equal(Math.abs(move.from.x - move.to.x) + Math.abs(move.from.y - move.to.y), 1, `tile teleport detected: ${move.hostId}`);
  for (const [otherId, other] of positions) {
    if (otherId === move.hostId) continue;
    assert.ok(other.mapId !== move.toMapId || other.x !== move.to.x || other.y !== move.to.y, `occupied destination: ${move.hostId} -> ${move.toMapId}:${move.to.x},${move.to.y}`);
  }
  positions.set(move.hostId, { mapId: move.toMapId, x: move.to.x, y: move.to.y });
  collisionChecks.push({ minute: move.minute, hostId: move.hostId, destinationFree: true });
}
const serialized = game.saveGame(replay);
const loaded = game.loadGame(serialized, { maps, hostCards: cards, quests });
assert.equal(game.stateHash(loaded), game.stateHash(replay), 'NPC world state must survive save/reload');
const deliveryStart = game.createInitialState({ maps, hostCards: cards, quests });
const deliveryReplay = game.advanceNpcWorld(deliveryStart, 110, maps);
const deliveryEvent = deliveryReplay.ledger.find(row => row.eventType === 'NPC_SIMULATION');
assert.ok(deliveryEvent?.deliveries.some(row => row.hostId === 'courier_pavel' && row.recipientHostId === 'printer_ekaterina' && row.itemKo === '밀봉 봉투'), 'courier delivery should complete when recipient route permits');

const output = path.join(root, 'docs', 'v35', 'npc-30-minute-replay.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({ schemaVersion: 'V35_NPC_REPLAY_V1', result: 'PASS', elapsedMinutes: 30, clockStart: initial.world.clockMinutes, clockEnd: replay.world.clockMinutes, initialStateHash: beforeHash, resultStateHash: game.stateHash(replay), deterministicReplay: true, inputImmutable: true, movedActors: [...new Set(event.moves.map(row => row.hostId))], movementCount: event.moves.length, deliveryCount: event.deliveries.length, collisionChecks, saveReloadParity: true, movementLog: event.moves, deliveryLog: event.deliveries, courierTaskReplay: { elapsedMinutes: 110, deliveries: deliveryEvent.deliveries } }, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', elapsedMinutes: 30, movedActors: [...new Set(event.moves.map(row => row.hostId))], movementCount: event.moves.length, deliveryCount: deliveryEvent.deliveries.length, saveReloadParity: true, output: path.relative(root, output) }, null, 2));
