import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildRoute } from './v33-ending-route-matrix.mjs';
import { attachV47StoryObjects, v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const root = process.cwd();
const readJson = relative => readFile(path.join(root, relative), 'utf8').then(JSON.parse);
const campaign = await readJson('rpg/quests/campaign.json');
const mapNames = await readdir(path.join(root, 'rpg/maps'));
const maps = Object.fromEntries(await Promise.all(mapNames.filter(name => name.endsWith('.json'))
  .map(async name => { const map = await readJson(`rpg/maps/${name}`); return [map.mapId, map]; })));
attachV47StoryObjects(maps);
const v47Quests = [...v47StoryQuests, ...toV47StoryQuests()];
attachV47StoryBeatObjects(maps, v47Quests);
const quest = v47Quests.find(row => row.id === 'V47_MAIN01_A01');
const map = maps[quest.entry.mapId];
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === quest.entry.objectId);
assert.ok(object, 'the MAIN01 action is attached to its physical story object');
const objectTile = { x: Math.floor(object.x / map.tilewidth), y: Math.floor(object.y / map.tileheight) };
const adjacent = [[objectTile.x - 1, objectTile.y], [objectTile.x + 1, objectTile.y],
  [objectTile.x, objectTile.y - 1], [objectTile.x, objectTile.y + 1]]
  .find(([x, y]) => game.canOccupy(map, x, y));
assert.ok(adjacent, 'the story object has an adjacent walkable tile');

function resolveAfterStoryChoice(endingId, actionId) {
  const state = structuredClone(buildRoute(endingId, 0).stateBeforeEnding);
  const hostId = quest.actions.find(action => action.id === actionId).hostIds[0];
  state.world.chapterId = quest.chapterId;
  state.world.date = quest.date;
  state.world.currentMapId = map.mapId;
  state.player.embodiment = hostId;
  state.player.position = { x: adjacent[0], y: adjacent[1] };
  state.hosts[hostId].mapId = map.mapId;
  state.hosts[hostId].position = { ...state.player.position };
  state.quests[quest.id] = { status: 'open' };
  for (const prerequisiteId of quest.prerequisiteQuestIds ?? []) state.quests[prerequisiteId] = { status: 'resolved' };
  const selected = game.performQuestAction(state, { questId: quest.id, hostId, actionId, objectId: object.id },
    { quests: v47Quests, maps });
  assert.equal(selected.ok, true, `${actionId} is accepted by the production story reducer`);
  const endingDate = state.world.date;
  selected.state.world.chapterId = 'V33_1849_CIRCLE';
  selected.state.world.date = '1850-01-03';
  selected.state.world.currentMapId = 'chancery';
  assert.equal(endingDate, quest.date);
  const ending = game.resolveEnding(selected.state, endingId, campaign);
  assert.equal(ending.ok, true, `the existing ending still resolves after ${actionId}: ${ending.reason ?? ''}`);
  const row = ending.state.ledger.findLast(item => item.eventType === 'ENDING_RESOLVED');
  assert.deepEqual(row.storyConsequences, ending.state.endingStoryConsequences);
  return { ending, summary: ending.state.endingStoryConsequences };
}

const endings = ['UVAROV', 'BELINSKY', 'HERZEN', 'KHOMYAKOV', 'DOSTOEVSKY_PETRASHEVSKY'];
const routes = endings.map(endingId => {
  const reassign = resolveAfterStoryChoice(endingId, 'V47_A01_OPEN_SUBSCRIBER_LEDGER');
  const compare = resolveAfterStoryChoice(endingId, 'V47_A01_SEND_PAVEL_TO_PRINTSHOP');
  assert.notDeepEqual(reassign.summary, compare.summary,
    `${endingId}: distinct physical story choices produce distinct consequences in the resolved ending record`);
  assert.equal(reassign.ending.state.endingId, endingId, `${endingId} remains the selected authored ending`);
  assert.equal(compare.ending.state.endingId, endingId, `${endingId} remains available with the alternate story choice`);
  assert.equal(reassign.ending.state.world.immutableOutcomes.PETRASHEVSKY_ARRESTS_1849,
    compare.ending.state.world.immutableOutcomes.PETRASHEVSKY_ARRESTS_1849, `${endingId} does not alter fixed historical outcomes`);
  return { endingId, causalChoices: ['V47_A01_OPEN_SUBSCRIBER_LEDGER', 'V47_A01_SEND_PAVEL_TO_PRINTSHOP'], endingSummariesDiffer: true };
});
console.log(JSON.stringify({ status: 'PASS', questId: quest.id, routes }, null, 2));
