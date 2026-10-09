import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:4173/'; const out='docs/v22'; await mkdir(`${out}/screenshots`,{recursive:true});
const browser=await chromium.launch({headless:true});
async function branch(name,ids){
  const page=await browser.newPage({viewport:{width:1366,height:768}}); await page.setDefaultTimeout(12000);
  await page.addInitScript(()=>localStorage.removeItem('chancery-gold-runtime-v1')); await page.goto(base,{waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>window.__goldRuntime?.renderGold); await page.evaluate(()=>window.__goldRuntime.renderGold('PERIODICAL_REVIEW_GOLD_1847'));
  for(const i of ids){await page.locator('.periodical-object-head').nth(i).click(); if(await page.locator('.periodical-object-head').nth(i).textContent()) await page.locator('.periodical-object-head').nth(i).click();}
  await page.locator('.press-confirm').click(); await page.locator('[data-choice-id="PERIODICAL-TREATMENT-lead-review"]').click(); await page.locator('[data-choice-id="PERIODICAL-PERIODICAL-J1"], [data-choice-id="PERIODICAL-J1"]').first().click().catch(async()=>await page.locator('#choiceArea button').first().click()); await page.locator('#choiceArea button').first().click();
  await page.screenshot({path:`${out}/screenshots/after-${name}-judgment.png`});
  const stateAfterUnlock=await page.evaluate(()=>window.__goldRuntime.getState().periodical);
  await page.locator('#choiceArea button').first().click(); await page.screenshot({path:`${out}/screenshots/after-${name}-followup.png`});
  const docText=await page.locator('.periodical-followup-object').innerText(); await page.locator('#choiceArea button').first().click(); await page.screenshot({path:`${out}/screenshots/after-${name}-dialogue.png`});
  const dialogue=await page.locator('#dialogue').textContent(); const state=await page.evaluate(()=>window.__goldRuntime.getState().periodical); await page.close(); return {branch:name,unlocked:stateAfterUnlock.nextUnlockedDocumentIds,nextDialogueId:stateAfterUnlock.nextDialogueId,docText,dialogue,followupReadIds:state.followupReadIds||[],actions:stateAfterUnlock.nextUnlockedDocumentIds};
}
const result={capturedAt:'2026-10-01',branches:[]}; result.branches.push(await branch('A',[0,1])); result.branches.push(await branch('B',[1,2])); await writeFile(`${out}/PERIODICAL_ACTUAL_BRANCHES.json`,JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2)); await browser.close();
