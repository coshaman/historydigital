import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { europeNewsWaitForReaders } from '../rpg/engine/quest-presentation.mjs';

const readJson = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8').then(JSON.parse);
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const map = await readJson(`rpg/maps/${file}`);
  return [map.mapId, map];
})));
const characterFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const cards = await Promise.all(characterFiles.map(file => readJson(`rpg/characters/${file}`)));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;

test('each MAIN03 opening role can travel through the courtyard door into the news salon', () => {
  const inn = maps['inn-interior'];
  const door = maps.courtyard.layers.flatMap(layer => layer.objects ?? [])
    .find(object => object.type === 'map-exit' && object.properties?.some(property => property.name === 'exitId' && property.value === 'courtyard-inn'));
  assert.ok(door, 'the courtyard has a physical entrance to the salon');
  const x = Math.floor(door.x / 16), y = Math.floor(door.y / 16);
  const accessIds = new Set(inn.metadata.access.allowedCharacterIds);

  for (const hostId of ['editor_sofia', 'student_vasily', 'minor_noble_andrei']) {
    const card = cards.find(item => item.id === hostId);
    assert.ok(card.allowedMaps.includes('courtyard'), `${hostId} can reach the shared courtyard`);
    assert.ok(card.allowedMaps.includes('inn-interior'), `${hostId} can enter the salon map`);
    assert.ok(accessIds.has(hostId), `${hostId} is admitted by the salon door`);

    const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'courtyard' });
    state.world.chapterId = 'V33_1848_PUBLIC';
    state.world.date = '1848-04-15';
    state.world.clockMinutes = 9 * 60;
    state.world.currentMapId = 'courtyard';
    state.player.embodiment = hostId;
    state.player.position = { x, y: y + 1 };
    state.hosts[hostId].mapId = 'courtyard';
    state.hosts[hostId].historicalAliveAndPresent = true;
    state.hosts[hostId].position = { ...state.player.position };

    const entered = game.transitionMap(state, 'courtyard-inn', maps);
    assert.equal(entered.ok, true, `${hostId} should enter the MAIN03 opening scene: ${entered.reason}`);
    assert.equal(entered.state.world.currentMapId, 'inn-interior');
    assert.equal(entered.state.player.embodiment, hostId);
  }
});

test('MAIN03 manifesto readers get a short in-world wait only at the active reading site', () => {
  const state = {
    world: { currentMapId: 'printshop', clockMinutes: 620, livingEventStates: { E42: {
      status: 'ACTIVE', stage: 'NOTICE_ARRIVED', actorHostIds: ['clerk_alexei', 'printer_ekaterina', 'reader_darya', 'student_vasily'],
      venueMapId: 'printshop', scenePosition: { x: 14, y: 9 }, resolvesAtMinute: 710,
    } } },
    player: { embodiment: 'clerk_alexei' },
    hosts: { clerk_alexei: { id: 'clerk_alexei', historicalAliveAndPresent: true, mapId: 'printshop', position: { x: 13, y: 9 } } },
  };
  assert.deepEqual(europeNewsWaitForReaders(state), {
    eventId: 'E42', label: '선언문을 읽으러 사람들이 올 때까지 기다린다', minutes: 15,
  }, 'waiting advances the actual NPC simulation in readable quarter-hour steps');
  state.world.clockMinutes = 708;
  assert.equal(europeNewsWaitForReaders(state).minutes, 2, 'the wait never advances beyond the event deadline');
  state.world.livingEventStates.E42.stage = 'READING_READY';
  assert.equal(europeNewsWaitForReaders(state), null, 'once the readers gather, the player must read and choose instead of waiting');
  state.world.livingEventStates.E42.stage = 'NOTICE_ARRIVED';
  state.player.embodiment = 'innkeeper_irina';
  assert.equal(europeNewsWaitForReaders(state), null, 'only a person involved in the historical scene can use its wait action');
});
