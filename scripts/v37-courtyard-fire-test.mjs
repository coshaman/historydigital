import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';
import { courtyardFireDamageMark } from '../rpg/engine/renderer.js';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, fireQuest, coldQuest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/courtyard-fire-1847.json'), read('../rpg/quests/cold-wave-firewood-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const quests = [fireQuest, coldQuest];
const fireObject = maps.courtyard.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === fireQuest.entry.objectId);
assert.ok(fireObject, 'fire scene uses a physical courtyard interaction');

function setup({ weather = 'wind', hasFirewood = true } = {}) {
  const state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'courtyard' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-01-01'; state.world.clockMinutes = 1110;
  state.player.embodiment = 'tenant_mikhail'; state.player.position = { x: 15, y: 11 };
  const tenant = state.hosts.tenant_mikhail;
  tenant.mapId = 'courtyard'; tenant.position = { x: 15, y: 11 };
  for (const [id, position] of [['landlady_polina', { x: 16, y: 11 }], ['porter_gavrila', { x: 14, y: 11 }],
    ['junior_guard_sergey', { x: 15, y: 12 }]]) {
    state.hosts[id].mapId = 'courtyard'; state.hosts[id].position = position;
  }
  if (hasFirewood) tenant.inventory.push('장작 한 단');
  state.world.livingEventStates.E03 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E03',
    status: 'RESOLVED', stage: 'FIREWOOD_BOUGHT', resolutionActionId: 'E03_BUY_FIREWOOD', resolvedAtMinute: 1005,
    resolvedByHostId: 'tenant_mikhail', weather, actorHostIds: ['tenant_mikhail', 'landlady_polina', 'porter_gavrila'],
    tenantHostId: 'tenant_mikhail', landlordHostId: 'landlady_polina', startedAtMinute: 1000, resolvesAtMinute: 2440,
    trigger: 'winter_snow_or_wind', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance' };
  return state;
}

const wrongWeather = game.advanceNpcWorld(setup({ weather: 'snow' }), 1, maps);
assert.equal(wrongWeather.world.livingEventStates.E27, undefined, 'snow alone does not cause a fire');
const noFuel = game.advanceNpcWorld(setup({ hasFirewood: false }), 1, maps);
assert.equal(noFuel.world.livingEventStates.E27, undefined, 'no fire without the purchased fuel being carried home');

const active = game.advanceNpcWorld(setup(), 1, maps);
const event = active.world.livingEventStates.E27;
assert.equal(event.status, 'ACTIVE'); assert.equal(event.sourceEventId, 'E03');
assert.equal(event.sourceActionId, 'E03_BUY_FIREWOOD');
assert.equal(active.hosts.tenant_mikhail.inventory.includes('장작 한 단'), false, 'the firewood is consumed by its actual use');
assert.equal(objectIsPresent(fireObject, active, quests), true, 'the physical fire scene appears after its trigger');
assert.deepEqual(questChoices(fireQuest, 'tenant_mikhail', [], active).map(row => row.action.id),
  ['E27_EVACUATE_RESIDENTS', 'E27_RAISE_NEIGHBOR_ALARM', 'E27_REPORT_TO_WATCH']);

