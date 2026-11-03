import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(),readJson=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const [mapFiles,characterFiles,questFiles]=await Promise.all(['rpg/maps','rpg/characters','rpg/quests'].map(dir=>readdir(path.join(root,dir))));
const [maps,cards,allQuests]=await Promise.all([
  Promise.all(mapFiles.filter(file=>file.endsWith('.json')).map(async file=>{const map=await readJson(`rpg/maps/${file}`);return[map.mapId,map]})).then(Object.fromEntries),
  Promise.all(characterFiles.filter(file=>file.endsWith('.json')).map(file=>readJson(`rpg/characters/${file}`))),
  Promise.all(questFiles.filter(file=>file.endsWith('.json')).map(file=>readJson(`rpg/quests/${file}`)))
]);
const quests=allQuests.filter(quest=>quest.historicalOutcome?.id&&Array.isArray(quest.actions));
const newHosts=new Set(['bookseller_lev','clerk_alexei','coachman_timofey','editor_sofia','housemaid_olga','junior_guard_sergey','lodging_tatyana','midwife_avdotya','printer_ekaterina','senior_clerk_konstantin','tenant_mikhail','yardkeeper_semyon','baker_fyodor','carter_roman','landlady_polina','porter_gavrila']);
const arcs=new Map();for(const quest of quests)if(quest.lifeChain?.kind==='PERSONAL'&&newHosts.has(quest.entry?.requiredHostId)){const stages=arcs.get(quest.lifeChain.id)??[];stages.push(quest);arcs.set(quest.lifeChain.id,stages);}
assert.equal(arcs.size,16,'sixteen unique missing-resident personal arcs must be playable');
const cardById=new Map(cards.map(card=>[card.id,card])),require=createRequire(import.meta.url);require('../rpg/engine/game-state.js');const game=globalThis.V33GameState;
let completedStages=0,persistentGoalsSatisfied=0;
for(const[id,stages]of arcs){
  stages.sort((a,b)=>a.lifeChain.stage-b.lifeChain.stage);assert.equal(stages.length,3,`${id} has three stages`);
  assert.deepEqual(stages.map(stage=>stage.lifeChain.stage),[1,2,3]);
  const hostId=stages[0].entry.requiredHostId,card=cardById.get(hostId);assert.ok(card.allowedMaps.length>=3,`${hostId} has three reachable neighborhoods`);
  let state=game.createInitialState({maps,hostCards:cards,quests,startMapId:stages[0].entry.mapId});
  const internalIds=new Set(stages.map(stage=>stage.id));
  for(const quest of stages)for(const prerequisiteId of quest.prerequisiteQuestIds??[])if(!internalIds.has(prerequisiteId))state.quests[prerequisiteId]={status:'resolved'};
  const second=stages[1],secondObject=maps[second.entry.mapId].layers.find(layer=>layer.name==='Interactions').objects.find(object=>object.id===second.entry.objectId);
  state.player.embodiment=hostId;state.hosts[hostId].mapId=stages[0].entry.mapId;state.hosts[hostId].position={x:card.start.x,y:card.start.y};
  const skipped=game.performQuestAction(state,{questId:second.id,hostId,actionId:second.actions[0].id,objectId:secondObject.id},{quests,maps});assert.equal(skipped.reason,'quest_chain_locked',`${id} cannot skip stage one`);
  for(const quest of stages){
    const map=maps[quest.entry.mapId],marker=map.layers.find(layer=>layer.name==='Interactions').objects.find(object=>object.id===quest.entry.objectId);
    assert.ok(marker&&marker.type==='quest-object',`${quest.id} is placed in the city`);assert.ok(quest.actions.length===3,`${quest.id} has three authored directions`);
    assert.ok(quest.actions.every(action=>Object.values(action.practicalDisclosure??{}).every(value=>typeof value==='string'&&value.length>0)),`${quest.id} explains audience, record, and risk`);
    state.world.currentMapId=map.mapId;state.world.chapterId=quest.chapterId;state.world.date=quest.date;state.player.embodiment=hostId;state.player.position={x:Math.floor(marker.x/16),y:Math.floor(marker.y/16)};
    state.hosts[hostId].mapId=map.mapId;state.hosts[hostId].position={...state.player.position};
    const result=game.performQuestAction(state,{questId:quest.id,hostId,actionId:quest.actions[0].id,objectId:marker.id},{quests,maps});assert.equal(result.ok,true,`${quest.id} resolves at its marker: ${result.reason}`);
    state=result.state;completedStages++;
    if(quest.lifeChain.stage===1){
      assert.equal(state.hosts[hostId].personalGoalProgress[`${hostId}:relationship`].status,'SATISFIED',`${hostId} relationship goal responds to an authored choice`);
      const restored=game.loadGame(game.saveGame(state),{maps,hostCards:cards,quests});assert.deepEqual(restored.hosts[hostId].personalGoalProgress,state.hosts[hostId].personalGoalProgress,'goal state survives save/load');state=restored;
    }
  }
  assert.equal(state.world.lifeChains[id].stage,3);
  assert.equal(state.hosts[hostId].personalGoalProgress[`${hostId}:life-arc`].status,'SATISFIED',`${hostId} life goal resolves only after stage three`);
  persistentGoalsSatisfied++;
}
console.log(JSON.stringify({status:'PASS',newPersonalArcs:arcs.size,questStages:completedStages,lifeGoalsSatisfied:persistentGoalsSatisfied,relationshipGoalsResponded:arcs.size,progressionSkipDenied:true,saveReloadPreservedGoalProgress:true},null,2));
