import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const readJson = async file => JSON.parse(await readFile(path.join(root,file),'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const maps = Object.fromEntries(await Promise.all((await readdir(path.join(root,'rpg/maps'))).filter(file=>file.endsWith('.json'))
  .map(async file=>{const map=await readJson(`rpg/maps/${file}`);return[map.mapId,map]})));
const hostCards = await Promise.all((await readdir(path.join(root,'rpg/characters'))).filter(file=>file.endsWith('.json')).map(file=>readJson(`rpg/characters/${file}`)));
const questFiles=(await readdir(path.join(root,'rpg/quests'))).filter(file=>file.endsWith('.json'));
const quests = (await Promise.all(questFiles.map(file=>readJson(`rpg/quests/${file}`))))
  .filter(quest=>Array.isArray(quest.actions)&&quest.historicalOutcome?.id);
const chainId='ALEXEI_ENVELOPE_REGISTER_1847';
const stages=quests.filter(quest=>quest.lifeChain?.id===chainId).sort((a,b)=>a.lifeChain.stage-b.lifeChain.stage);
assert.equal(stages.length,3);
const firstObject=maps.chancery.layers.find(layer=>layer.name==='Interactions').objects.find(object=>object.id===stages[0].entry.objectId);
let state=game.createInitialState({maps,hostCards,quests,startMapId:'chancery'});
state.world.currentMapId='chancery';state.player.embodiment='clerk_alexei';state.hosts.clerk_alexei.mapId='chancery';
state.hosts.clerk_alexei.position={x:Math.floor(firstObject.x/16)-1,y:Math.floor(firstObject.y/16)};state.player.position={...state.hosts.clerk_alexei.position};
const save=game.saveGame(state),probe=createServer();
await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve)});
const port=probe.address().port;await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,OPENAI_API_KEY:'',CHANCERY_PORT:String(port)},stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const output=path.join(root,'docs/v36/current-audit/screenshots');await mkdir(output,{recursive:true});
try{
  const base=`http://127.0.0.1:${port}/`;let ready=false;
  for(let attempt=0;attempt<60;attempt++){try{if((await fetch(base)).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,150))}
  assert.ok(ready,'local game server starts');
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(value=>{localStorage.clear();localStorage.setItem('v33-rpg-save',value);localStorage.setItem('v34-tutorial-stage','done')},save);
  await page.reload({waitUntil:'networkidle'});
  const resolved=[];let firstStageChoiceLayout=null;
  for(let index=0;index<stages.length;index++){
    const quest=stages[index],map=maps[quest.entry.mapId],object=map.layers.find(layer=>layer.name==='Interactions').objects.find(item=>item.id===quest.entry.objectId);
    assert.equal(quest.entry.mapId,'chancery');
    const target={x:Math.floor(object.x/16),y:Math.floor(object.y/16)};
    let steps=0;
    while(true){
      await page.locator('#save').click();
      const current=await page.evaluate(()=>JSON.parse(localStorage.getItem('v33-rpg-save')).state);
      const position=current.player.position;
      if(Math.abs(position.x-target.x)+Math.abs(position.y-target.y)<=1)break;
      const collision=map.layers.find(layer=>layer.name==='Collision').data,occupied=new Set(Object.values(current.hosts).filter(host=>host.id!=='clerk_alexei'&&host.mapId==='chancery').map(host=>`${host.position.x},${host.position.y}`));
      const queue=[position],previous=new Map([[`${position.x},${position.y}`,null]]),moves=[[-1,0,'ArrowLeft'],[1,0,'ArrowRight'],[0,-1,'ArrowUp'],[0,1,'ArrowDown']];let found=null;
      while(queue.length&&!found){const at=queue.shift();if(Math.abs(at.x-target.x)+Math.abs(at.y-target.y)<=1){found=at;break}for(const [dx,dy]of moves){const next={x:at.x+dx,y:at.y+dy},key=`${next.x},${next.y}`;if(next.x<0||next.y<0||next.x>=map.width||next.y>=map.height||collision[next.y*map.width+next.x]!==0||occupied.has(key)||previous.has(key))continue;previous.set(key,{from:at,keyDirection:dx+','+dy});queue.push(next)}}
      assert.ok(found,`stage ${index+1} quest object must be physically reachable from ${position.x},${position.y}`);
      const route=[];let cursor=found;while(previous.get(`${cursor.x},${cursor.y}`)){const step=previous.get(`${cursor.x},${cursor.y}`);route.push(step.keyDirection);cursor=step.from}route.reverse();
      const [dx,dy]=route[0].split(',').map(Number),key=moves.find(move=>move[0]===dx&&move[1]===dy)[2];
      await page.keyboard.press(key);await page.waitForTimeout(390);await page.locator('#save').click();
      const moved=await page.evaluate(()=>JSON.parse(localStorage.getItem('v33-rpg-save')).state.player.position);
      if(moved.x===position.x&&moved.y===position.y){steps+=1;assert.ok(steps<4,`player movement toward ${quest.id} remains blocked`)}else steps=0;
      assert.ok(++steps<80,`${quest.id} route should remain bounded`);
    }
    await page.locator('#use').click();
    const label=quest.actions[0].labelKo,choice=page.locator('#actions button').filter({hasText:label}).first();
    try { await choice.waitFor({state:'visible',timeout:5000}); }
    catch { throw new Error(`quest choice not rendered: ${JSON.stringify({questId:quest.id,headline:await page.locator('#headline').textContent(),record:await page.locator('#record').textContent(),mission:await page.locator('#mission-title').textContent(),actions:await page.locator('#actions button').allTextContents(),errors})}`); }
    if(index===0){
      firstStageChoiceLayout=await page.evaluate(()=>{const box=element=>{const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return{top:Math.round(rect.top),bottom:Math.round(rect.bottom),height:Math.round(rect.height),overflowY:style.overflowY,scrollHeight:element.scrollHeight,clientHeight:element.clientHeight}};return{choice:box(document.querySelector('#actions button')),journal:box(document.querySelector('.journal')),lower:box(document.querySelector('.lower')),choices:[...document.querySelectorAll('#actions button')].slice(0,3).map(button=>button.textContent)}});
      await choice.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'alexei-envelope-stage-1-choices.png'),fullPage:true});
    }
    await choice.click();await page.locator('#save').click();
    const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('v33-rpg-save')).state);
    assert.equal(persisted.quests[quest.id].status,'resolved',`${quest.id} should resolve in the browser`);
    assert.equal(persisted.world.lifeChains[chainId].stage,index+1,`${quest.id} should advance its chain`);
    resolved.push({questId:quest.id,stage:index+1,actionId:quest.actions[0].id,nextMission:await page.locator('#mission-title').textContent()});
  }
  await page.screenshot({path:path.join(output,'alexei-envelope-chain-complete.png'),fullPage:true});
  assert.equal(errors.length,0,errors.join('\n'));
  const report={schemaVersion:'V36_FIRST_BATCH_QUEST_BROWSER_1',status:'PASS',viewport:{width:1440,height:900},resident:'clerk_alexei',
    chainId,stages:resolved,firstStageChoiceLayout,walkedBetweenPhysicalObjects:true,allStagesRecorded:true,pageErrors:errors,
    screenshots:['alexei-envelope-stage-1-choices.png','alexei-envelope-chain-complete.png']};
  await writeFile(path.join(root,'docs/v36/current-audit/FIRST_BATCH_QUEST_BROWSER.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify({status:'PASS',resident:report.resident,stages:resolved.length,walkedBetweenPhysicalObjects:true,pageErrors:0,screenshots:report.screenshots},null,2));
  await context.close();
}finally{await browser.close();server.kill()}
