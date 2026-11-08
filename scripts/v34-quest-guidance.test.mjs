import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolveQuestGuidance } from '../rpg/engine/quest-guidance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const maps = Object.fromEntries(['nevsky','printshop','chancery','courtyard','dead-souls','overcoat'].map(id => [id,read(`rpg/maps/${id}.json`)]));
const hostCards = ['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','nekrasov_reconstruction','literary_chichikov','literary_akaky','literary_petrovich'].map(id=>read(`rpg/characters/${id}.json`));
const quests = ['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','literary-dead-souls','literary-overcoat'].map(id=>read(`rpg/quests/${id}.json`));
const require=createRequire(import.meta.url);require('../rpg/engine/game-state.js');const game=globalThis.V33GameState;
function stateAt(mapId='nevsky') { return game.createInitialState({maps,hostCards,quests,startMapId:mapId}); }
function embody(state,id) { const result=game.possessHost(state,id,maps[state.world.currentMapId]);assert.equal(result.ok,true,`expected ${id} to be at ${state.world.currentMapId}`);return result.state; }

test('observer guidance names a real person present on the current map and teaches reachable controls',()=>{
  const state=stateAt();const guide=resolveQuestGuidance({state,quests,maps,hostCards});
  assert.equal(guide.taskType,'POSSESS');assert.ok(guide.target);assert.equal(guide.target.mapId,state.world.currentMapId);
  assert.ok(state.hosts[guide.target.npcId].historicalAliveAndPresent);assert.ok(['seamstress_anna','printer_ekaterina'].includes(guide.target.npcId));assert.match(guide.howKo,/칸 이동한 뒤 E/);
  assert.match(guide.howKo,/왼쪽|오른쪽|위|아래/);
});

test('progress scope stays on the current quest actions after possession and source reading tells both physical steps',()=>{
  const state=stateAt();const first=resolveQuestGuidance({state,quests,maps,hostCards});
  state.player.position={...state.hosts[first.hostId].position};
  const embodied=embody(state,first.hostId);const next=resolveQuestGuidance({state:embodied,quests,maps,hostCards});
  assert.deepEqual(next.progress,first.progress);
  assert.equal(next.progress.totalSteps,quests.find(item=>item.id===next.questId).actions.length);
  assert.match(next.howKo,/E를 누른 뒤 열린 문서에서 읽기를 선택/);
});

test('all nine supported historical dialogue hosts receive a host-specific feasible next action',()=>{
  for(const id of ['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','nekrasov_reconstruction','literary_chichikov','literary_petrovich']){
    const card=hostCards.find(item=>item.id===id);const state=stateAt(card.start.mapId);state.world.date='1847-06-01';state.world.currentMapId=card.start.mapId;state.player.position={...state.hosts[id].position};const embodied=embody(state,id);
    const guide=resolveQuestGuidance({state:embodied,quests,maps,hostCards});
    assert.ok(guide.actionKo?.length>5,id);assert.equal(guide.known,true,id);
    if(guide.target?.kind==='exit')assert.ok(embodied.hosts[id].allowedMaps.includes(guide.target.finalMapId),id);
    if(guide.target?.mapId===embodied.world.currentMapId&&guide.target?.kind==='object')assert.ok(maps[guide.target.mapId].layers.find(l=>l.name==='Interactions').objects.some(o=>o.id===guide.target.objectId),id);
  }
});

test('every quest action host sees its own permitted object/source step; unauthorized hosts get a switch instruction',()=>{
  for(const quest of quests){
    for(const hostId of new Set(quest.actions.flatMap(action=>action.hostIds))){
      const card=hostCards.find(item=>item.id===hostId);const state=stateAt(quest.entry.mapId);
      state.world.chapterId=quest.chapterId;state.world.date=quest.date;
      if(quest.realmId||quest.chapterId.startsWith('LITERARY_'))state.world.activeRealm={id:quest.realmId??quest.chapterId};
      const pos=card.start.mapId===quest.entry.mapId?card.start:{mapId:quest.entry.mapId,x:8,y:12};
      state.hosts[hostId].mapId=quest.entry.mapId;state.hosts[hostId].position={x:pos.x,y:pos.y};
      state.hosts[hostId].privateKnowledgeIds=card.privateKnowledgeIds.filter(id=>!quest.actions.some(a=>a.requiredKnowledgeId===id));
      state.player.position={...state.hosts[hostId].position};const embodied=embody(state,hostId);
      const guide=resolveQuestGuidance({state:embodied,quests,maps,hostCards});
      assert.ok(guide.actionKo,`${quest.id}/${hostId}`);assert.ok(['READ','INSPECT','TRAVEL','SWITCH','RELEASE','WAIT','COMPLETE'].includes(guide.taskType),`${quest.id}/${hostId}/${guide.taskType}`);
      if(guide.target?.kind==='object')assert.equal(guide.target.mapId,quest.entry.mapId);
    }
  }
});

