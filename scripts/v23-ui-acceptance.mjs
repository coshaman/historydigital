import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const base='http://127.0.0.1:4173/';
const out='docs/v23';
await mkdir(`${out}/screenshots`,{recursive:true});
const browser=await chromium.launch({headless:true});
const rectOverlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
const rectToJSON=r=>({x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,right:r.right,bottom:r.bottom,left:r.left});

async function inspect(page,viewport,phase,label){
  return page.evaluate(({phase,label})=>{
    const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
    const watched=[...document.querySelectorAll('#choiceArea button,.periodical-detail,.periodical-followup-detail,.source-drawer,.dialogue-strip')].filter(visible);
    const rects=watched.map(e=>({name:e.id||e.className||e.tagName,rect:{...e.getBoundingClientRect().toJSON()},z:getComputedStyle(e).zIndex,overflow:getComputedStyle(e).overflow}));
    const overlaps=[];for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const area=Math.max(0,Math.min(rects[i].rect.right,rects[j].rect.right)-Math.max(rects[i].rect.left,rects[j].rect.left))*Math.max(0,Math.min(rects[i].rect.bottom,rects[j].rect.bottom)-Math.max(rects[i].rect.top,rects[j].rect.top));if(area>8)overlaps.push({a:rects[i].name,b:rects[j].name,area});}
    const points=[];for(const e of watched){const r=e.getBoundingClientRect();for(const [x,y] of [[r.left+Math.min(r.width-1,8),r.top+Math.min(r.height-1,8)],[r.left+r.width/2,r.top+r.height/2]]){const top=document.elementFromPoint(x,y);points.push({target:e.id||e.className||e.tagName,x,y,hit:top?.id||top?.className||top?.tagName,blocked:!!top&&!e.contains(top)&&top!==e});}}
    const buttons=[...document.querySelectorAll('#choiceArea button')].filter(visible).map(e=>{const r=e.getBoundingClientRect();const cr=[...document.createRange().getClientRects()];return {id:e.dataset.choiceId,text:e.textContent.trim(),rect:{...r.toJSON()},min44:r.width>=44&&r.height>=44};});
    const textRanges=[...document.querySelectorAll('.periodical-detail .ru-text,.periodical-detail .ko-text,.periodical-followup-detail')].filter(visible).map(e=>{const range=document.createRange();range.selectNodeContents(e);return {name:e.className,rects:[...range.getClientRects()].map(r=>({...r.toJSON()})),text:e.textContent.trim()};});
    const details=[...document.querySelectorAll('.periodical-detail')].filter(visible).map(e=>({scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,scrollable:e.scrollHeight>e.clientHeight,scrollTop:e.scrollTop}));
    const bodyScrollHeight=document.body.scrollHeight,docScrollHeight=document.documentElement.scrollHeight;
    const samples=[];for(const [x,y] of [[1,1],[innerWidth/2,innerHeight/2],[innerWidth-2,innerHeight/2],[innerWidth/2,innerHeight-2]]){const e=document.elementFromPoint(x,y);samples.push({x,y,hit:e?.id||e?.className||e?.tagName});}
    return {phase,label,buttons,textRanges,details,rects,overlaps,points,samples,bodyScrollHeight,docScrollHeight,viewport:{width:innerWidth,height:innerHeight},scrollY};
  },{phase,label});
}
async function run(viewport,branch){
  const page=await browser.newPage({viewport});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});
  await page.addInitScript(()=>localStorage.removeItem('chancery-gold-runtime-v1'));await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__goldRuntime?.renderGold);await page.evaluate(()=>window.__goldRuntime.renderGold('PERIODICAL_REVIEW_GOLD_1847'));await page.waitForSelector('.periodical-object-head');await page.waitForTimeout(400);
  const states=[];const shot=async phase=>{states.push(await inspect(page,viewport,phase,branch));await page.screenshot({path:`${out}/screenshots/ui-${viewport.width}x${viewport.height}-${branch}-${phase}.png`});};
  const card=async i=>{await page.locator('.periodical-object-head').nth(i).click();await page.waitForTimeout(100)};
  await card(0);await shot('read');
  const detail=page.locator('.periodical-detail').first();await detail.evaluate(e=>{e.scrollTop=e.scrollHeight});const readCheck=await detail.evaluate(e=>({scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}));
  await card(0);await card(branch==='A'?1:2);await card(branch==='A'?1:2);await page.locator('.press-confirm').click();await page.waitForTimeout(140);await shot('treatment');
  const treatmentIds=await page.locator('#choiceArea button').evaluateAll(es=>es.map(e=>e.dataset.choiceId));
  await page.locator(`[data-choice-id="PERIODICAL-TREATMENT-lead-review"]`).click();await page.waitForTimeout(140);await shot('judgment');
  const judgmentIds=await page.locator('#choiceArea button').evaluateAll(es=>es.map(e=>e.dataset.choiceId));
  await page.locator('#choiceArea button').first().click();await page.waitForTimeout(140);await shot('followup');
  const final=await page.evaluate(()=>window.__goldRuntime.getState());await page.close();return {viewport,branch,errors,states,readCheck,final:{phase:final.phase,judgmentChoiceId:final.judgmentChoiceId,branch:final.periodical?.branch,followupId:final.periodical?.nextUnlockedDocumentIds,dialogueId:final.periodical?.nextDialogueId}};
}
const runs=[];for(const viewport of [{width:1366,height:768},{width:1440,height:900},{width:390,height:844}]){runs.push(await run(viewport,'A'));runs.push(await run(viewport,'B'));}
const pass=runs.every(run=>!run.errors.length&&run.states.every(s=>s.overlaps.length===0&&s.bodyScrollHeight<=s.viewport.height&&s.docScrollHeight<=s.viewport.height&&(!s.buttons.length||s.buttons.every(b=>b.min44)))&&run.states.find(s=>s.phase==='read').textRanges.length>=2&&(run.viewport.width>500||(run.readCheck.scrollHeight>run.readCheck.clientHeight&&run.readCheck.scrollTop>0)));
const result={version:'v23',capturedAt:'2026-10-01',pass,runs};await writeFile(`${out}/UI_ACCEPTANCE.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({pass,runs:runs.length,screenshots:'docs/v23/screenshots'},null,2));await browser.close();if(!pass)process.exitCode=1;
