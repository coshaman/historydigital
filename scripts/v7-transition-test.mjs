import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
await page.goto('http://127.0.0.1:4173/', {waitUntil:'domcontentloaded', timeout:15000});
await page.waitForFunction(() => window.__goldRuntime && window.__threeRuntime, null, {timeout:15000});
await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(() => window.__goldRuntime && window.__threeRuntime, null, {timeout:15000});
const cases = [
  ['E02', null, ['북방의 벌'], ['벨린스키','페트라셰프스키']],
  ['E05', 'E05-A', ['벨린스키가 고골에게'], ['로스토프치나','페트라셰프스키']],
  ['E05', 'E05-B', ['고골의 벨린스키행'], ['로스토프치나','페트라셰프스키']],
  ['E07', null, ['페트라셰프스키'], ['로스토프치나','벨린스키']],
  ['E02', null, ['북방의 벌'], ['벨린스키','페트라셰프스키']]
];
const results = [];
for (const [caseId, subSceneId, expected, forbidden] of cases) {
  await page.evaluate(({caseId,subSceneId}) => { const state=window.__goldRuntime.getState(); state.subSceneId=subSceneId; window.__goldRuntime.renderGold(caseId); window.__goldRuntime.openGoldDrawer(); }, {caseId,subSceneId});
  const text = await page.locator('#sourceDrawer').innerText();
  if (!expected.some(term => text.includes(term)) || forbidden.some(term => text.includes(term))) throw new Error(`${caseId}/${subSceneId}: ${text}`);
  results.push({caseId,subSceneId,expected,stale:forbidden.filter(term=>text.includes(term))});
  await page.locator('#closeDrawer').click();
}
await page.evaluate(() => { const state=window.__goldRuntime.getState(); state.subSceneId='E05-A'; window.__goldRuntime.renderGold('E05'); });
await page.locator('#saveBtn').click();
await page.reload({waitUntil:'domcontentloaded'}); await page.waitForFunction(() => window.__goldRuntime && window.__threeRuntime, null, {timeout:15000});
await page.evaluate(() => window.__goldRuntime.openGoldDrawer());
const reloadText = await page.locator('#sourceDrawer').innerText();
if (!reloadText.includes('벨린스키가 고골에게') || reloadText.includes('로스토프치나')) throw new Error('E05 save/reload contamination');
console.log(JSON.stringify({transitionMatrix:'5/5 PASS',saveReload:'PASS',results}, null, 2));
await browser.close();
