import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root=process.cwd(),readJson=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const require=createRequire(import.meta.url);require('../rpg/engine/game-state.js');const game=globalThis.V33GameState;
const maps=Object.fromEntries(await Promise.all((await readdir(path.join(root,'rpg/maps'))).filter(file=>file.endsWith('.json')).map(async file=>{const map=await readJson(`rpg/maps/${file}`);return[map.mapId,map]})));
const hostCards=await Promise.all((await readdir(path.join(root,'rpg/characters'))).filter(file=>file.endsWith('.json')).map(file=>readJson(`rpg/characters/${file}`)));
const questFiles=(await readdir(path.join(root,'rpg/quests'))).filter(file=>file.endsWith('.json'));
const quests=(await Promise.all(questFiles.map(file=>readJson(`rpg/quests/${file}`)))).filter(quest=>quest.historicalOutcome?.id);
const samples=[
  ['clerk_alexei','ALEXEI_ENVELOPE_REGISTER_1847_STAGE_1'],
  ['senior_clerk_konstantin','SENIOR_CLERK_REVIEW_AND_SIGNATURE_1847'],
  ['scribal_yuri','SCRIBAL_COPY_1847'],
  ['housemaid_olga','HOUSEHOLD_PRIVACY_1847'],
  ['servant_varvara','SERVANT_PRIVATE_WARNING_1847'],
  ['coachman_timofey','COACH_FARE_1847'],
];
const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve)});const port=probe.address().port;await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,OPENAI_API_KEY:'',CHANCERY_PORT:String(port)},stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const output=path.join(root,'docs/v36/current-audit/screenshots');await mkdir(output,{recursive:true});
try{
  const base=`http://127.0.0.1:${port}/`;let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,150))}assert.ok(ready,'local server must start');
  const rows=[];
  for(const [index,[hostId,questId]] of samples.entries()){
    const quest=quests.find(item=>item.id===questId);assert.ok(quest,`${questId} is in the loaded content`);assert.equal(quest.entry.requiredHostId,hostId);
    assert.ok(!quest.prerequisiteQuestIds?.length,'sample quest should be available without hidden previous steps');
    const map=maps[quest.entry.mapId],object=map.layers.find(layer=>layer.name==='Interactions').objects.find(item=>item.id===quest.entry.objectId);assert.ok(object);
    let state=game.createInitialState({maps,hostCards,quests,startMapId:quest.entry.mapId});state.world.currentMapId=quest.entry.mapId;state.player.embodiment=hostId;
    state.hosts[hostId].mapId=quest.entry.mapId;state.player.position={x:Math.floor(object.x/16)-1,y:Math.floor(object.y/16)};state.hosts[hostId].position={...state.player.position};
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(value=>{localStorage.clear();localStorage.setItem('v33-rpg-save',value);localStorage.setItem('v34-tutorial-stage','done')},game.saveGame(state));await page.reload({waitUntil:'networkidle'});
    assert.match(await page.locator('#mission-title').textContent(),new RegExp(quest.titleKo.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`${hostId} should see their own current quest`);
    await page.locator('#use').click();const action=quest.actions[0],choice=page.locator('#actions button').filter({hasText:action.labelKo}).first();await choice.waitFor({state:'visible',timeout:5000});await choice.scrollIntoViewIfNeeded();
    const screenshot=`resident-batch-${index+1}-quest-choices.png`;await page.screenshot({path:path.join(output,screenshot),fullPage:true});
    await choice.click();await page.locator('#save').click();const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('v33-rpg-save')).state);
    assert.equal(after.quests[quest.id].status,'resolved',`${questId} choice should record in the browser`);assert.equal(errors.length,0,errors.join('\n'));
    rows.push({batch:index+1,hostId,questId,firstChoice:action.id,choiceCount:quest.actions.length,resolved:true,pageErrors:errors,screenshot});await context.close();
  }
  const report={schemaVersion:'V36_SIX_BATCH_BROWSER_ACCEPTANCE_1',status:'PASS',viewport:{width:1440,height:900},batches:rows};
  await writeFile(path.join(root,'docs/v36/current-audit/SIX_BATCH_BROWSER_ACCEPTANCE.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify({status:'PASS',batches:rows.length,questsResolved:rows.filter(row=>row.resolved).length,shots:rows.map(row=>row.screenshot)},null,2));
}finally{await browser.close();server.kill()}
