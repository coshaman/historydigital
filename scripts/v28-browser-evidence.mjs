import fs from 'node:fs';
import { chromium } from 'playwright';
const base='http://127.0.0.1:4173/#v28';
const out='artifacts/v28-browser'; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
const report={schemaVersion:'V28-BROWSER-EVIDENCE-1',generatedAt:new Date().toISOString(),screenshots:[],states:[],pageErrors:errors};
async function capture(page,name){await page.screenshot({path:`${out}/${name}.png`,fullPage:false,timeout:0});report.screenshots.push(`${name}.png`)}
async function finishIntro(page){await page.evaluate(()=>{for(let guard=0;guard<40;guard+=1){const buttons=[...document.querySelectorAll('.v28-runtime #choiceArea button')];if(buttons.length!==1||!/다음 대사|대화 뒤 문서를 확인한다/.test(buttons[0].textContent||''))break;buttons[0].click();}})}
async function scene(prefix,viewport){
  const page=await browser.newPage({viewport}); page.on('pageerror',e=>errors.push(String(e)));
  await page.setViewportSize(viewport); await page.goto(base,{waitUntil:'domcontentloaded'}); await page.evaluate(()=>localStorage.removeItem('chancery-gold-runtime-v1')); await page.goto(base,{waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>Boolean(window.__goldRuntime?.getV28Graph),null,{timeout:30000});
  await capture(page,`${prefix}-arrival`); const overflow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth})); await finishIntro(page);
  await page.locator('.v28-runtime #choiceArea button').first().evaluate((element) => element.click()); await capture(page,`${prefix}-choice-reaction`);
  await page.locator('.v28-runtime .v28-action').evaluate((element) => element.click()); await capture(page,`${prefix}-evidence-ru-ko`);
  await page.locator('.v28-runtime .v28-action').evaluate((element) => element.click()); await capture(page,`${prefix}-aftermath`);
  report.states.push({prefix,viewport,overflowFree:overflow.scrollWidth<=overflow.width&&overflow.bodyScrollWidth<=overflow.width}); await page.close();
}
try { await scene('desktop-1440x900',{width:1440,height:900}); await scene('desktop-1366x768',{width:1366,height:768}); await scene('mobile-390x844',{width:390,height:844}); await scene('mobile-360x800',{width:360,height:800}); report.status=errors.length?'FAIL':'PASS'; }
catch(error){report.status='FAIL';report.failures=[String(error)]}
fs.writeFileSync(`${out}/V28_BROWSER_EVIDENCE.json`,JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2)); await browser.close(); if(report.status!=='PASS')process.exitCode=1;
