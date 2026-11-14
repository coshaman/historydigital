import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { attachV47StoryObjects, v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { v47RoleProfiles } from '../rpg/data/v47-character-roles.mjs';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const v47Runtime = globalThis.V47MainStories;
const [mapNames, characterNames, registry, campaign] = await Promise.all([
  (await import('node:fs/promises')).readdir(path.join(root, 'rpg/maps')),
  (await import('node:fs/promises')).readdir(path.join(root, 'rpg/characters')),
  readJson('data/era_character_registry.json'), readJson('rpg/quests/campaign.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapNames.filter(name => name.endsWith('.json')).map(name => readJson(`rpg/maps/${name}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(characterNames.filter(name => name.endsWith('.json')).map(name => readJson(`rpg/characters/${name}`))),
]);
const hostCards = decorateCardsWithEraProfiles(cards, {
  ...registry, runtime_profiles: { ...registry.runtime_profiles, ...v47RoleProfiles },
});
const quests = [...v47StoryQuests, ...toV47StoryQuests()];
v47Runtime.registerStoryBeats(quests.filter(quest => quest.storyId));
const questById = new Map(quests.map(quest => [quest.id, quest]));
const storyIdForQuest = quest => quest.storyId ?? (quest.id.includes('MAIN01') ? 'MAIN01'
  : quest.id.includes('MAIN03') ? 'MAIN03' : quest.id.includes('MAIN05') ? 'MAIN05' : null);
attachV47StoryObjects(maps);
attachV47StoryBeatObjects(maps, quests);
const v47Ids = new Set(quests.map(quest => quest.id));
const replayCampaign = { arcs: campaign.arcs.filter(arc => arc.questIds.some(id => v47Ids.has(id))).map(arc => ({
  ...arc,
  optionalQuestIds: (arc.optionalQuestIds ?? []).filter(id => v47Ids.has(id)),
})) };
const storyIds = ['MAIN01', 'MAIN03', 'MAIN05'];
const publicTransitMapIds = new Set(['courtyard', 'workyard']);
const alternateActions = {
  V47_MAIN01_A01: 'V47_A01_SEND_PAVEL_TO_PRINTSHOP',
  V47_MAIN03_P03: 'V47_P03_PRESS_AND_ORDER',
  V47_MAIN05_C06: 'V47_C06_DISPERSE_CROWD',
};
const freeTileNear = (map, origin, used = new Set()) => {
  const queue = [{ ...origin, distance: 0 }], seen = new Set([`${origin.x},${origin.y}`]);
  while (queue.length) {
    const tile = queue.shift(), key = `${tile.x},${tile.y}`;
    if (tile.distance > 0 && !used.has(key) && game.canOccupy(map, tile.x, tile.y)) return { x: tile.x, y: tile.y };
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = tile.x + dx, y = tile.y + dy, nextKey = `${x},${y}`;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(nextKey)) continue;
      seen.add(nextKey); queue.push({ x, y, distance: tile.distance + 1 });
    }
  }
  return null;
};

