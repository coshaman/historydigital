import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root=process.cwd(), output=path.join(root,'docs/v36/current-audit/screenshots/world-map-tour');
await mkdir(output,{recursive:true});
const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const require=createRequire(import.meta.url);require('../rpg/engine/game-state.js');const game=globalThis.V33GameState;
const [registry,mapFiles,characterFiles,questFiles]=await Promise.all([
  read('rpg/data/city-districts-v36.json'),readdir(path.join(root,'rpg/maps')),readdir(path.join(root,'rpg/characters')),readdir(path.join(root,'rpg/quests')),
]);
const maps=Object.fromEntries(await Promise.all(mapFiles.filter(file=>file.endsWith('.json')).map(async file=>{const map=await read(`rpg/maps/${file}`);return[map.mapId,map]})));
const cards=await Promise.all(characterFiles.filter(file=>file.endsWith('.json')).map(file=>read(`rpg/characters/${file}`)));
const quests=(await Promise.all(questFiles.filter(file=>file.endsWith('.json')).map(file=>read(`rpg/quests/${file}`)))).filter(quest=>quest.historicalOutcome?.id&&Array.isArray(quest.actions));
const districts=new Map(registry.districts.map(district=>[district.id,district]));
const mapDistrict=new Map(registry.districts.flatMap(district=>district.mapIds.map(id=>[id,district])));
const mapIds=[...new Set([...registry.districts.map(district=>district.entryMapId),...registry.districts.flatMap(district=>district.interiorMapIds??[])])];
const portProbe=createServer();await new Promise((resolve,reject)=>{portProbe.once('error',reject);portProbe.listen(0,'127.0.0.1',resolve)});
const port=portProbe.address().port;await new Promise((resolve,reject)=>portProbe.close(error=>error?reject(error):resolve()));
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,OPENAI_API_KEY:'',CHANCERY_PORT:String(port)},stdio:'ignore',windowsHide:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const rows=[];
try{
  const base=`http://127.0.0.1:${port}/`;let ready=false;
  for(let attempt=0;attempt<60;attempt++){try{if((await fetch(base)).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,150))}
  assert.ok(ready,'local Vercel-compatible runtime must start');
  for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]){
    for(const mapId of mapIds){
      const map=maps[mapId],district=mapDistrict.get(mapId),hostId=map.metadata.access?.allowedCharacterIds?.[0]??district?.residentIds.find(id=>cards.find(card=>card.id===id)?.allowedMaps.includes(mapId))??null;
      let state=game.createInitialState({maps,hostCards:cards,quests,startMapId:mapId});
      state.world.currentMapId=mapId;state.world.clockMinutes=600;state.world.date='1847-06-01';state.player.position={...map.metadata.observerStart};
      state.learning={...state.learning,phase:'complete',circleLearning:'attended',examOutcome:'passed',examCorrectCount:4,promotionStatus:'promoted',examAnswers:{},timelineIndex:0};
      if(hostId){state.player.embodiment=hostId;state.hosts[hostId].mapId=mapId;state.hosts[hostId].position={...map.metadata.observerStart};}
      const save=game.saveGame(state),context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(String(error)));
      await page.goto(base,{waitUntil:'networkidle'});
      await page.evaluate(value=>{localStorage.clear();localStorage.setItem('v33-rpg-save',value);localStorage.setItem('v34-tutorial-stage','done')},save);
      await page.reload({waitUntil:'networkidle'});await page.locator('#mission-tracker').waitFor({state:'visible'});await page.waitForTimeout(130);
      const view=await page.evaluate(()=>{
        const canvas=document.querySelector('#world'),image=canvas?.getContext('2d')?.getImageData(0,0,Math.min(canvas.width,32),Math.min(canvas.height,32)).data??[];
        return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,
          mapId:JSON.parse(localStorage.getItem('v33-rpg-save')).state.world.currentMapId,mapName:document.querySelector('#mapname')?.textContent,
          district:document.querySelector('#place')?.textContent,canvas:{width:canvas?.width,height:canvas?.height,nonTransparentPixels:[...image].filter((value,index)=>index%4===3&&value>0).length},
          opinionBoardVisible:!document.querySelector('#discussion-quest-board')?.hidden};
      });
      assert.equal(view.mapId,mapId,`${mapId} should load into the world view`);
      assert.ok(view.mapName?.length,`${mapId} should render its location label`);
      assert.equal(view.canvas.nonTransparentPixels>0,true,`${mapId} canvas should render visible world pixels`);
      assert.ok(view.documentWidth<=viewport.width,`${mapId} ${viewport.name} width overflow ${view.documentWidth}/${viewport.width}`);
      assert.equal(errors.length,0,`${mapId} ${viewport.name} runtime errors: ${errors.join('; ')}`);
      const screenshot=`${viewport.name}-${mapId}.png`;await page.screenshot({path:path.join(output,screenshot),fullPage:true});
      rows.push({...view,viewport:viewport.name,hostId,screenshot,pageErrors:errors});await context.close();
    }
  }
  const report={schemaVersion:'V36_WORLD_MAP_BROWSER_CAPTURE_1',status:'PASS',generatedAt:new Date().toISOString(),districts:registry.districts.length,cityMapCount:mapIds.length,viewports:['desktop','mobile'],captures:rows};
  await writeFile(path.join(output,'WORLD_MAP_CAPTURE_MANIFEST.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify({status:report.status,districts:report.districts,cityMapCount:report.cityMapCount,captures:rows.length,horizontalOverflow:rows.filter(row=>row.documentWidth>row.viewport.width).length,pageErrors:rows.flatMap(row=>row.pageErrors)},null,2));
}finally{await browser.close();server.kill();}
