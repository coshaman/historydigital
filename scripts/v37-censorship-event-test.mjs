import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { resolveQuestGuidance } from '../rpg/engine/quest-guidance.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  json('../rpg/quests/censored-page-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/maps/${file}`)))
    .then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`))),
]);
const map = maps.printshop;
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.ok(object, 'the censored proof is a physical printshop object');
const catalog = await json('../data/event_catalog_45.json');
assert.equal(catalog.find(row => row.event_id === 'E06').validation_status, 'DESIGN_SEED_NOT_VERIFIED');

const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'printshop' });
state.world.chapterId = 'V33_1847_PRINT';
state.world.date = '1847-01-01';
assert.equal(objectIsPresent(object, state, [quest]), false, 'no marked-proof choice appears before the scheduled work event');
assert.notEqual(resolveQuestGuidance({ state, quests: [quest], maps, hostCards: cards }).questId, quest.id,
  'the event does not leak into mission guidance before its trigger');
let sim = state;
for (let minute = 0; minute < 1200 && sim.world.livingEventStates.E06?.status !== 'ACTIVE'; minute += 5) {
  sim = game.advanceNpcWorld(sim, 5, maps);
}
const event = sim.world.livingEventStates.E06;
assert.equal(event?.status, 'ACTIVE', 'a real scheduled typesetting proof action triggers the scene');
assert.equal(event.stage, 'CENSOR_MARK_RETURNED');
assert.equal(event.trigger, 'censor_order');
assert.equal(event.triggerMechanism, 'scheduled_typesetter_proof_check_after_returned_marked_proof');
assert.equal(event.validationStatus, 'DESIGN_SEED_NOT_VERIFIED');
assert.equal(objectIsPresent(object, sim, [quest]), true, 'the physical evidence appears only while its event is active');
assert.equal(resolveQuestGuidance({ state: sim, quests: [quest], maps, hostCards: cards }).questId, quest.id,
  'the event becomes a visible objective after the physical trigger');
assert.ok(sim.ledger.some(row => (row.livingEvents ?? []).some(item => item.catalogEventId === 'E06' && item.stage === 'CENSOR_MARK_RETURNED')));

for (const [actionId, hostId, expected] of [
  ['E06_REMOVE_TYPE', 'printer_ekaterina', ['TYPE_REMOVED', 'REVISED_PROOF', 'NONE', 0]],
  ['E06_FILE_QUERY', 'editor_sofia', ['QUERY_FILED', 'QUERY_PENDING', 'OFFICIAL_QUERY', 1]],
  ['E06_KEEP_COPY', 'typesetter_nikita', ['COPY_KEPT', 'PRIVATE_COPY_RETAINED', 'NONE', 3]],
]) {
  const branch = structuredClone(sim);
  branch.world.currentMapId = 'printshop';
  branch.hosts[hostId].mapId = 'printshop';
  branch.hosts[hostId].position = { x: object.x / 16, y: object.y / 16 };
  branch.player.position = { ...branch.hosts[hostId].position };
  branch.player.embodiment = hostId;
  const result = game.performQuestAction(branch, { questId: quest.id, hostId, actionId, objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(result.ok, true, `${actionId} resolves through the physical proof (${result.reason ?? 'unknown'})`);
  const [stage, disposition, record, risk] = expected;
  assert.equal(result.state.world.livingEventStates.E06.stage, stage);
  assert.equal(result.state.world.printCensorshipState.proofDisposition, disposition);
  assert.equal(result.state.world.printCensorshipState.officeRecord, record);
  assert.equal(result.state.world.printCensorshipState.printerRisk, risk);
  if (actionId === 'E06_KEEP_COPY') {
    assert.ok(result.state.hosts.typesetter_nikita.inventory.includes('삭제 표시가 남은 교정쇄 사본 (허구 사건)'));
    assert.ok(!result.state.hosts.editor_sofia.inventory.includes('삭제 표시가 남은 교정쇄 사본 (허구 사건)'),
      'the hidden copy belongs only to the character who physically kept it');
  }
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards });
  assert.equal(game.stateHash(restored), game.stateHash(result.state), `${actionId} persists through save/load`);
  if (actionId === 'E06_KEEP_COPY') {
    const legacy = structuredClone(result.state);
    legacy.hosts.editor_sofia.inventory.push('삭제 표시가 남은 교정쇄 사본 (허구 사건)');
    const legacyEnvelope = JSON.stringify({ saveVersion: 36, checksum: game.stateHash(legacy), state: legacy });
    const migrated = game.loadGame(legacyEnvelope, { maps, hostCards: cards });
    assert.equal(migrated.version, 37);
    assert.ok(migrated.hosts.typesetter_nikita.inventory.includes('삭제 표시가 남은 교정쇄 사본 (허구 사건)'));
    assert.ok(!migrated.hosts.editor_sofia.inventory.includes('삭제 표시가 남은 교정쇄 사본 (허구 사건)'),
      'loading normalizes a duplicate private-copy inventory from an earlier saved build');
  }
}

const deadlineChoice = structuredClone(sim);
deadlineChoice.world.clockMinutes = deadlineChoice.world.livingEventStates.E06.resolvesAtMinute - 3;
deadlineChoice.world.currentMapId = 'printshop';
deadlineChoice.hosts.editor_sofia.mapId = 'printshop';
deadlineChoice.hosts.editor_sofia.position = { x: object.x / 16, y: object.y / 16 };
deadlineChoice.player.position = { ...deadlineChoice.hosts.editor_sofia.position };
deadlineChoice.player.embodiment = 'editor_sofia';
const timelyQuery = game.performQuestAction(deadlineChoice, { questId: quest.id, hostId: 'editor_sofia',
  actionId: 'E06_FILE_QUERY', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(timelyQuery.ok, true, 'a response begun before the deadline completes atomically through its action time');
assert.equal(timelyQuery.state.world.livingEventStates.E06.stage, 'QUERY_FILED');

const unattended = structuredClone(sim);
unattended.world.clockMinutes = unattended.world.livingEventStates.E06.resolvesAtMinute;
const expired = game.advanceNpcWorld(unattended, 1, maps);
assert.equal(expired.world.livingEventStates.E06.stage, 'INSTITUTIONAL_CUT');
assert.equal(expired.world.livingEventStates.E06.proofDisposition, 'TEXT_REMOVED_WITHOUT_PLAYER_RESPONSE');
assert.equal(expired.world.livingEventStates.E06.printerRisk, 2);
const restoredExpired = game.loadGame(game.saveGame(expired), { maps, hostCards: cards });
assert.equal(game.stateHash(restoredExpired), game.stateHash(expired));
console.log(JSON.stringify({ status: 'PASS', naturalTrigger: true, playerResponses: 3, unattendedStage: 'INSTITUTIONAL_CUT', saveLoad: 'PASS' }, null, 2));
