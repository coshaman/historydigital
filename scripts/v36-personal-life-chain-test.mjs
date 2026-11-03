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
const groups = new Map();
for (const quest of quests) if (quest.lifeChain?.stageCount === 3) {
  const group = groups.get(quest.lifeChain.id) ?? [];
  group.push(quest);
  groups.set(quest.lifeChain.id, group);
}
assert.equal(groups.size, 30, 'V36 requires thirty distinct personal three-stage chains');
const addedChains = new Set(['MARIYA_WASHING_WAGES_1847','YAKOV_REMEDY_LIMITS_1847','STEPAN_PROOF_AUTHorship_1847','ELIZAVETA_DAMAGED_BOOK_1847','YURI_COPYING_LEDGER_1847','IRINA_INN_PRIVACY_1847','VASILY_READING_CIRCLE_1847','LYUBOV_LESSON_ACCESS_1847','ANDREI_DEBT_STATUS_1847','LUKA_WATER_QUEUE_1847','KLAVDIYA_FISH_STORAGE_1847','VARVARA_PRIVATE_WARNING_1847','NIKITA_TYPESPEED_1847','MATRYONA_STREET_STALL_1847']);
assert.equal([...groups.keys()].filter(id => addedChains.has(id)).length, addedChains.size, 'all fourteen additional arcs must be present');
let stageCompletions = 0;
for (const [chainId, stages] of groups) {
  if (!addedChains.has(chainId)) continue;
  stages.sort((a, b) => a.lifeChain.stage - b.lifeChain.stage);
  assert.deepEqual(stages.map(item => item.lifeChain.stage), [1, 2, 3], `${chainId} needs all three stages`);
  const hostId = stages[0].entry.requiredHostId;
  assert.ok(hostId && cards.some(card => card.id === hostId), `${chainId} needs a playable resident`);
  let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: stages[0].entry.mapId });
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
}
const report = { schemaVersion:'V36_PERSONAL_LIFE_CHAIN_TEST_1', status:'PASS', completeThreeStageChains:groups.size, additionalChainsPlayed:addedChains.size, physicalStagesCompleted:stageCompletions, choiceDirectionsAudited:true, skippedStageBlocked:true };
await mkdir(new URL('../docs/v36/current-audit/', import.meta.url), { recursive:true });
await writeFile(new URL('../docs/v36/current-audit/PERSONAL_LIFE_CHAIN_ACCEPTANCE.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
