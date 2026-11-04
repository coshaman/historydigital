import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const maps = Object.fromEntries(await Promise.all(['nevsky','printshop','chancery','courtyard','market-quay','police-station','dead-souls','overcoat'].map(async id => [id, await json(`rpg/maps/${id}.json`)])));
const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
const quests = (await Promise.all((await readdir(path.join(root, 'rpg/quests'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/quests/${file}`)))).filter(quest => quest.historicalOutcome?.id && typeof quest.historicalOutcome.value === 'string');
const scenarios = [
  ['fresh_observer', null], ['alexei_possessed', 'clerk_alexei'], ['ekaterina_possessed', 'printer_ekaterina'], ['pavel_route', 'courier_pavel'],
  ['anna_life', 'seamstress_anna'], ['mikhail_housing', 'tenant_mikhail'], ['lev_bookseller', 'bookseller_lev'], ['sofia_editor', 'editor_sofia'],
  ['ivan_patrol', 'police_sergeant_ivan'], ['darya_reader', 'reader_darya'], ['market_seller', 'market_nadezhda'], ['warehouse_worker', 'warehouse_pyotr'],
];
const results = [];

for (const [index, [fixtureId, hostId]] of scenarios.entries()) {
  const state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
  state.world.clockMinutes = 540 + index * 73;
  if (hostId) {
    const host = state.hosts[hostId], card = cards.find(item => item.id === hostId);
    host.mapId = card.start.mapId;
    host.position = { x: card.start.x, y: card.start.y };
    state.player.embodiment = hostId;
    state.player.position = { ...host.position };
    state.world.currentMapId = host.mapId;
    host.money.amount += index;
    host.inventory.push(`이전 기록 보존 ${index}`);
    host.relations.fixtureWitness = `fixture-${fixtureId}`;
  }
  for (const host of Object.values(state.hosts)) {
    delete host.activeGoal;
    delete host.needs;
  }
  if (index % 2 === 0) delete state.player.dialogueGrowth;
  if (index % 3 === 0) delete state.player.civic;
  if (index % 4 === 0) {
    delete state.learning.examAnswers;
    delete state.learning.promotionStatus;
  }
  state.version = index % 3 === 0 ? 1 : index % 3 === 1 ? 2 : 3;
  state.player.gameSaveVersion = state.version;
  const saveVersion = state.version;
  const envelope = { saveVersion, checksum: game.stateHash(state), state };
  const originalPlayer = structuredClone(state.player), originalHost = hostId ? structuredClone(state.hosts[hostId]) : null;
  const restored = game.loadGame(envelope, { maps, hostCards: cards, quests });

  assert.equal(restored.version, 36, `${fixtureId}: state schema was not upgraded to V36`);
  assert.equal(restored.player.gameSaveVersion, 36, `${fixtureId}: player save schema was not upgraded`);
  assert.equal(restored.world.clockMinutes, 540 + index * 73, `${fixtureId}: world clock changed`);
  assert.ok(Object.values(restored.hosts).every(host => Number.isFinite(host.needs?.hunger) && Number.isFinite(host.needs?.fatigue) && host.activeGoal === null), `${fixtureId}: new resident runtime fields were not safely migrated`);
  assert.ok(cards.every(card => (restored.hosts[card.id].todayGoals ?? []).length === (card.todayGoals ?? []).length), `${fixtureId}: authored daily intentions were not restored for all residents`);
  assert.equal(restored.player.position.x, originalPlayer.position.x, `${fixtureId}: player position was overwritten`);
  assert.equal(restored.player.position.y, originalPlayer.position.y, `${fixtureId}: player position was overwritten`);
  if (hostId) {
    const restoredHost = restored.hosts[hostId];
    assert.equal(restoredHost.money.amount, originalHost.money.amount, `${fixtureId}: player-owned funds were overwritten`);
    assert.deepEqual(restoredHost.inventory, originalHost.inventory, `${fixtureId}: player-owned inventory was overwritten`);
    assert.deepEqual(restoredHost.relations, originalHost.relations, `${fixtureId}: relationship state was overwritten`);
  }
  const roundTrip = JSON.parse(game.saveGame(restored));
  assert.equal(roundTrip.saveVersion, 36, `${fixtureId}: new save was not written with V36 schema`);
  assert.equal(game.stateHash(game.loadGame(roundTrip, { maps, hostCards: cards, quests })), game.stateHash(restored), `${fixtureId}: V36 round trip changed state`);
  results.push({ fixtureId, sourceSaveVersion: saveVersion, migratedSaveVersion: roundTrip.saveVersion, possessedHostId: hostId, preservesPlayerData: true, roundTrip: true });
}

const corrupted = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
const badChecksum = { saveVersion: 3, checksum: '00000000', state: corrupted };
assert.throws(() => game.loadGame(badChecksum, { maps, hostCards: cards, quests }), /Invalid or corrupted V36 save/);
const badPosition = structuredClone(corrupted);
badPosition.player.position.x = 999;
assert.throws(() => game.loadGame({ saveVersion: 3, checksum: game.stateHash(badPosition), state: badPosition }, { maps, hostCards: cards, quests }), /invalid player position/i);
const report = { schemaVersion: 'V36-SAVE-MIGRATION-1', status: 'PASS', supportedSourceVersions: [1, 2, 3], targetVersion: 36, fixtureCount: results.length, fixtures: results, preservesUserData: true, rejectsCorruptChecksum: true, rejectsInvalidPosition: true, generatedAt: new Date().toISOString() };
await mkdir(path.join(root, 'docs', 'v36'), { recursive: true });
await writeFile(path.join(root, 'docs', 'v36', 'SAVE_MIGRATION.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
