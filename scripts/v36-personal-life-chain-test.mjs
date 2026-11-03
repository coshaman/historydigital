import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const cards = await Promise.all((await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json')).map(file => readJson(`rpg/characters/${file}`)));
const questFiles = (await readdir(new URL('../rpg/quests/', import.meta.url))).filter(file => file.endsWith('.json'));
const quests = (await Promise.all(questFiles.map(file => readJson(`rpg/quests/${file}`))))
  .filter(quest => Array.isArray(quest.actions) && quest.historicalOutcome?.id);
const runtimeBundle = await readJson('rpg/quests/resident-arcs-v36.json');
assert.equal(runtimeBundle.schemaVersion, 'V36_RESIDENT_ARC_BUNDLE_1');
assert.equal(runtimeBundle.residentCount, 36);
assert.equal(runtimeBundle.chainCount, 36);
assert.equal(runtimeBundle.quests.length, 108, 'the browser loads a single bundle containing all 36 three-stage resident arcs');
const bundledHosts = new Set(runtimeBundle.quests.filter(item => item.lifeChain?.stage === 1).map(item => item.entry?.requiredHostId));
assert.equal(bundledHosts.size, 36, 'each fictional resident arc is present in the actual runtime-loaded bundle');
const groups = new Map();
for (const quest of quests) if (quest.lifeChain?.stageCount === 3) {
  const group = groups.get(quest.lifeChain.id) ?? [];
  group.push(quest);
  groups.set(quest.lifeChain.id, group);
}
assert.ok(groups.size >= 30, 'V36 requires at least thirty distinct personal three-stage chains');
const residentArcCandidates = new Map();
for (const [chainId, stages] of groups) {
  stages.sort((a, b) => a.lifeChain.stage - b.lifeChain.stage);
  if (stages.length !== 3 || stages.some((stage, index) => stage.lifeChain.stage !== index + 1)) continue;
  const first = stages[0], hostId = first.entry?.requiredHostId;
  if (!hostId || !cards.some(card => card.id === hostId && card.kind === 'FICTIONAL')) continue;
  const candidates = residentArcCandidates.get(hostId) ?? [];
  candidates.push({ chainId, stages });
  residentArcCandidates.set(hostId, candidates);
}
const residentsWithoutArc = cards.filter(card => card.kind === 'FICTIONAL' && !residentArcCandidates.has(card.id)).map(card => card.id);
assert.equal(residentArcCandidates.size, 36, `every fictional resident needs a complete three-stage personal arc; missing: ${residentsWithoutArc.join(', ')}`);
const playableResidentArcs = [...residentArcCandidates.entries()].map(([hostId, candidates]) => {
  candidates.sort((a, b) => Number(Boolean(a.stages[0].prerequisiteQuestIds?.length)) - Number(Boolean(b.stages[0].prerequisiteQuestIds?.length)) || Number(b.stages.some(stage => stage.socialChain)) - Number(a.stages.some(stage => stage.socialChain)) || a.chainId.localeCompare(b.chainId));
  return { hostId, ...candidates[0] };
});
let stageCompletions = 0;
const playedResidentArcs = [];
for (const { hostId, chainId, stages } of playableResidentArcs) {
  assert.deepEqual(stages.map(item => item.lifeChain.stage), [1, 2, 3], `${chainId} needs all three stages`);
  assert.equal(stages[0].entry.requiredHostId, hostId, `${chainId} is assigned to its resident`);
  assert.ok(hostId && cards.some(card => card.id === hostId), `${chainId} needs a playable resident`);
  let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: stages[0].entry.mapId });
  for (const prerequisiteId of stages[0].prerequisiteQuestIds ?? []) {
    const prerequisite = quests.find(item => item.id === prerequisiteId);
    assert.ok(prerequisite, `${chainId} prerequisite ${prerequisiteId} must exist`);
    const prerequisiteHostId = prerequisite.entry.requiredHostId;
    const prerequisiteMap = maps[prerequisite.entry.mapId];
    const prerequisiteObject = prerequisiteMap?.layers.find(layer => layer.name === 'Interactions')?.objects.find(item => item.id === prerequisite.entry.objectId);
    assert.ok(prerequisiteObject, `${prerequisiteId} needs a physical interaction object`);
    state.world.chapterId = prerequisite.chapterId;
    state.world.date = prerequisite.date;
    state.world.currentMapId = prerequisite.entry.mapId;
    state.player.embodiment = prerequisiteHostId;
    state.hosts[prerequisiteHostId].mapId = prerequisite.entry.mapId;
    state.hosts[prerequisiteHostId].position = { x: Math.floor(prerequisiteObject.x / 16), y: Math.floor(prerequisiteObject.y / 16) };
    state.player.position = { ...state.hosts[prerequisiteHostId].position };
    const prerequisiteResult = game.performQuestAction(state, { questId: prerequisite.id, hostId: prerequisiteHostId,
      actionId: prerequisite.actions[0].id, objectId: prerequisiteObject.id }, { quests, maps });
    assert.equal(prerequisiteResult.ok, true, `${prerequisiteId} must be physically resolvable before ${chainId}: ${prerequisiteResult.reason}`);
    state = prerequisiteResult.state;
  }
  for (let index = 0; index < stages.length; index += 1) {
    const quest = stages[index], object = maps[quest.entry.mapId]?.layers.find(layer => layer.name === 'Interactions')?.objects.find(item => item.id === quest.entry.objectId);
    assert.ok(object, `${quest.id} points to a physical interaction object`);
    assert.equal(quest.entry.requiredHostId, hostId, `${quest.id} changes personal-quest owner`);
    assert.equal(new Set(quest.actions.map(action => action.id)).size, 3, `${quest.id} needs three distinct choices`);
    assert.ok(quest.actions.every(action => action.hostIds.includes(hostId) && action.subcopyKo && action.resultKo), `${quest.id} choices need visible direction and consequences`);
    state.world.chapterId = quest.chapterId;
    state.world.date = quest.date;
    state.world.currentMapId = quest.entry.mapId;
    state.player.embodiment = hostId;
    state.hosts[hostId].mapId = quest.entry.mapId;
    state.hosts[hostId].position = { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) };
    state.player.position = { ...state.hosts[hostId].position };
    if (quest.socialChain?.partnerHostId) {
      const partnerId = quest.socialChain.partnerHostId, map = maps[quest.entry.mapId];
      const collision = map.layers.find(layer => layer.name === 'Collision')?.data;
      const partnerTile = [
        { x: state.player.position.x + 1, y: state.player.position.y },
        { x: state.player.position.x - 1, y: state.player.position.y },
        { x: state.player.position.x, y: state.player.position.y + 1 },
        { x: state.player.position.x, y: state.player.position.y - 1 },
      ].find(tile => tile.x >= 0 && tile.y >= 0 && tile.x < map.width && tile.y < map.height
        && collision[tile.y * map.width + tile.x] === 0
        && !Object.values(state.hosts).some(host => host.id !== hostId && host.id !== partnerId && host.historicalAliveAndPresent !== false
          && host.mapId === quest.entry.mapId && host.position.x === tile.x && host.position.y === tile.y));
      assert.ok(partnerTile, `${quest.id} needs an adjacent open tile for ${partnerId}`);
      state.hosts[partnerId].mapId = quest.entry.mapId;
      state.hosts[partnerId].position = partnerTile;
    }
    if (index === 0) {
      const skipped = game.performQuestAction(state, { questId: stages[1].id, hostId, actionId: stages[1].actions[0].id, objectId: stages[1].entry.objectId }, { quests, maps });
      assert.equal(skipped.reason, 'quest_chain_locked', `${chainId} must not skip stage 1`);
    }
    const result = game.performQuestAction(state, { questId: quest.id, hostId, actionId: quest.actions[index % quest.actions.length].id, objectId: object.id }, { quests, maps });
    assert.equal(result.ok, true, `${quest.id} should be playable at its work object: ${result.reason}`);
    state = result.state;
    stageCompletions += 1;
  }
  assert.deepEqual(state.world.lifeChains[chainId].history.map(item => item.stage), [1, 2, 3]);
  playedResidentArcs.push({ hostId, chainId, stageQuestIds: stages.map(stage => stage.id) });
}
const report = { schemaVersion:'V36_PERSONAL_LIFE_CHAIN_TEST_2', status:'PASS', completeThreeStageChains:groups.size, residentsWithPlayableThreeStageArcs:residentArcCandidates.size, residentArcsPlayed:playedResidentArcs.length, physicalStagesCompleted:stageCompletions, playedResidentArcs, choiceDirectionsAudited:true, skippedStageBlocked:true };
await mkdir(new URL('../docs/v36/current-audit/', import.meta.url), { recursive:true });
await writeFile(new URL('../docs/v36/current-audit/PERSONAL_LIFE_CHAIN_ACCEPTANCE.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