for (const [actionId, stage] of [['E27_EVACUATE_RESIDENTS', 'RESIDENTS_EVACUATED'],
  ['E27_RAISE_NEIGHBOR_ALARM', 'ALARM_RAISED'], ['E27_REPORT_TO_WATCH', 'FIRE_REPORTED_TO_WATCH']]) {
  const result = game.performQuestAction(active, { questId: fireQuest.id, hostId: 'tenant_mikhail', actionId,
    objectId: fireObject.id }, { quests, maps });
  assert.equal(result.ok, true, `${actionId} can be carried out (${result.reason ?? ''})`);
  const evacuation = actionId === 'E27_EVACUATE_RESIDENTS';
  assert.equal(result.state.world.livingEventStates.E27.stage, evacuation ? 'EVACUATING' : stage);
  assert.equal(result.state.world.livingEventStates.E27.status, evacuation ? 'ACTIVE' : 'RESOLVED');
  if (evacuation) {
    assert.equal(result.state.hosts.tenant_mikhail.mapId, 'courtyard', 'the player must guide the tenant through the real courtyard gate');
    assert.equal(result.state.world.livingEventStates.E27.propertyDamage, 0);
  } else assert.equal(result.state.world.livingEventStates.E27.propertyDamage, 0);
  const saved = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests });
  assert.equal(saved.world.livingEventStates.E27.stage, evacuation ? 'EVACUATING' : stage, `${actionId} persists across save/load`);
  if (evacuation) {
    let guided = game.advanceNpcWorld(saved, 30, maps);
    const remoteObserver = structuredClone(saved);
    remoteObserver.world.currentMapId = 'printshop'; remoteObserver.player.position = { x: 14, y: 9 };
    remoteObserver.player.embodiment = null;
    let remoteOutcome = remoteObserver;
    for (let elapsed = 0; elapsed < 240 && remoteOutcome.world.livingEventStates.E27.stage === 'EVACUATING'; elapsed += 5) {
      remoteOutcome = game.advanceNpcWorld(remoteOutcome, 5, maps);
    }
    const remoteEvacuation = remoteOutcome.ledger.flatMap(row => row.livingEvents ?? [])
      .find(row => row.catalogEventId === 'E27' && row.stage === 'RESIDENTS_EVACUATED');
    assert.equal(remoteEvacuation?.witnessedByPlayer, false,
      'evacuation remains unseen when the player is in another district');
    const gateTile = { x: 12, y: 16 };
    assert.ok(['landlady_polina', 'porter_gavrila', 'junior_guard_sergey'].every(id => guided.hosts[id].mapId === 'courtyard'
      && Math.abs(guided.hosts[id].position.x - gateTile.x) + Math.abs(guided.hosts[id].position.y - gateTile.y) <= 4),
    `the landlord, porter, and watchman physically move toward the real courtyard gate: ${JSON.stringify(['landlady_polina', 'porter_gavrila', 'junior_guard_sergey'].map(id => ({ id, mapId: guided.hosts[id].mapId, position: guided.hosts[id].position })))}`);
    const gate = maps.courtyard.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.name === '거리로 나가는 안뜰 문');
    const collision = maps.courtyard.layers.find(layer => layer.name === 'Collision').data;
    const open = (x, y) => x >= 0 && y >= 0 && x < maps.courtyard.width && y < maps.courtyard.height
      && collision[y * maps.courtyard.width + x] === 0;
    const exitPosition = { x: gate.x / 16, y: gate.y / 16 };
    const adjacent = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => ({ x: exitPosition.x + dx, y: exitPosition.y + dy })).filter(tile => open(tile.x, tile.y));
    const directions = [[0, -1, 'up'], [1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left']];
    for (let steps = 0; steps < 120 && Math.abs(guided.player.position.x - exitPosition.x) + Math.abs(guided.player.position.y - exitPosition.y) > 1; steps += 1) {
      const start = guided.player.position, queue = [start], previous = new Map([[`${start.x},${start.y}`, null]]);
      let target = null;
      for (let cursor = 0; cursor < queue.length && !target; cursor += 1) {
        const here = queue[cursor];
        if (adjacent.some(tile => tile.x === here.x && tile.y === here.y)) { target = here; break; }
        for (const [dx, dy] of directions) {
          const next = { x: here.x + dx, y: here.y + dy }, key = `${next.x},${next.y}`;
          if (open(next.x, next.y) && !previous.has(key)) { previous.set(key, { prior: `${here.x},${here.y}`, direction: dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right' }); queue.push(next); }
        }
      }
      assert.ok(target, 'the player can find a walkable route from the courtyard to its public gate');
      let key = `${target.x},${target.y}`, firstDirection = null;
      while (previous.get(key)?.prior) { firstDirection = previous.get(key).direction; key = previous.get(key).prior; }
      const step = game.moveActor(guided, firstDirection, maps.courtyard, maps);
      guided = step.moved ? step.state : game.advanceNpcWorld(guided, 1, maps);
    }
    const transitioned = game.transitionMap(guided, 'courtyard-nevsky-gate', maps);
    assert.equal(transitioned.ok, true, 'the embodied tenant leaves through the actual map exit');
    guided = game.advanceNpcWorld(transitioned.state, 5, maps);
    assert.equal(guided.world.livingEventStates.E27.stage, 'RESIDENTS_EVACUATED');
    assert.equal(guided.world.livingEventStates.E27.status, 'RESOLVED');
    const playerEvacuation = guided.ledger.flatMap(row => row.livingEvents ?? [])
      .find(row => row.catalogEventId === 'E27' && row.stage === 'RESIDENTS_EVACUATED');
    assert.equal(playerEvacuation?.witnessedByPlayer, true,
      'the player retains direct knowledge of the evacuation they personally led');
    assert.equal(guided.world.livingEventStates.E27.propertyDamage, 0);
    assert.ok(guided.world.livingEventStates.E27.actorHostIds.every(id => guided.hosts[id].mapId === 'nevsky'));
    const evacuatedSave = game.loadGame(game.saveGame(guided), { maps, hostCards: cards, quests });
    assert.equal(game.stateHash(evacuatedSave), game.stateHash(guided), 'the completed physical evacuation survives save/load');
  }
}

const ignored = game.advanceNpcWorld(active, 61, maps);
assert.equal(ignored.world.livingEventStates.E27.stage, 'DAMAGE_SPREAD');
assert.equal(ignored.world.livingEventStates.E27.propertyDamage, 1);
assert.deepEqual(courtyardFireDamageMark(ignored, maps.courtyard), { x: 16, y: 9, severity: 1 });
assert.equal(courtyardFireDamageMark(active, maps.courtyard), null, 'unresolved fire does not leave a permanent mark');
assert.equal(courtyardFireDamageMark(ignored, maps.nevsky), null, 'damage appears only on the affected courtyard map');
assert.ok(ignored.hosts.tenant_mikhail.needs.safetyConcern > active.hosts.tenant_mikhail.needs.safetyConcern);
assert.ok(ignored.ledger.flatMap(row => row.livingEvents ?? []).some(row => row.catalogEventId === 'E27' && row.stage === 'DAMAGE_SPREAD'));
console.log('V37 E27: conditional fire trigger, physical choices, saved outcomes, and unattended damage passed');