async function replay(routeName) {
  let state = game.createInitialState({ maps, hostCards, quests, startMapId: 'printshop' });
  state.world.chapterId = replayCampaign.arcs[0].id;
  state.world.date = replayCampaign.arcs[0].date;
  state.world.clockMinutes = 600;
  state.world.v47.focusStoryId = 'MAIN01';
  for (const arc of replayCampaign.arcs) for (const questId of arc.questIds) {
    if (!v47Ids.has(questId)) state.quests[questId] = { status: 'resolved', result: 'PRIOR_CAMPAIGN_GATE' };
  }
  const rows = [];
  const autonomousIds = new Set();
  const logsByStory = Object.fromEntries(storyIds.map(id => [id, []]));

  for (let arcIndex = 0; arcIndex < replayCampaign.arcs.length; arcIndex += 1) {
    const arc = replayCampaign.arcs[arcIndex];
    if (state.world.chapterId !== arc.id) {
      const advanced = game.advanceChapter(state, arc.id, replayCampaign, maps);
      assert.equal(advanced.ok, true, `${routeName}: campaign enters ${arc.id}`);
      state = advanced.state;
    }
    const orderedIds = [...arc.questIds, ...arc.optionalQuestIds];
    for (const questId of orderedIds) {
      const quest = questById.get(questId);
      if (!quest) continue;
      if (quest.date > state.world.date) {
        if (questId === 'V47_MAIN03_P11' && !state.quests.E41_SEMENOVSKY_1849) {
          state.quests.E41_SEMENOVSKY_1849 = { status: 'resolved', result: 'FIXED_HISTORICAL_EVENT_RECORDED' };
        }
        const movedDate = game.advanceCampaignDate(state, quest.date, replayCampaign, quests);
        assert.equal(movedDate.ok, true, `${routeName}: timeline reaches ${quest.date} for ${quest.id}`);
        state = movedDate.state;
      }
      for (const prerequisiteId of quest.prerequisiteQuestIds ?? []) {
        if (state.quests[prerequisiteId]?.status !== 'resolved') state.quests[prerequisiteId] = { status: 'resolved', result: 'FIXED_HISTORICAL_GATE' };
      }
      const storyId = storyIdForQuest(quest);
      assert.ok(storyIds.includes(storyId), `${quest.id} is assigned to a V47 story`);
      state.world.v47.focusStoryId = storyId;
      const map = maps[quest.entry.mapId];
      const target = map.layers.find(layer => layer.name === 'Interactions')?.objects.find(item => item.id === quest.entry.objectId);
      assert.ok(target, `${quest.id} has an attached physical interaction`);
      const targetTile = { x: Math.floor(target.x / (map.tilewidth ?? 16)), y: Math.floor(target.y / (map.tileheight ?? 16)) };
      const adjacent = freeTileNear(map, targetTile);
      assert.ok(adjacent, `${quest.id} physical interaction has a reachable adjacent tile`);

      let accepted = null;
      const preferred = alternateActions[quest.id];
      const candidateActions = [...quest.actions].sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
      const failures = [];
      for (const action of candidateActions) {
        if (preferred && action.id !== preferred && routeName === 'ALTERNATE' && alternateActions[quest.id]) continue;
        for (const hostId of action.hostIds) {
          const card = hostCards.find(item => item.id === hostId);
          const host = state.hosts[hostId];
          if (!card || !host || !card.allowedMaps.includes(map.mapId) || host.historicalAliveAndPresent === false) continue;
          state.player.embodiment = null;
          const possessed = game.possessHostFromRoster(state, hostId, maps);
          if (!possessed.ok) { failures.push(`${action.id}/${hostId}:${possessed.reason}`); continue; }
          state = possessed.state;
          state.world.currentMapId = map.mapId;
          state.player.position = { ...adjacent };
          state.hosts[hostId].mapId = map.mapId;
          state.hosts[hostId].position = { ...adjacent };
          const used = new Set([`${adjacent.x},${adjacent.y}`]);
          const requiredPresent = [...(action.requiredPresentHostIds ?? [])];
          for (const participantId of requiredPresent) {
            const participantCard = hostCards.find(item => item.id === participantId);
            if (!participantCard?.allowedMaps.includes(map.mapId)) continue;
            const position = freeTileNear(map, targetTile, used);
            if (!position) continue;
            used.add(`${position.x},${position.y}`);
            state.hosts[participantId].historicalAliveAndPresent = true;
            state.hosts[participantId].mapId = map.mapId;
            state.hosts[participantId].position = position;
          }
          const result = game.performQuestAction(state, { questId, hostId, actionId: action.id, objectId: target.id }, { quests, maps });
          if (result.ok) { accepted = { action, hostId, result }; break; }
          failures.push(`${action.id}/${hostId}:${result.reason}`);
        }
        if (accepted) break;
      }
      assert.ok(accepted, `${routeName}: ${quest.id} has a legal continuous route. Tried: ${failures.join('; ')}`);
      state = accepted.result.state;
      const autoRows = Object.values(state.world.v47.events ?? {}).filter(event => event.npcAutonomy?.outcomeApplied);
      for (const event of autoRows) autonomousIds.add(event.id);
      const row = {
        storyId, questId, beatId: quest.beatId ?? questId,
        date: state.world.date, hostId: accepted.hostId, mapId: map.mapId, actionId: accepted.action.id,
        selectedAuthoredAlternative: accepted.action.id === preferred,
        status: state.quests[questId]?.status, materialChanges: Boolean(accepted.action.effects?.v47WorldChange),
        autonomy: state.world.v47.events?.[questId]?.npcAutonomy?.status ?? null,
      };
      rows.push(row);
      logsByStory[storyId].push(row);
      state = game.advanceWorldTime(state, 5, maps);
      const invalidRuntimeLocations = Object.values(state.hosts).flatMap(person => {
        const personCard = hostCards.find(item => item.id === person.id);
        const allowedTransit = person.v47TravelGoal?.status === 'EN_ROUTE'
          && publicTransitMapIds.has(person.mapId) && personCard?.allowedMaps.includes(person.v47TravelGoal.targetMapId);
        return personCard && maps[person.mapId] && (personCard.allowedMaps.includes(person.mapId) || allowedTransit) ? [] : [{
          hostId: person.id, mapId: person.mapId, activeGoal: person.activeGoal?.taskId ?? null,
          routineTarget: person.routineState?.targetMapId ?? null,
        }];
      });
      assert.deepEqual(invalidRuntimeLocations, [], `${routeName}: ${questId} autonomous tick preserves map access policy`);
    }
  }
  for (const storyId of storyIds) {
    const expected = quests.filter(quest => storyIdForQuest(quest) === storyId).length;
    assert.equal(logsByStory[storyId].length, expected, `${routeName}: all ${expected} beats for ${storyId} resolved`);
    assert.ok(logsByStory[storyId].every(row => row.status === 'resolved'), `${routeName}: ${storyId} has no unresolved replayed beats`);
  }
  const saved = game.saveGame(state);
  const invalidHostStates = Object.values(state.hosts).flatMap(host => {
    const card = hostCards.find(item => item.id === host.id);
    const allowedTransit = host.v47TravelGoal?.status === 'EN_ROUTE'
      && publicTransitMapIds.has(host.mapId) && card?.allowedMaps.includes(host.v47TravelGoal.targetMapId);
    return !card || !maps[host.mapId] || (!card.allowedMaps.includes(host.mapId) && !allowedTransit)
      || !Array.isArray(host.privateKnowledgeIds) || host.privateKnowledgeIds.some(id => !card.privateKnowledgeIds.includes(id))
      ? [{ hostId: host.id, mapId: host.mapId, mapAllowed: card?.allowedMaps.includes(host.mapId), privateKnowledgeIds: host.privateKnowledgeIds?.filter(id => !card.privateKnowledgeIds.includes(id)) }]
      : [];
  });
  assert.deepEqual(invalidHostStates, [], `${routeName}: saved NPCs remain in valid maps and knowledge scopes`);
  const restored = game.loadGame(saved, { maps, hostCards, quests });
  assert.deepEqual(restored.quests, state.quests, `${routeName}: all story outcomes survive save/load`);
  return { routeName, status: 'PASS', questCount: rows.length, byStory: logsByStory,
    autonomousEventIds: [...autonomousIds], finalDate: state.world.date,
    finalCholera: { counters: state.world.v47.cholera.counters,
      averageWaterRisk: state.world.v47.cholera.waterRisk, averageFoodRisk: state.world.v47.cholera.foodRisk },
    finalLedgerCount: state.ledger.length, rows };
}

