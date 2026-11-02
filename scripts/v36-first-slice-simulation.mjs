import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const mapNames = ['nevsky','printshop','chancery','courtyard','dead-souls','overcoat','police-station'];
const maps = Object.fromEntries(await Promise.all(mapNames.map(async id => [id, await readJson(`rpg/maps/${id}.json`)])));
const characters = await Promise.all(['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','senior_clerk_konstantin','reader_darya','editor_sofia','police_sergeant_ivan'].map(id => readJson(`rpg/characters/${id}.json`)));
const questIds = ['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','literary-dead-souls','literary-overcoat'];
const quests = await Promise.all(questIds.map(id => readJson(`rpg/quests/${id}.json`)));
const outputDir = path.join(root, 'docs', 'v36', 'baseline');
await mkdir(outputDir, { recursive: true });

function createState() {
  return game.createInitialState({ maps, hostCards: characters, quests, startMapId: 'nevsky' });
}
function occupancy(state) {
  const occupants = new Map();
  for (const host of Object.values(state.hosts).filter(person => person.historicalAliveAndPresent)) {
    const key = `${host.mapId}:${host.position.x},${host.position.y}`;
    if (occupants.has(key)) throw new Error(`duplicate_occupancy:${occupants.get(key)}:${host.id}:${key}`);
    occupants.set(key, host.id);
  }
  if (!state.player.embodiment) {
    const key = `${state.world.currentMapId}:${state.player.position.x},${state.player.position.y}`;
    if (occupants.has(key)) throw new Error(`player_collision:${occupants.get(key)}:${key}`);
  }
  return true;
}
function snapshot(state, label) {
  return { label, clockMinutes: state.world.clockMinutes, residents: characters.map(card => {
    const host = state.hosts[card.id];
    return { id: card.id, mapId: host.mapId, position: { ...host.position }, scheduleId: host.scheduleId,
      activityKo: host.currentActivityKo, objective: host.objective, inventory: [...host.inventory],
      money: { ...host.money }, routineTaskCompletedId: host.routineTaskCompletedId ?? null,
      stateMachineState: host.routineState?.state ?? 'UNINITIALIZED', routineActivityKo: host.routineState?.activityKo ?? '' };
  }) };
}
function scheduleDigest(state) {
  return Object.fromEntries(Object.entries(state.quests).map(([id, quest]) => [id, quest.status]));
}
function simulateDay() {
  const state = createState(), baselineHash = game.stateHash(state), snapshots = [snapshot(state, 'start')], movements = [], deliveries = [], occupanciesChecked = [];
  const originalQuestStatus = scheduleDigest(state);
  occupancy(state);
  for (let elapsed = 5; elapsed <= 1440; elapsed += 5) {
    const beforeLedgerLength = state.ledger.length;
    const next = game.advanceNpcWorld(state, 5, maps);
    const event = next.ledger.length > beforeLedgerLength ? next.ledger.at(-1) : null;
    if (event?.eventType === 'NPC_SIMULATION') {
      movements.push(...event.moves.map(row => ({ ...row, elapsedMinutes: elapsed - 5 + row.minute })));
      deliveries.push(...event.deliveries.map(row => ({ ...row, elapsedMinutes: elapsed - 5 + row.minute })));
    }
    occupancy(next);
    occupanciesChecked.push(elapsed);
    for (const move of event?.moves ?? []) {
      if (move.fromMapId !== move.toMapId && !move.viaExit) throw new Error(`map_teleport_without_exit:${move.hostId}`);
      if (move.fromMapId === move.toMapId && Math.abs(move.from.x - move.to.x) + Math.abs(move.from.y - move.to.y) !== 1) throw new Error(`tile_teleport:${move.hostId}`);
    }
    if (event?.eventType !== 'NPC_SIMULATION' && next.ledger.length !== state.ledger.length) throw new Error('unexpected_event_type');
    Object.assign(state, next);
    if ([30,180,720,1440].includes(elapsed)) snapshots.push(snapshot(state, `plus_${elapsed}m`));
  }
  if (game.stateHash(state) === baselineHash) throw new Error('full_day_made_no_world_change');
  if (JSON.stringify(scheduleDigest(state)) !== JSON.stringify(originalQuestStatus)) throw new Error('NPC_simulation_changed_quest_status');
  const movedIds = [...new Set(movements.map(row => row.hostId))].sort();
  const movedByGoal = Object.fromEntries(characters.map(card => [card.id, movements.filter(row => row.hostId === card.id).length]));
  const serialized = game.saveGame(state);
  const loaded = game.loadGame(serialized, { maps, hostCards: characters, quests });
  if (game.stateHash(loaded) !== game.stateHash(state)) throw new Error('save_reload_mismatch');
  return { state, snapshots, movements, deliveries, movedIds, movedByGoal, occupancyChecks: occupanciesChecked.length, baselineHash, finalHash: game.stateHash(state), saveReloadParity: true };
}

