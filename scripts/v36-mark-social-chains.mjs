import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const arcs=[
  {id:'FYODOR_OVEN_ORDER_1847',partner:'market_nadezhda',files:['baker-fyodor-life-extra-1-1847','baker-fyodor-life-extra-2-1847','baker-fyodor-life-extra-3-1847']},
  {id:'LEV_BOOK_RESERVATION_1847',partner:'reader_darya',files:['bookseller-lev-life-1-1847','bookseller-lev-life-2-1847','bookseller-lev-life-3-1847']},
  {id:'ROMAN_ROUTE_PRIORITY_1847',partner:'courier_pavel',files:['carter-roman-life-extra-1-1847','carter-roman-life-extra-2-1847','carter-roman-life-extra-3-1847']},
  {id:'ALEXEI_ENVELOPE_REGISTER_1847',partner:'printer_ekaterina',files:['clerk-alexei-life-1-1847','clerk-alexei-life-2-1847','clerk-alexei-life-3-1847']},
  {id:'SOFIA_MISSING_RECEIPTS_1847',partner:'courier_pavel',files:['editor-sofia-chain-1-stage-1-1847','editor-sofia-chain-1-stage-2-1847','editor-sofia-chain-1-stage-3-1847']},
  {id:'OLGA_WARNING_AND_RUMOR_1847',partner:'servant_varvara',files:['housemaid-olga-chain-4-stage-1-1847','housemaid-olga-chain-4-stage-2-1847','housemaid-olga-chain-4-stage-3-1847']},
  {id:'SERGEY_ENTRY_AND_FAVOR_1847',partner:'senior_clerk_konstantin',files:['junior-guard-sergey-chain-6-stage-1-1847','junior-guard-sergey-chain-6-stage-2-1847','junior-guard-sergey-chain-6-stage-3-1847']},
  {id:'POLINA_COMMON_FIREWOOD_1847',partner:'tenant_mikhail',files:['landlady-polina-life-extra-1-1847','landlady-polina-life-extra-2-1847','landlady-polina-life-extra-3-1847']},
  {id:'AVDOTYA_CARE_COSTS_1847',partner:'landlady_polina',files:['midwife-avdotya-chain-5-stage-1-1847','midwife-avdotya-chain-5-stage-2-1847','midwife-avdotya-chain-5-stage-3-1847']},
  {id:'GAVRILA_LOAD_AND_REST_1847',partner:'warehouse_pyotr',files:['porter-gavrila-life-extra-1-1847','porter-gavrila-life-extra-2-1847','porter-gavrila-life-extra-3-1847']},
];
const names=new Map();
for(const file of await (await import('node:fs/promises')).readdir(path.join(root,'rpg/characters'))){if(!file.endsWith('.json'))continue;const card=JSON.parse(await readFile(path.join(root,'rpg/characters',file),'utf8'));names.set(card.id,card.displayNameKo);}
for(const arc of arcs){
  if(!names.has(arc.partner))throw new Error(`unknown social partner ${arc.partner}`);
  for(const [index,slug] of arc.files.entries()){
    const file=path.join(root,'rpg/quests',`${slug}.json`),quest=JSON.parse(await readFile(file,'utf8'));
    const owner=quest.entry.requiredHostId;
    if(owner===arc.partner||quest.lifeChain?.id!==arc.id||quest.lifeChain.stage!==index+1)throw new Error(`wrong chain stage for ${slug}`);
    quest.socialChain={id:`SOCIAL_${arc.id}`,partnerHostId:arc.partner,partnerNameKo:names.get(arc.partner),progressStage:index+1,stageCount:3};
    quest.lifeChain.kind='SOCIAL';
    quest.lifeChain.partnerHostId=arc.partner;
    for(const action of quest.actions){
      action.effects??={};
      action.effects.relations??={};
      action.effects.relations[arc.partner]=`${quest.titleKo}에서 함께 맡은 일을 확인했다`;
      action.effects.partnerRelationKo=`${names.get(owner)}와 함께 ${action.labelKo}를 정했다.`;
    }
    await writeFile(file,`${JSON.stringify(quest,null,2)}\n`,'utf8');
  }
}
console.log(JSON.stringify({status:'PASS',socialChains:arcs.length,threeStageQuestRecords:arcs.length*3,partnerEdges:arcs.map(item=>[item.id,item.partner])},null,2));
