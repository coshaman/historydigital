import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const mapIds = ['nevsky','printshop','chancery','courtyard','market-quay','dead-souls','overcoat','police-station'];
const maps = Object.fromEntries(await Promise.all(mapIds.map(async id => [id, await json(`../rpg/maps/${id}.json`)])));
const allCards = await Promise.all((await readdir(new URL('../rpg/characters/', import.meta.url)))
  .filter(file => file.endsWith('.json')).map(file => json(`../rpg/characters/${file}`)));
const cards = allCards.filter(card => card.kind === 'FICTIONAL');
const questFiles = ['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','yard-ledger-1847','laundry-wages-1847','bakery-flour-1847','market-prices-1847','porter-load-1847','coach-fare-1847','household-privacy-1847','midwife-care-cost-1847','apothecary-limits-1847','apprentice-authorship-1847','bookbinder-damage-1847','scribal-copy-1847','inn-debt-rumor-1847','student-circle-risk-1847','teacher-access-cost-1847','noble-status-debt-1847','landlady-rent-commons-1847','water-access-queue-1847','fish-storage-time-1847','warehouse-loss-record-1847','servant-private-warning-1847','guard-entry-bribe-1847','carter-delivery-delay-1847','street-vendor-weather-1847','typesetter-speed-censorship-1847','lodging-reading-income-1847','literary-dead-souls','literary-overcoat'];
const quests = await Promise.all(questFiles.map(id => json(`../rpg/quests/${id}.json`)));

function simulate() {
  let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
  const startHash = game.stateHash(state), startingQuestState = JSON.stringify(state.quests), moved = new Set(), activeStates = new Set(), changedStateResidents = new Set(), checked = [];
  for (let minutes = 5; minutes <= 1440; minutes += 5) {
    const before = state;
    state = game.advanceNpcWorld(state, 5, maps);
    const event = state.ledger.length > before.ledger.length ? state.ledger.at(-1) : null;
    for (const change of event?.stateChanges ?? []) { activeStates.add(change.to); changedStateResidents.add(change.hostId); }
    for (const move of event?.moves ?? []) {
      moved.add(move.hostId);
      if (move.fromMapId !== move.toMapId) assert.ok(move.viaExit, `map change without a door: ${move.hostId}`);
      else assert.equal(Math.abs(move.from.x - move.to.x) + Math.abs(move.from.y - move.to.y), 1, `tile jump: ${move.hostId}`);
    }
    const occupied = new Set();
    for (const host of Object.values(state.hosts).filter(person => person.historicalAliveAndPresent)) {
      const key = `${host.mapId}:${host.position.x},${host.position.y}`;
      assert.ok(!occupied.has(key), `NPC collision at ${key}`);
      occupied.add(key);
    }
    checked.push(minutes);
  }
  assert.notEqual(game.stateHash(state), startHash, 'daily schedule did not advance');
  assert.equal(JSON.stringify(state.quests), startingQuestState, 'autonomous routine changed quest state');
  const saved = game.saveGame(state);
  const loaded = game.loadGame(saved, { maps, hostCards: cards, quests });
  assert.equal(game.stateHash(loaded), game.stateHash(state), 'save/load lost the simulated cohort state');
  return { endHash: game.stateHash(state), moves: state.ledger.filter(event => event.eventType === 'NPC_SIMULATION').flatMap(event => event.moves).length, moved: [...moved].sort(), changedStateResidents: [...changedStateResidents].sort(), activeStates: [...activeStates].sort(), checks: checked.length };
}

const a = simulate(), b = simulate();
assert.deepEqual(a, b, '24-hour replay was not deterministic');
assert.equal(cards.length, 36, 'expected 36 active fictional city residents');
const cohortIds=['yardkeeper_semyon','laundress_mariya','baker_fyodor','market_nadezhda','porter_gavrila','coachman_timofey','housemaid_olga','midwife_avdotya','apothecary_yakov','print_apprentice_stepan','bookbinder_elizaveta','scribal_yuri','innkeeper_irina','student_vasily','teacher_lyubov','minor_noble_andrei','landlady_polina','watercarrier_luka','fishseller_klavdiya','warehouse_pyotr','servant_varvara','junior_guard_sergey','carter_roman','street_vendor_matryona','typesetter_nikita','lodging_tatyana'];
for (const id of cohortIds) assert.ok(a.moved.includes(id), `${id} did not move during the day`);
assert.deepEqual(a.changedStateResidents, [...cards.map(card => card.id)].sort(), 'every resident must enter an observable routine state');
assert.ok(a.activeStates.includes('TRAVELLING'), 'the FSM should expose route-following');
assert.ok(a.activeStates.includes('WORKING'), 'the FSM should expose scheduled work');
console.log(JSON.stringify({ status: 'PASS', residents: cards.length, durationMinutes: 1440, deterministicReplays: 2, saveReloadParity: true, occupancyChecks: a.checks, movementCount: a.moves, routineStateKinds: a.activeStates, routineStateResidents: a.changedStateResidents.length, newResidentsMoved: a.moved.filter(id => cohortIds.includes(id)) }, null, 2));
