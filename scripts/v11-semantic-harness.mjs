import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('../docs/v11/', import.meta.url); const shotDir = new URL('./screenshots/', root); await mkdir(shotDir, {recursive:true});
const browser = await chromium.launch({headless:true}); const page = await browser.newPage({viewport:{width:1366,height:768}, deviceScaleFactor:1});
await page.goto('http://127.0.0.1:4173/', {waitUntil:'domcontentloaded', timeout:15000}); await page.waitForTimeout(2200);
const records = [];
async function fresh(caseId, subSceneId, phase='choices') { await page.evaluate(({caseId,subSceneId,phase}) => { const s=window.__goldRuntime.getState(); Object.assign(s,{caseId,subSceneId,phase,actions:[],effects:{},relationships:{},institutional:{},stance:{},proceduralChoiceId:null,judgmentChoiceId:null,proceduralIndex:null,judgmentIndex:null}); window.__goldRuntime.renderGold(caseId); }, {caseId,subSceneId,phase}); }
async function capture(name, expected) {
  const path = new URL(`./screenshots/${name}`, root); await page.screenshot({path:fileURLToPath(path)});
  const state = await page.evaluate(() => { const s=window.__goldRuntime.getState(); return {caseId:s.caseId,subSceneId:s.subSceneId,phase:s.phase,selectedProceduralChoiceId:s.proceduralChoiceId||null,selectedJudgmentChoiceId:s.judgmentChoiceId||null,followUpId:s.judgmentChoiceId ? `${s.judgmentChoiceId}-followup` : null,memo:s.memo||'',effectKeys:Object.keys({...s.effects,...s.institutional,...s.stance,...s.relationships}),excerptId:s.activeExcerptId,dialogue:document.querySelector('#dialogue')?.textContent||''}; });
  state.memoHash = state.memo ? createHash('sha256').update(state.memo).digest('hex') : null; delete state.memo;
  state.documentId = ({E02:'E02-DOC-284',E05:'E05-DOC-LETTERS',E07:'E07-DOC-214'})[state.caseId];
  if (state.phase !== expected.phase || state.selectedProceduralChoiceId !== expected.proceduralChoiceId || state.selectedJudgmentChoiceId !== expected.judgmentChoiceId || !state.dialogue) throw new Error(`${name}: semantic assertion failed`);
  const buffer = await (await import('node:fs/promises')).readFile(path); records.push({name, ...state, expected, sha256:createHash('sha256').update(buffer).digest('hex'),bytes:buffer.length,width:1366,height:768});
}
for (const item of [{caseId:'E02',sub:null,p:0,j:0},{caseId:'E05',sub:'E05-A',p:1,j:1},{caseId:'E05',sub:'E05-B',p:2,j:2},{caseId:'E07',sub:null,p:0,j:2}]) {
  await fresh(item.caseId,item.sub); await page.locator('#choiceArea button').nth(item.p).click(); const proc = await page.evaluate(()=>window.__goldRuntime.getState().proceduralChoiceId); await page.locator('#choiceArea button').nth(item.j).click();
  await capture(`${item.caseId}${item.sub?'-'+item.sub:''}-procedural-${proc}-judgment-${item.caseId}-J${item.j+1}.png`, {phase:'followup',proceduralChoiceId:proc,judgmentChoiceId:`${item.caseId}-J${item.j+1}`});
}
await page.evaluate(() => { const s=window.__goldRuntime.getState(); s.memo='발행일과 반응일을 따로 기록한다.'; s.memoHintSeen=true; s.subSceneId='E05-B'; s.phase='reading'; s.proceduralChoiceId=null; s.judgmentChoiceId=null; window.__goldRuntime.renderGold('E05'); });
const callbackVisible = await page.locator('#memoCallback').isVisible(); if (!callbackVisible) throw new Error('memo callback not visible');
await page.screenshot({path:fileURLToPath(new URL('./screenshots/E05-memo-callback.png',root))});
const callbackState = await page.evaluate(()=>{const s=window.__goldRuntime.getState(); return {memoCallback:document.querySelector('#memoCallbackText')?.textContent||'',caseId:s.caseId,subSceneId:s.subSceneId,phase:s.phase,selectedProceduralChoiceId:s.proceduralChoiceId||null,selectedJudgmentChoiceId:s.judgmentChoiceId||null,followUpId:null,memo:s.memo,effectKeys:Object.keys({...s.effects,...s.institutional,...s.stance,...s.relationships}),documentId:'E05-DOC-LETTERS',excerptId:s.activeExcerptId};});
records.push({name:'E05-memo-callback.png',...callbackState,memoHash:createHash('sha256').update(callbackState.memo).digest('hex')}); delete records.at(-1).memo;
const manifest={version:'v11',generatedAt:new Date().toISOString(),screenshotCount:records.length,records}; await writeFile(new URL('./semantic-manifest.json',root),JSON.stringify(manifest,null,2)); await browser.close(); console.log(JSON.stringify({screenshotCount:records.length,files:records.map(r=>r.name)},null,2));
