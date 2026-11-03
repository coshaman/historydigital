import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(), readJson=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const [mapFiles,cardFiles,questFiles]=await Promise.all(['rpg/maps','rpg/characters','rpg/quests'].map(dir=>readdir(path.join(root,dir))));
const [maps,cards,quests]=await Promise.all([
  Promise.all(mapFiles.filter(file=>file.endsWith('.json')).map(async file=>{const map=await readJson(`rpg/maps/${file}`);return [map.mapId,map]})).then(Object.fromEntries),
  Promise.all(cardFiles.filter(file=>file.endsWith('.json')).map(file=>readJson(`rpg/characters/${file}`))),
  Promise.all(questFiles.filter(file=>file.endsWith('.json')).map(file=>readJson(`rpg/quests/${file}`))).then(rows=>rows.filter(quest=>Array.isArray(quest.actions)&&quest.historicalOutcome?.id)),
]);
const cardsById=new Map(cards.map(card=>[card.id,card])), props=object=>Object.fromEntries((object.properties??[]).map(item=>[item.name,item.value]));
const social=quests.filter(quest=>quest.socialChain), chains=new Map();
assert.equal(social.length,30,'ten social arcs must expose three physical quest stages each');
for(const quest of social){const stages=chains.get(quest.socialChain.id)??[];stages.push(quest);chains.set(quest.socialChain.id,stages);}
assert.equal(chains.size,10,'exactly ten authored social arcs should be identifiable');
const require=createRequire(import.meta.url);require('../rpg/engine/game-state.js');const game=globalThis.V33GameState;
let completedStages=0,reciprocalUpdates=0;
for(const [id,stages] of chains){
  stages.sort((a,b)=>a.lifeChain.stage-b.lifeChain.stage);
  assert.equal(stages.length,3,`${id} contains three stages`);
  const partner=stages[0].socialChain.partnerHostId;
  assert.ok(cardsById.has(partner),`${id} names a resident partner`);
  const ownerIds=new Set(stages.map(item=>item.entry.requiredHostId));
  assert.equal(ownerIds.size,1,`${id} maintains one accountable resident across its arc`);
  let state=game.createInitialState({maps,hostCards:cards,quests,startMapId:stages[0].entry.mapId});
  const chainQuestIds = new Set(stages.map(quest => quest.id));
  for (const quest of stages) for (const prerequisiteId of quest.prerequisiteQuestIds ?? []) if (!chainQuestIds.has(prerequisiteId)) state.quests[prerequisiteId] = { status: 'resolved' };
  const first=stages[0],firstObject=maps[first.entry.mapId].layers.find(layer=>layer.name==='Interactions').objects.find(object=>object.id===first.entry.objectId);
  assert.ok(firstObject&&firstObject.type==='quest-object'&&props(firstObject).questId===first.id,`${first.id} has its own visible physical marker`);
  for(const quest of stages){
    const actorId=quest.entry.requiredHostId,card=cardsById.get(actorId),map=maps[quest.entry.mapId];
    assert.ok(card.allowedMaps.includes(map.mapId),`${actorId} can reach ${quest.id}`);
    assert.ok(cardsById.get(partner).allowedMaps.includes(map.mapId),`${partner} shares access to the social scene in ${quest.id}`);
    assert.equal(quest.socialChain.partnerHostId,partner,`${quest.id} retains the same relationship partner`);
    assert.equal(quest.lifeChain.kind,'SOCIAL');
    assert.equal(quest.lifeChain.stageCount,3);
    if(quest.lifeChain.stage>1)assert.equal(quest.lifeChain.previousQuestId,stages[quest.lifeChain.stage-2].id,`${quest.id} follows the prior stage`);
    const object=map.layers.find(layer=>layer.name==='Interactions').objects.find(item=>item.id===quest.entry.objectId);
    assert.ok(object&&object.type==='quest-object'&&props(object).questId===quest.id,`${quest.id} has a real physical quest marker`);
    assert.ok(quest.actions.length>=3&&quest.actions.every(action=>action.hostIds.includes(actorId)&&action.effects?.relations?.[partner]&&action.effects?.partnerRelationKo),`${quest.id} choices affect both sides of the relationship`);
    assert.ok(quest.actions.every(action=>action.subcopyKo.split('·').length>=3),`${quest.id} discloses audience, record, and risk before selection`);
  }
  const second=stages[1],secondObject=maps[second.entry.mapId].layers.find(layer=>layer.name==='Interactions').objects.find(object=>object.id===second.entry.objectId);
  state.player.embodiment=first.entry.requiredHostId;state.world.currentMapId=first.entry.mapId;
  state.hosts[first.entry.requiredHostId].mapId=first.entry.mapId;
  const denied=game.performQuestAction(state,{questId:second.id,hostId:second.entry.requiredHostId,actionId:second.actions[0].id,objectId:secondObject.id},{quests,maps});
  assert.equal(denied.reason,'quest_chain_locked',`${id} cannot skip its first relationship choice (quest=${second.id}, status=${state.quests[second.id]?.status}, action=${second.actions[0]?.id}, stages=${stages.map(item=>`${item.id}:${item.lifeChain.stage}`).join(',')})`);
  for(const quest of stages){
    const actorId=quest.entry.requiredHostId,map=maps[quest.entry.mapId],object=map.layers.find(layer=>layer.name==='Interactions').objects.find(item=>item.id===quest.entry.objectId);
    state.world.currentMapId=map.mapId;state.player.embodiment=actorId;state.player.position={x:Math.floor(object.x/16),y:Math.floor(object.y/16)};
    state.hosts[actorId].mapId=map.mapId;state.hosts[actorId].position={...state.player.position};
    const partnerState=state.hosts[partner],priorPartnerMap=partnerState.mapId,priorPartnerPosition={...partnerState.position};
    partnerState.mapId=map.mapId;partnerState.position={x:state.player.position.x+1,y:state.player.position.y};
    const absentState=structuredClone(state);absentState.hosts[partner].position={x:-100,y:-100};
    const absent=game.performQuestAction(absentState,{questId:quest.id,hostId:actorId,actionId:quest.actions[0].id,objectId:object.id},{quests,maps});
    assert.equal(absent.reason,'social_partner_not_present',`${quest.id} must wait for its named partner to be physically present`);
    const action=quest.actions[0],result=game.performQuestAction(state,{questId:quest.id,hostId:actorId,actionId:action.id,objectId:object.id},{quests,maps});
    assert.equal(result.ok,true,`${quest.id} advances from its real marker: ${result.reason}`);
    assert.equal(result.state.hosts[partner].relations[actorId],action.effects.partnerRelationKo,`${quest.id} records the counterpart's reciprocal relationship`);
    assert.equal(result.state.ledger.at(-1).socialChainId,id);
    state=result.state;state.hosts[partner].mapId=priorPartnerMap;state.hosts[partner].position=priorPartnerPosition;completedStages++;reciprocalUpdates++;
  }
}
const main=await readFile(path.join(root,'rpg/main.js'),'utf8');
const runtimeSlugs=['baker-fyodor-life-extra-1-1847','baker-fyodor-life-extra-2-1847','baker-fyodor-life-extra-3-1847','bookseller-lev-life-1-1847','bookseller-lev-life-2-1847','bookseller-lev-life-3-1847','carter-roman-life-extra-1-1847','carter-roman-life-extra-2-1847','carter-roman-life-extra-3-1847','clerk-alexei-life-1-1847','clerk-alexei-life-2-1847','clerk-alexei-life-3-1847','editor-sofia-chain-1-stage-1-1847','editor-sofia-chain-1-stage-2-1847','editor-sofia-chain-1-stage-3-1847','housemaid-olga-chain-4-stage-1-1847','housemaid-olga-chain-4-stage-2-1847','housemaid-olga-chain-4-stage-3-1847','junior-guard-sergey-chain-6-stage-1-1847','junior-guard-sergey-chain-6-stage-2-1847','junior-guard-sergey-chain-6-stage-3-1847','landlady-polina-life-extra-1-1847','landlady-polina-life-extra-2-1847','landlady-polina-life-extra-3-1847','midwife-avdotya-chain-5-stage-1-1847','midwife-avdotya-chain-5-stage-2-1847','midwife-avdotya-chain-5-stage-3-1847','porter-gavrila-life-extra-1-1847','porter-gavrila-life-extra-2-1847','porter-gavrila-life-extra-3-1847'];
assert.ok(runtimeSlugs.every(slug=>main.includes(`'${slug}'`)),'main runtime must load every tagged social chain stage');
console.log(JSON.stringify({status:'PASS',socialChains:chains.size,threeStageQuestRecords:social.length,completedStages,reciprocalRelationshipUpdates:reciprocalUpdates,allChoicesDisclosePracticalRisk:true},null,2));