function replayUnattendedEvent(questId) {
  const quest = questById.get(questId);
  const state = game.createInitialState({ maps, hostCards, quests, startMapId: quest.entry.mapId });
  state.world.chapterId = quest.chapterId;
  state.world.date = quest.date;
  state.world.clockMinutes = 540;
  state.world.currentMapId = quest.entry.mapId;
  for (const host of Object.values(state.hosts)) {
    if (!host.presenceWindow) continue;
    host.historicalAliveAndPresent = host.presenceWindow.startDate <= quest.date && quest.date <= host.presenceWindow.endDate;
    if (host.historicalAliveAndPresent && host.presenceWindow.start) {
      host.mapId = host.presenceWindow.start.mapId;
      host.position = { ...host.presenceWindow.start.position };
    }
  }
  const opened = game.advanceNpcWorld(state, 1, maps);
  const event = opened.world.v47.events[questId];
  assert.ok(event?.status === 'ACTIVE' && event.npcAutonomy?.assignedHostIds?.length,
    `${questId} starts a live NPC event on its authored date`);
  const progressed = game.advanceNpcWorld(opened, 2881, maps);
  const resolved = progressed.world.v47.events[questId];
  const outcome = progressed.ledger.find(row => row.eventType === 'V47_AUTONOMOUS_STORY_OUTCOME' && row.questId === questId);
  assert.equal(resolved.npcAutonomy.status, 'RESOLVED_UNATTENDED', `${questId} resolves after no player arrives`);
  assert.equal(resolved.npcAutonomy.outcomeApplied, true, `${questId} applies its authored NPC outcome`);
  assert.ok(outcome, `${questId} records the autonomous outcome in the ledger`);
  const movementRows = progressed.ledger.filter(row => row.eventType === 'NPC_SIMULATION').flatMap(row => row.moves ?? [])
    .filter(move => event.npcAutonomy.assignedHostIds.includes(move.hostId));
  assert.ok(movementRows.length > 0, `${questId} records NPC path movement before unattended resolution`);
  const restored = game.loadGame(game.saveGame(progressed), { maps, hostCards, quests });
  assert.equal(restored.world.v47.events[questId].npcAutonomy.outcomeApplied, true,
    `${questId} unattended outcome survives save/load`);
  return { questId, date: quest.date, status: resolved.npcAutonomy.status,
    assignedHostIds: event.npcAutonomy.assignedHostIds, arrivedHostIds: resolved.npcAutonomy.arrivedHostIds,
    movedHostIds: [...new Set(movementRows.map(move => move.hostId))], outcomeActionId: outcome.actionId,
    materialEffects: { money: outcome.money?.length ?? 0, inventory: outcome.inventory?.length ?? 0,
      moves: outcome.moves?.length ?? 0, rumorId: outcome.rumorId ?? null } };
}

