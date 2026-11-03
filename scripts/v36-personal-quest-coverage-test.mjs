import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolveQuestGuidance } from '../rpg/engine/quest-guidance.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const root = new URL('../', import.meta.url);
const readJson = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const maps = Object.fromEntries(await Promise.all((await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const cards = await Promise.all((await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/characters/${file}`)));
const quests = (await Promise.all((await readdir(new URL('../rpg/quests/', import.meta.url))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/quests/${file}`)))).filter(quest => Array.isArray(quest.actions) && quest.historicalOutcome?.id);
const residents = cards.filter(card => card.kind === 'FICTIONAL' && !card.id.startsWith('literary_'));
const coveredHosts = new Set(quests.flatMap(quest => quest.actions.flatMap(action => action.hostIds ?? [])));
const threeChoicePersonalQuests = quests.filter(quest => quest.entry?.requiredHostId && quest.actions.length === 3
  && quest.actions.every(action => action.hostIds?.includes(quest.entry.requiredHostId)));
const dedicatedQuestHosts = new Set(threeChoicePersonalQuests.map(quest => quest.entry.requiredHostId));
const residentChains = new Map();
for (const quest of quests.filter(item => item.lifeChain?.stageCount >= 3 && item.entry?.requiredHostId)) {
  const stages = residentChains.get(quest.lifeChain.id) ?? [];
  stages.push(quest); residentChains.set(quest.lifeChain.id, stages);
}
assert.ok(quests.length >= 37, 'personal and authored campaign story quests should remain available as structured data');
assert.ok(threeChoicePersonalQuests.length >= 30, 'at least 30 complete personal quests need three consequential choices');
assert.equal(residents.length, 36, 'the city roster should contain 36 fictional residents');
assert.deepEqual(residents.filter(person => !coveredHosts.has(person.id)).map(person => person.id), [], 'every resident needs at least one personal quest action');
assert.deepEqual(residents.filter(person => !dedicatedQuestHosts.has(person.id)).map(person => person.id), [], 'every resident needs a complete personally assigned three-choice life quest');
for (const [chainId, stages] of residentChains) {
  assert.equal(stages.length, stages[0].lifeChain.stageCount, `${chainId} must include every authored stage`);
  assert.deepEqual(stages.map(stage => stage.lifeChain.stage).sort((a,b) => a-b), Array.from({length:stages.length},(_,i)=>i+1), `${chainId} stages must be sequential`);
  for (const stage of stages) assert.ok(stage.actions.every(action => action.hostIds?.includes(stage.entry.requiredHostId)), `${stage.id} must remain playable by its assigned resident`);
  for (const stage of stages.slice(1)) {
    const previous = stages.find(item => item.lifeChain.stage === stage.lifeChain.stage - 1);
    assert.equal(stage.lifeChain.previousQuestId, previous.id, `${stage.id} life-chain progression names its previous stage`);
  }
}

const followupChains = [];
for (const stages of residentChains.values()) {
  const first = stages.find(stage => stage.lifeChain.stage === 1);
  const prerequisiteId = first.prerequisiteQuestIds?.[0];
  if (!prerequisiteId) continue;
  const prerequisite = quests.find(item => item.id === prerequisiteId);
  assert.ok(prerequisite, `${first.id} must wait for an existing personal task`);
  let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: first.entry.mapId });
  state.world.date = prerequisite.date;
  state.world.chapterId = prerequisite.chapterId;
  state.world.currentMapId = prerequisite.entry.mapId;
  state.player.embodiment = prerequisite.entry.requiredHostId;
  const hostId = prerequisite.entry.requiredHostId;
  const object = maps[prerequisite.entry.mapId].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === prerequisite.entry.objectId);
  state.player.position = { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) };
  state.hosts[hostId].mapId = prerequisite.entry.mapId;
  state.hosts[hostId].position = { ...state.player.position };
  let guidance = resolveQuestGuidance({ state, quests, maps, hostCards: cards });
  assert.equal(guidance.questId, prerequisite.id, `${first.id} must not hide the resident's current personal task`);
  let result = game.performQuestAction(state, { questId: prerequisite.id, hostId, actionId: prerequisite.actions[0].id, objectId: object.id }, { quests, maps });
  assert.equal(result.ok, true, `${prerequisite.id} unlock choice should execute: ${result.reason}`);
  state = result.state;
  guidance = resolveQuestGuidance({ state, quests, maps, hostCards: cards });
  assert.equal(guidance.questId, first.id, `${first.id} should appear immediately after its prerequisite`);
  const secondStage = stages.find(stage => stage.lifeChain.stage === 2);
  const secondObject = maps[secondStage.entry.mapId].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === secondStage.entry.objectId);
  const premature = game.performQuestAction(state, { questId: secondStage.id, hostId: secondStage.entry.requiredHostId, actionId: secondStage.actions[0].id, objectId: secondObject.id }, { quests, maps });
  assert.equal(premature.ok, false, `${secondStage.id} cannot be selected before the prior stage choice`);
  assert.equal(premature.reason, 'quest_chain_locked');
  for (const stage of stages.sort((a,b) => a.lifeChain.stage - b.lifeChain.stage)) {
    state.world.currentMapId = stage.entry.mapId;
    state.player.embodiment = stage.entry.requiredHostId;
    const stageObject = maps[stage.entry.mapId].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === stage.entry.objectId);
    state.player.position = { x: Math.floor(stageObject.x / 16), y: Math.floor(stageObject.y / 16) };
    state.hosts[stage.entry.requiredHostId].mapId = stage.entry.mapId;
    state.hosts[stage.entry.requiredHostId].position = { ...state.player.position };
    if (stage.socialChain?.partnerHostId) {
      const partnerId = stage.socialChain.partnerHostId;
      const map = maps[stage.entry.mapId];
      const collision = map.layers.find(layer => layer.name === 'Collision')?.data;
      const partnerTile = [
        { x: state.player.position.x + 1, y: state.player.position.y },
        { x: state.player.position.x - 1, y: state.player.position.y },
        { x: state.player.position.x, y: state.player.position.y + 1 },
        { x: state.player.position.x, y: state.player.position.y - 1 },
      ].find(tile => tile.x >= 0 && tile.y >= 0 && tile.x < map.width && tile.y < map.height
        && collision[tile.y * map.width + tile.x] === 0);
      assert.ok(partnerTile, `${stage.id} needs an adjacent walkable partner position`);
      state.hosts[partnerId].mapId = stage.entry.mapId;
      state.hosts[partnerId].position = partnerTile;
    }
    result = game.performQuestAction(state, { questId: stage.id, hostId: stage.entry.requiredHostId, actionId: stage.actions[0].id, objectId: stageObject.id }, { quests, maps });
    assert.equal(result.ok, true, `${stage.id} should advance: ${result.reason}`);
    state = result.state;
  }
  followupChains.push(first.lifeChain.id);
}