test('a host barred from the current quest is routed to a reachable eligible worker',()=>{
  const state=stateAt('courtyard');state.player.position={...state.hosts.tenant_mikhail.position};const embodied=embody(state,'tenant_mikhail');
  const guide=resolveQuestGuidance({state:embodied,quests,maps,hostCards});
  assert.equal(guide.taskType,'TRAVEL');assert.equal(guide.target.kind,'exit');assert.equal(guide.target.finalMapId,'nevsky');assert.match(guide.actionKo,/안나/);
});

test('a completed Matryona stall choice routes back to the next life-chain stage before unrelated errands',()=>{
  const matryona=read('rpg/characters/street_vendor_matryona.json');
  const chain=[read('rpg/quests/street-vendor-weather-1847.json'),read('rpg/quests/matryona-stall-life-1-1847.json'),read('rpg/quests/matryona-stall-life-2-1847.json'),read('rpg/quests/matryona-stall-life-3-1847.json')];
  const unrelated={id:'MATRYONA_UNRELATED_ERRAND',chapterId:'V33_1847_PRINT',date:'1847-06-01',titleKo:'다른 심부름',entry:{mapId:'nevsky',objectId:1042},actions:[{hostIds:['street_vendor_matryona']} ]};
  const all=[chain[0],unrelated,...chain.slice(1)];
  const state={world:{date:'1847-06-01',chapterId:'V33_1847_PRINT',currentMapId:'nevsky',lifeChains:{},livingEventStates:{}},
    player:{embodiment:'street_vendor_matryona',position:{...matryona.start}},
    hosts:{street_vendor_matryona:{...matryona,position:{...matryona.start},mapId:'nevsky',historicalAliveAndPresent:true,allowedMaps:matryona.allowedMaps}},
    quests:{STREET_VENDOR_WEATHER_1847:{status:'resolved'},MATRYONA_STREET_STALL_1847_STAGE_1:{status:'open'}},ledger:[]};
  let guide=resolveQuestGuidance({state,quests:all,maps,hostCards:[matryona]});
  assert.equal(guide.questId,'MATRYONA_STREET_STALL_1847_STAGE_1');
  state.quests.MATRYONA_STREET_STALL_1847_STAGE_1.status='resolved';
  state.quests.MATRYONA_STREET_STALL_1847_STAGE_2={status:'open'};
  state.world.lifeChains.MATRYONA_STREET_STALL_1847={stage:1,stageCount:3,history:[{questId:'MATRYONA_STREET_STALL_1847_STAGE_1'}],metrics:{care:1,record:0,trust:0}};
  guide=resolveQuestGuidance({state,quests:all,maps,hostCards:[matryona]});
  assert.equal(guide.questId,'MATRYONA_STREET_STALL_1847_STAGE_2');
  assert.equal(guide.target.objectId,1017);
});

test('a wrong host with lawful map access is directed to the nearest eligible host by a real exit',()=>{
  const state=stateAt('chancery');state.player.position={...state.hosts.clerk_alexei.position};const embodied=embody(state,'clerk_alexei');
  const guide=resolveQuestGuidance({state:embodied,quests,maps,hostCards});
  assert.equal(guide.taskType,'TRAVEL');assert.equal(guide.target.kind,'exit');assert.equal(guide.target.mapId,'chancery');
  assert.match(guide.howKo,/칸 이동한 뒤 E/);
  assert.ok(embodied.hosts.clerk_alexei.allowedMaps.includes(guide.target.finalMapId));
});

test('host without action rights gets a clear switch hint and cannot receive an objective pin for forbidden access',()=>{
  const state=embody(stateAt('nevsky'),'courier_pavel');
  const guide=resolveQuestGuidance({state,quests,maps,hostCards});
  assert.equal(guide.taskType,'SWITCH');assert.match(guide.reasonKo,/현재 몸으로 처리할 수 없습니다|맡을 수 있습니다/);
  if(guide.target?.mapId)assert.ok(state.hosts.courier_pavel.allowedMaps.includes(guide.target.mapId));
});

test('finishing every available quest explains the next playable path instead of leaving a blank objective',()=>{
  const state=embody(stateAt(hostCards.find(item=>item.id==='clerk_alexei').start.mapId),'clerk_alexei');
  const guide=resolveQuestGuidance({state,quests:[],maps,hostCards});
  assert.equal(guide.taskType,'COMPLETE');
  assert.match(guide.actionKo,/오늘 맡은 기록을 마쳤습니다/);
  assert.match(guide.howKo,/질문을 담고 표시된 인물에게 가세요/);
  assert.match(guide.howKo,/다른 인물의 관점/);
});
