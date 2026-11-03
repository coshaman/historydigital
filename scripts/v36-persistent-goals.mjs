import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(), readJson=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const characterDir=path.join(root,'rpg/characters'),questDir=path.join(root,'rpg/quests');
const characters=await Promise.all((await readdir(characterDir)).filter(file=>file.endsWith('.json')).map(file=>readJson(`rpg/characters/${file}`)));
const quests=(await Promise.all((await readdir(questDir)).filter(file=>file.endsWith('.json')).map(file=>readJson(`rpg/quests/${file}`)))).filter(quest=>quest.historicalOutcome?.id&&Array.isArray(quest.actions));
const active=characters.filter(card=>card.kind==='FICTIONAL'&&!card.id.startsWith('literary_'));
const arcs=new Map();
for(const quest of quests)if(quest.lifeChain?.stageCount>=3&&quest.lifeChain.kind!=='SOCIAL'){const stages=arcs.get(quest.lifeChain.id)??[];stages.push(quest);arcs.set(quest.lifeChain.id,stages);}
const complete=[...arcs].filter(([,stages])=>{const count=stages[0]?.lifeChain.stageCount;return stages.length>=count&&new Set(stages.map(item=>item.lifeChain.stage)).size>=count;});
const ownerChain=new Map();
for(const[id,stages]of complete)for(const quest of stages){const hostId=quest.entry?.requiredHostId;const preferred=stages[0]?.lifeChain.source==='V36_DEDICATED_PERSONAL_ARC';if(hostId&&(!ownerChain.has(hostId)||preferred))ownerChain.set(hostId,{id,stages});}
const knownIds=new Set(active.map(card=>card.id));
for(const card of active){
  const chain=ownerChain.get(card.id);
  if(!chain)throw new Error(`No complete personal chain for ${card.id}`);
  const partnerId=chain.stages.flatMap(quest=>quest.actions.flatMap(action=>Object.keys(action.effects?.relations??{}))).find(id=>knownIds.has(id))
    ??Object.keys(card.relations??{}).find(id=>knownIds.has(id));
  if(!partnerId)throw new Error(`No resident relationship for ${card.id}`);
  const baseline=card.relations?.[partnerId]??'';
  const relationName=characters.find(item=>item.id===partnerId)?.displayNameKo??partnerId;
  card.persistentPersonalGoals=[
    {id:`${card.id}:life-arc`,kind:'LIFE',titleKo:'이어 가는 생활 문제',descriptionKo:card.personalObjective,
    successCondition:{type:'LIFE_CHAIN_COMPLETED',chainId:chain.id,stageCount:chain.stages[0].lifeChain.stageCount},
      fallbackKo:'연쇄 임무가 지금 열리지 않으면 오늘의 일과를 이어가고, 다음 단계를 확인할 수 있을 때 다시 돌아온다.'},
    {id:`${card.id}:relationship`,kind:'RELATIONSHIP',titleKo:`${relationName}와의 관계`,
      descriptionKo:`${card.desires} · ${relationName}와 얽힌 사정을 당사자에게 확인한다.`,
      successCondition:{type:'RELATION_CHANGED',targetHostId:partnerId,baseline},
      fallbackKo:'상대가 다른 생활권에 있거나 만날 수 없으면 추측을 퍼뜨리지 말고, 다시 만날 수 있는 장소와 시간을 살핀다.'}
  ];
  await writeFile(path.join(characterDir,`${card.id}.json`),`${JSON.stringify(card,null,2)}\n`,'utf8');
}
console.log(JSON.stringify({status:'GENERATED',residents:active.length,persistentGoals:active.length*2,uniquePersonalChains:complete.length,relationshipGoals:active.length},null,2));