const newQuests = ['EDITOR_PUBLICATION_RECORD_1847','POLICE_TESTIMONY_RECORD_1849','READER_SOURCE_AND_RUMOR_1847',
  'SENIOR_CLERK_REVIEW_AND_SIGNATURE_1847','TENANT_RENT_AND_FIREWOOD_1847'];
const results = [];
for (const id of newQuests) {
  const quest = quests.find(item => item.id === id);
  assert.ok(quest, `${id} must be loaded into the authored quest corpus`);
  const hostId = quest.entry.requiredHostId, card = cards.find(item => item.id === hostId);
  assert.ok(card && card.allowedMaps.includes(quest.entry.mapId), `${hostId} must be able to reach their work record`);
  const map = maps[quest.entry.mapId];
  const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
  assert.equal(object?.properties?.find(property => property.name === 'questId')?.value, id, `${id} needs a visible physical object`);
  assert.ok(quest.actions.every(action => action.subcopyKo && action.followupKo && action.resultKo), `${id} needs meaningful choices and reactions`);
  assert.ok(quest.actions.every(action => { const parts = action.subcopyKo.split('·').map(part => part.trim()); return parts.length === 3 && parts[0].length > 2 && /남|장부|메모|기록|보관/.test(parts[1]) && parts[2].length > 8; }), `${id} must disclose audience, record, and broad risk`);
  let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: quest.entry.mapId });
  state.world.currentMapId = quest.entry.mapId;
  if (quest.chapterId === 'V33_1849_CIRCLE') { state.world.chapterId = quest.chapterId; state.world.date = quest.date; }
  state.player.embodiment = hostId;
  state.hosts[hostId].mapId = quest.entry.mapId;
  state.player.position = { x: Math.max(0, Math.floor(object.x / 16) - 1), y: Math.floor(object.y / 16) };
  state.hosts[hostId].position = { ...state.player.position };
  const guidance = resolveQuestGuidance({ state, quests, maps, hostCards: cards });
  assert.equal(guidance.questId, id, `${hostId} should see their own current problem first`);
  assert.equal(guidance.blocked, false, `${id} should be reachable`);
  assert.equal(questChoices(quest, hostId, [], state).length, 3, `${id} should present three choices at its object`);
  const action = quest.actions[0];
  const chosen = game.performQuestAction(state, { questId: id, hostId, actionId: action.id, objectId: quest.entry.objectId }, { quests, maps });
  assert.equal(chosen.ok, true, `${id} choice should execute: ${chosen.reason}`);
  assert.equal(chosen.state.quests[id].status, 'resolved', `${id} outcome should be recorded`);
  results.push({ questId: id, hostId, choiceCount: quest.actions.length, guidanceTarget: guidance.target, outcomeRecorded: true });
}
console.log(JSON.stringify({ status: 'PASS', fictionalResidents: residents.length, quests: quests.length,
  threeChoicePersonalQuests: threeChoicePersonalQuests.length, dedicatedQuestHosts: dedicatedQuestHosts.size,
  completeMultiStageLifeChains: residentChains.size, newlyUnlockedFollowupChains: followupChains.length, followupChainIds: followupChains,
  residentsWithoutQuest: 0, newQuestFlows: results }, null, 2));
