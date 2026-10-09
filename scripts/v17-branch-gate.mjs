import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='docs/v17'; await mkdir(`${out}/screenshots`,{recursive:true});
const browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:1366,height:768}});
await page.addInitScript(()=>localStorage.removeItem('chancery-gold-runtime-v1'));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>window.__goldRuntime?.getTruePressManifest,{timeout:10000});
await page.evaluate(()=>window.__goldRuntime.renderGold('TRUE-PRESS-DESK-V2')); await page.waitForTimeout(200);
const shot=async name=>page.screenshot({path:`${out}/screenshots/${name}`});
const state=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__goldRuntime.getState())));
await shot('V17-TRUE-PRESS-incoming.png');
const before=await state();
for(const index of [0,1]) { await page.locator('.true-press-object-head').nth(index).click(); await page.waitForTimeout(80); }
const afterRead=await state(); if(afterRead.truePress.readItemIds.length!==2)throw new Error('two source objects were not read');
await shot('V17-TRUE-PRESS-read-two.png');
for(const index of [0,1]) { await page.locator('.true-press-object-head').nth(index).click(); await page.waitForTimeout(80); }
await page.locator('[data-choice-id="TRUE-PRESS-ATTENTION"]').click(); await page.waitForTimeout(100); await shot('V17-TRUE-PRESS-attention-A.png');
await page.locator('[data-choice-id="TRUE-PRESS-T-lead"]').click(); await page.locator('[data-choice-id="TRUE-PRESS-V2-J1"]').click(); await page.waitForTimeout(80);
const finalA=await state(); const digestA={branch:finalA.truePress.branch,selected:finalA.truePress.attentionItemIds,deferred:finalA.truePress.deferredItemIds,nextUnlockedDocumentIds:finalA.truePress.nextUnlockedDocumentIds,nextDialogueId:finalA.truePress.nextDialogueId,events:finalA.actions.filter(item=>item.caseId==='TRUE-PRESS-DESK-V2').map(item=>item.type)};
await page.evaluate(()=>{localStorage.removeItem('chancery-gold-runtime-v1'); location.reload()}); await page.waitForFunction(()=>window.__goldRuntime?.getTruePressManifest,{timeout:10000}); await page.evaluate(()=>window.__goldRuntime.renderGold('TRUE-PRESS-DESK-V2')); await page.waitForTimeout(180);
for(const index of [1,2]) { await page.locator('.true-press-object-head').nth(index).click(); await page.waitForTimeout(60); }
for(const index of [1,2]) { await page.locator('.true-press-object-head').nth(index).click(); await page.waitForTimeout(60); }
await page.locator('[data-choice-id="TRUE-PRESS-ATTENTION"]').click(); await page.locator('[data-choice-id="TRUE-PRESS-T-route"]').click(); await page.locator('[data-choice-id="TRUE-PRESS-V2-J2"]').click(); await page.waitForTimeout(80); await shot('V17-TRUE-PRESS-attention-B.png');
const finalB=await state(); const digestB={branch:finalB.truePress.branch,selected:finalB.truePress.attentionItemIds,deferred:finalB.truePress.deferredItemIds,nextUnlockedDocumentIds:finalB.truePress.nextUnlockedDocumentIds,nextDialogueId:finalB.truePress.nextDialogueId,events:finalB.actions.filter(item=>item.caseId==='TRUE-PRESS-DESK-V2').map(item=>item.type)};
if(digestA.branch===digestB.branch||digestA.nextDialogueId===digestB.nextDialogueId)throw new Error('press branches did not diverge');
const chronology=await page.evaluate(()=>({globalYear:document.querySelector('#globalYear').textContent,placeYear:document.querySelector('#globalPlaceYear').textContent,paperDate:document.querySelector('#paperDate').textContent}));
const result={status:'PASS',scene:'TRUE-PRESS-DESK-V2',initialPhase:before.phase,readCount:afterRead.truePress.readItemIds.length,chronology,branchA:digestA,branchB:digestB,eventCountA:digestA.events.length,eventCountB:digestB.events.length};
result.sha256=createHash('sha256').update(JSON.stringify(result)).digest('hex'); await writeFile(`${out}/V17_TRUE_PRESS_DESK_GATE.json`,JSON.stringify(result,null,2)); await writeFile(`${out}/V17_PRESS_DESK_BRANCH_A.json`,JSON.stringify({sceneId:'TRUE-PRESS-DESK-V2',...digestA},null,2)); await writeFile(`${out}/V17_PRESS_DESK_BRANCH_B.json`,JSON.stringify({sceneId:'TRUE-PRESS-DESK-V2',...digestB},null,2)); console.log(JSON.stringify(result,null,2)); await browser.close();