const first = simulateDay();
const replay = simulateDay();
if (first.finalHash !== replay.finalHash || JSON.stringify(first.movements) !== JSON.stringify(replay.movements) || JSON.stringify(first.deliveries) !== JSON.stringify(replay.deliveries)) throw new Error('deterministic_replay_mismatch');
const possessionProbe = createState();
const possessedId = 'courier_pavel';
possessionProbe.player.embodiment = possessedId;
const possessedStart = { mapId: possessionProbe.hosts[possessedId].mapId, ...possessionProbe.hosts[possessedId].position };
const duringPossession = game.advanceNpcWorld(possessionProbe, 30, maps);
const possessedAfter = { mapId: duringPossession.hosts[possessedId].mapId, ...duringPossession.hosts[possessedId].position };
if (JSON.stringify(possessedStart) !== JSON.stringify(possessedAfter)) throw new Error('possessed_actor_autonomous_move');
if (duringPossession.hosts[possessedId].routineState?.state !== 'POSSESSED') throw new Error('possessed_actor_state_not_visible');
const resumed = game.advanceNpcWorld({ ...duringPossession, player: { ...duringPossession.player, embodiment: null } }, 30, maps);
const resumedPosition = { mapId: resumed.hosts[possessedId].mapId, ...resumed.hosts[possessedId].position };
if (JSON.stringify(possessedAfter) === JSON.stringify(resumedPosition)) throw new Error('autonomy_did_not_resume_after_release');
if (resumed.hosts[possessedId].routineState?.state === 'POSSESSED') throw new Error('possessed_actor_state_did_not_resume');

const report = { schemaVersion: 'V36_FIRST_SLICE_BASELINE_REPLAY_V1', baselineCommit: '7974392eb6e30a19607ff306972159fe5cd47b2e',
  scope: { cityResidents: characters.length, namedLiteraryCharactersExcluded: true, durationMinutes: 1440,
    timeStepMinutes: 5, mapIds: mapNames, deterministicRunCount: 2, seed: 'not applicable; current routine engine is deterministic and has no seed parameter' },
  result: 'PASS_WITH_V36_GAPS', evidence: { movedIds: first.movedIds, movedResidentCount: first.movedIds.length,
    movementCount: first.movements.length, movedByResident: first.movedByGoal, deliveryCount: first.deliveries.length,
    deliveryLog: first.deliveries, occupancyChecks: first.occupancyChecks, questStatusUnchanged: true,
    deterministicReplay: true, saveReloadParity: first.saveReloadParity, possessionStopsAutonomy: true,
    possessedResident: possessedId, possessionStart: possessedStart, possessionEnd: possessedAfter,
    afterReleasePosition: resumedPosition,
    snapshots: first.snapshots, movementLog: first.movements },
  gaps: ['Only ten fictional city residents are present (target 36).', 'No per-resident FSM state field, utility goal selection, social interaction event, or persistent life quest exists for this ten-person cohort.', 'The tick currently runs deterministic route pathfinding each 5 simulated minutes; no 36-agent performance evidence yet.', 'This is code-driven deterministic replay, not player-tested 24-hour realtime play.'] };
await writeFile(path.join(outputDir, 'NPC_TEN_RESIDENT_24H_BASELINE.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ status: report.result, residents: characters.length, moved: first.movedIds.length,
  moves: first.movements.length, deliveries: first.deliveries.length, occupancyChecks: first.occupancyChecks,
  deterministic: true, possessionPaused: true, output: 'docs/v36/baseline/NPC_TEN_RESIDENT_24H_BASELINE.json' }, null, 2));
