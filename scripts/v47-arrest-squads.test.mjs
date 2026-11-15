import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { attachV47StoryObjects, v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import runtime from '../rpg/engine/v47-main-stories.js';

const require = createRequire(import.meta.url);
const game = require('../rpg/engine/game-state.js');
const [mapFiles, characterFiles] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const [mapRows, cards] = await Promise.all([
  Promise.all(mapFiles.filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(new URL(`../rpg/maps/${name}`, import.meta.url), 'utf8')))),
  Promise.all(characterFiles.filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(new URL(`../rpg/characters/${name}`, import.meta.url), 'utf8')))),
]);
const maps = Object.fromEntries(mapRows.map(map => [map.mapId, map]));
const beats = toV47StoryQuests();
runtime.registerStoryBeats(beats);
runtime.registerV47Maps?.(maps);
attachV47StoryObjects(maps);
attachV47StoryBeatObjects(maps, beats);

test('the fixed arrest dispatches three independently moving search squads on walkable street tiles', () => {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [...v47StoryQuests, ...beats], startMapId: 'morskaya-intersection' });
  state.world.chapterId = 'V33_1849_CIRCLE';
  state.world.date = '1849-05-05';
  state.world.clockMinutes = 540;
  const opened = runtime.advanceV47World(state, { date: state.world.date, clockMinutes: 540 });
  const event = opened.world.v47.events.MAIN03_PETRASHEVSKY_ARREST;

  assert.equal(event.npcAutonomy.squads.length, 3);
  assert.equal(new Set(event.npcAutonomy.squads.map(squad => `${squad.mapId}:${squad.position.x},${squad.position.y}`)).size, 3);
  for (const squad of event.npcAutonomy.squads) {
    assert.ok(squad.route.length > 2, `${squad.id} has a real approach and search route`);
    let previous = squad.position;
    for (const step of squad.route) {
      assert.ok(Math.abs(step.x - previous.x) + Math.abs(step.y - previous.y) === 1, `${squad.id} walks one tile at a time`);
      assert.equal(maps[squad.mapId].layers.find(layer => layer.name === 'Collision').data[step.y * maps[squad.mapId].width + step.x], 0,
        `${squad.id} never crosses a blocked tile at ${step.x},${step.y}`);
      previous = step;
    }
  }

  const advanced = runtime.advanceV47World(opened, { date: state.world.date, clockMinutes: 543 });
  const moved = advanced.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.squads;
  assert.ok(moved.filter((squad, index) => squad.position.x !== event.npcAutonomy.squads[index].position.x
    || squad.position.y !== event.npcAutonomy.squads[index].position.y).length >= 2);
  assert.ok(advanced.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.squadMovementLog.length >= 2);

  let simulated = opened;
  for (let minute = 541; minute <= 660; minute += 1) {
    simulated = runtime.advanceV47World(simulated, { date: state.world.date, clockMinutes: minute });
    const activeSquads = simulated.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.squads
      .filter(squad => squad.mapId === 'morskaya-intersection');
    const occupied = activeSquads.map(squad => `${squad.position.x},${squad.position.y}`);
    assert.equal(new Set(occupied).size, occupied.length,
      `squads keep distinct street positions at minute ${minute}: ${JSON.stringify(activeSquads.map(({ id, position }) => ({ id, position })))}`);
  }
  const completed = simulated;
  const finishedEvent = completed.world.v47.events.MAIN03_PETRASHEVSKY_ARREST;
  assert.ok(finishedEvent.npcAutonomy.squads.every(squad => squad.status === 'AT_STATION'));
  assert.ok(finishedEvent.npcAutonomy.evidenceItems.every(item => item.status === 'STORED'));
  assert.ok(finishedEvent.npcAutonomy.evidenceItems.every(item => item.provenanceStatus === 'FICTIONAL_GAMEPLAY_PROP'));
  assert.ok(['책 묶음', '서류 꾸러미', '배달 영수증'].every(item => completed.hosts.police_sergeant_ivan.inventory.includes(item)));
  assert.equal(finishedEvent.npcAutonomy.squadMovementLog.filter(move => move.phase === 'STATION_ENTRY').length, 3);
  assert.equal(completed.world.v47.worldChanges.filter(change => change.actionId === 'NPC_ARREST_EVIDENCE_SEIZED').length, 3);
  assert.equal(completed.world.v47.worldChanges.filter(change => change.actionId === 'NPC_ARREST_EVIDENCE_STORED').length, 3);

  const interrupted = structuredClone(opened);
  interrupted.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.playerIntervened = true;
  const held = runtime.advanceV47World(interrupted, { date: state.world.date, clockMinutes: 600 });
  assert.deepEqual(held.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.squads,
    interrupted.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.squads,
    'a player intervention freezes autonomous operation state instead of overwriting the chosen branch');
});
