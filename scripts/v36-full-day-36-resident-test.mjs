import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const districtData = await readJson('rpg/data/city-districts-v36.json');
const ids = [...new Set(districtData.districts.flatMap(district => district.residentIds ?? []))];
const maps = Object.fromEntries(await Promise.all((await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const cards = await Promise.all(ids.map(id => readJson(`rpg/characters/${id}.json`)));
const quests = (await Promise.all((await readdir(new URL('../rpg/quests/', import.meta.url))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/quests/${file}`)))).filter(quest => quest.historicalOutcome?.id);
assert.equal(ids.length, 36);

function runFullDay() {
  let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
  const initialPositions = Object.fromEntries(ids.map(id => [id, { mapId: state.hosts[id].mapId, ...state.hosts[id].position }]));
  const observedPersonalGoalVisits = [];
  let collisionSnapshots = 0;
  for (let interval = 0; interval < 288; interval += 1) {
    const priorLedgerLength = state.ledger.length;
    state = game.advanceNpcWorld(state, 5, maps);
    const addedEvents = state.ledger.length >= priorLedgerLength ? state.ledger.slice(priorLedgerLength) : state.ledger;
    observedPersonalGoalVisits.push(...addedEvents.flatMap(event => event.personalGoalVisits ?? []));
    const occupied = new Map();
    for (const id of ids) {
      const host = state.hosts[id], key = `${host.mapId}:${host.position.x},${host.position.y}`;
      assert.ok(!occupied.has(key), `${id} overlaps ${occupied.get(key)} at ${key}, 5-minute interval ${interval}`);
      occupied.set(key, id);
      assert.ok(maps[host.mapId], `${id} is left in a missing map`);
    }
    collisionSnapshots += 1;
  }
  const moves = state.ledger.flatMap(event => event.moves ?? []);
  for (const [id, start] of Object.entries(initialPositions)) {
    let previous = start;
    for (const step of moves.filter(item => item.hostId === id)) {
      assert.deepEqual({ mapId: step.fromMapId, ...step.from }, previous, `${id} movement log must be continuous`);
      if (step.fromMapId === step.toMapId) {
        assert.equal(Math.abs(step.to.x - step.from.x) + Math.abs(step.to.y - step.from.y), 1, `${id} must traverse one tile at a time`);
        assert.equal(step.viaExit, null);
      } else assert.ok(step.viaExit, `${id} district transition must use a named map exit`);
      previous = { mapId: step.toMapId, ...step.to };
    }
    const host = state.hosts[id];
    assert.deepEqual({ mapId: host.mapId, ...host.position }, previous, `${id} end position must match its movement trace`);
    assert.ok(host.schedule.length >= 4, `${id} needs a daily schedule`);
    assert.ok(host.activeGoal, `${id} needs a live goal after the full-day replay`);
    assert.ok(host.currentActivityKo?.length > 0, `${id} needs a current activity after the full-day replay`);
  }
  assert.deepEqual(state.quests, Object.fromEntries(quests.map(quest => [quest.id, { status:'open', result:null }])), 'NPC autonomy cannot complete player quests');
  return { state, initialPositions, moves, collisionSnapshots, observedPersonalGoalVisits };
}

const startedAt = performance.now();
const replays = [runFullDay(), runFullDay(), runFullDay()];
const hashes = replays.map(run => game.stateHash(run.state));
assert.equal(new Set(hashes).size, 1, 'three canonical full-day replays must produce identical saved state');
const first = replays[0];
const restored = game.loadGame(game.saveGame(first.state), { maps, hostCards: cards, quests });
const saveReloadDifferences = Object.keys(first.state).filter(key => JSON.stringify(first.state[key]) !== JSON.stringify(restored[key]));
const changedHostFields = Object.fromEntries(ids.flatMap(id => {
  const before=first.state.hosts[id],after=restored.hosts[id],keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]));
  return keys.length?[[id,keys]]:[];
}));
assert.equal(game.stateHash(restored), hashes[0], `the complete 24-hour NPC and social-goal state must survive save/reload; changed fields: ${JSON.stringify({saveReloadDifferences,changedHostFields})}`);
const goals = first.state.ledger.flatMap(event => event.goals ?? []);
const deliveries = first.state.ledger.flatMap(event => event.deliveries ?? []);
const exchanges = first.state.ledger.flatMap(event => event.exchanges ?? []);
const personalContacts = first.state.ledger.flatMap(event => event.personalContacts ?? []);
const personalGoalVisits = first.observedPersonalGoalVisits;
const actionableLifeGoalHosts = ['clerk_alexei', 'printer_ekaterina', 'courier_pavel', 'seamstress_anna', 'tenant_mikhail', 'bookseller_lev',
  'editor_sofia', 'senior_clerk_konstantin', 'yardkeeper_semyon', 'laundress_mariya', 'apothecary_yakov', 'baker_fyodor',
  'bookbinder_elizaveta', 'carter_roman', 'coachman_timofey', 'fishseller_klavdiya', 'housemaid_olga', 'innkeeper_irina',
  'junior_guard_sergey', 'landlady_polina', 'lodging_tatyana', 'midwife_avdotya', 'print_apprentice_stepan', 'scribal_yuri',
  'student_vasily', 'minor_noble_andrei', 'street_vendor_matryona', 'typesetter_nikita'];
const mapTransitions = first.moves.filter(move => move.viaExit);
assert.ok(first.moves.length > 0, 'residents should walk throughout the day');
assert.ok(mapTransitions.length > 0, 'residents should cross real district exits');
assert.ok(goals.length > 0, 'daily needs and schedules should create observable goals');
assert.ok(deliveries.length > 0, 'at least one scheduled item handoff should complete');
assert.ok(exchanges.length > 0, 'at least one scheduled exchange should complete');
assert.ok(personalContacts.length > 0, 'active personal relationship goals should lead residents to meet their named neighbors');
for (const hostId of actionableLifeGoalHosts) assert.ok(personalGoalVisits.some(visit => visit.hostId === hostId), `${hostId} must pursue the current physical life-arc stage during the 24-hour replay`);
assert.ok(personalContacts.every(contact => contact.hostId !== contact.partnerHostId && contact.effect === 'social_need_relieved'), 'autonomous personal contacts should create a reciprocal, visible social-need change');
const distinctPersonalContactResidents = new Set(personalContacts.map(contact => contact.hostId)).size;
assert.ok(distinctPersonalContactResidents >= 10,
  `personal goal behavior should affect at least 10 residents (over a quarter of the city) in one day; got ${distinctPersonalContactResidents}/${ids.length}: ${JSON.stringify([...new Set(personalContacts.map(contact => contact.hostId))])}`);
const report = { schemaVersion:'V36_FULL_DAY_36_RESIDENT_REPLAY_1', status:'PASS', activeCityResidents:ids.length,
  deterministicReplays:3, simulatedMinutes:1440, replayHashes:hashes,
  collisionSnapshotsPerReplay:first.collisionSnapshots, totalCollisionSnapshots:replays.reduce((sum,run)=>sum+run.collisionSnapshots,0),
  firstReplay:{ movementSteps:first.moves.length, districtTransitions:mapTransitions.length, goalEvents:goals.length,
    deliveries:deliveries.length, exchanges:exchanges.length, personalContacts:personalContacts.length, distinctPersonalContactResidents,
    personalLifeGoalVisits:personalGoalVisits.length, residentsWithPhysicalLifeGoalVisits:new Set(personalGoalVisits.map(visit=>visit.hostId)).size,
    actionableLifeGoalQuestIds:Object.fromEntries(actionableLifeGoalHosts.map(id=>[id,personalGoalVisits.find(visit=>visit.hostId===id)?.questId??null])),
    residentsWithDistinctAuthoredObjectives:new Set(cards.map(card=>card.personalObjective)).size,
    finalActivityCount:new Set(ids.map(id=>first.state.hosts[id].currentActivityKo)).size,
    finalPositions:Object.fromEntries(ids.map(id=>[id,{mapId:first.state.hosts[id].mapId,...first.state.hosts[id].position}])) },
  fullDaySaveReloadStateHash:game.stateHash(restored), autoCompletedPlayerQuests:0, runtimeMilliseconds:Math.round(performance.now()-startedAt) };
const auditDir = new URL('../docs/v36/current-audit/', import.meta.url);
await mkdir(auditDir,{recursive:true});
await writeFile(new URL('FULL_DAY_36_RESIDENT_REPLAY.json',auditDir),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