const normal = await replay('NORMAL');
const alternate = await replay('ALTERNATE');
for (const storyId of storyIds) assert.ok(alternate.byStory[storyId].some(row => row.selectedAuthoredAlternative), `${storyId} has an alternate authored choice run`);
const unattendedEvents = [
  replayUnattendedEvent('V47_MAIN01_A03'),
  replayUnattendedEvent('V47_MAIN03_P03'),
  replayUnattendedEvent('V47_MAIN05_C01'),
];
const outputDir = path.join(root, 'artifacts/v47/CONTINUOUS_STORY_REPLAY');
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'V47_CONTINUOUS_REPLAY.json'), `${JSON.stringify({
  status: 'PASS', scope: 'continuous chronological reducer replay; story entry and physical scene locations are staged for each beat, so this is not browser traversal evidence',
  unattendedEvents,
  stories: storyIds.map(id => ({ storyId: id, beats: quests.filter(quest => quest.storyId === id).length,
    normalResolved: normal.byStory[id].length, alternateResolved: alternate.byStory[id].length,
    normalAutonomousEvents: normal.autonomousEventIds.filter(eventId => normal.byStory[id].some(row => row.questId === eventId)).length })),
  normal, alternate,
}, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', scope: 'continuous chronological state replay; not browser playthrough',
  normalBeats: normal.questCount, alternateBeats: alternate.questCount,
  autonomousEvents: unattendedEvents.map(event => ({ questId: event.questId, status: event.status,
    movedHostIds: event.movedHostIds.length, outcomeActionId: event.outcomeActionId })),
  finalDate: normal.finalDate, log: 'artifacts/v47/CONTINUOUS_STORY_REPLAY/V47_CONTINUOUS_REPLAY.json' }, null, 2));
