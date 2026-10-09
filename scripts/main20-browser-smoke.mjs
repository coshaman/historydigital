import fs from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/?main20=1#main20-reset';
const out = 'artifacts/main20-browser';
fs.mkdirSync(out, {recursive:true});
const browser = await chromium.launch({headless:true});
const results = [];

async function newPage(viewport) {
  const context = await browser.newContext({viewport});
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const errors=[]; page.on('pageerror', (error)=>errors.push(String(error)));
  await page.goto(base,{waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>Boolean(window.__windowController)); await page.waitForFunction(()=>Boolean(window.__main20));
  return {context,page,errors};
}
async function intro(page){ for(let i=0;i<5;i+=1){ const button=page.locator('#choiceArea button').first(); await button.click(); if(await page.locator('#choiceArea button').count()===3) break; } }
async function scene(page, choiceIndex){
  await intro(page);
  await page.locator('#choiceArea button').nth(choiceIndex).click();
  await page.getByText('이제 문서를 펼쳐 읽는다',{exact:true}).click();
  await page.waitForSelector('.main20-excerpt');
  const excerptCount=await page.locator('.main20-excerpt').count();
  await page.locator('#paperColumns').evaluate((node)=>{node.scrollTop=Math.floor(node.scrollHeight/2)});
  const scrollBefore=await page.locator('#paperColumns').evaluate((node)=>node.scrollTop);
  await page.locator('#petersburgWindow').click(); await page.waitForFunction(()=>document.body.classList.contains('window-view'));
  const windowState=await page.evaluate(()=>({body:document.body.classList.contains('window-view'),paperHidden:document.querySelector('#paper')?.inert===true,choiceHidden:document.querySelector('#choiceArea')?.inert===true,windowBox:document.querySelector('#petersburgWindow')?.getBoundingClientRect().toJSON()}));
  await page.screenshot({path:`${out}/window-open-${await page.evaluate(()=>window.__main20?.getState?.()?.sceneIndex ?? 0)}.png`,fullPage:false});
  await page.locator('#petersburgWindow').click(); await page.waitForFunction(()=>!document.body.classList.contains('window-view'));
  const scrollAfter=await page.locator('#paperColumns').evaluate((node)=>node.scrollTop);
  await page.screenshot({path:`${out}/reading-${await page.evaluate(()=>document.querySelector('#paperTitle')?.textContent||'scene').then((x)=>String(x).replaceAll(/[^a-zA-Z0-9_-]/g,'_'))}.png`,fullPage:false});
  for (let i=0; i<excerptCount; i+=1) await page.locator('.main20-excerpt:not(.is-read)').first().click({force:true});
  await page.getByText(/읽은 내용을 바탕으로 판단한다/).click();
  await page.locator('#choiceArea button').nth(choiceIndex).click();
  const reaction=await page.locator('#dialogue').textContent();
  const imageIssues = await page.evaluate(() => Array.from(document.images).filter((image) => getComputedStyle(image).display !== 'none' && (!image.complete || image.naturalWidth === 0)).map((image) => image.getAttribute('src') || image.alt));
  return {excerptCount,scrollBefore,scrollAfter,windowState,reaction,imageIssues};
}
async function runEnding(pattern,name){
  const {context,page,errors}=await newPage({width:1366,height:768});
  const scenes=[]; for(let i=0;i<5;i+=1){ scenes.push(await scene(page,pattern[i%pattern.length])); if(i<4) await page.getByText('다음 사건으로 간다',{exact:true}).click(); }
  await page.getByText('결말을 확인한다',{exact:true}).click(); await page.waitForFunction(()=>document.querySelector('#endingTitle')?.textContent);
  const ending=await page.locator('#endingTitle').textContent(); await page.screenshot({path:`${out}/ending-${name}.png`,fullPage:false});
  return {name,ending,scenes,errors};
}

try {
  const desktop=await newPage({width:1440,height:900});
  await desktop.page.screenshot({path:`${out}/desktop-start.png`,fullPage:false});
  const first=await scene(desktop.page,0); await desktop.page.getByText(/다음 사건으로 간다|결말을 확인한다/).click();
  await desktop.page.reload(); await desktop.page.waitForFunction(()=>Boolean(window.__windowController));
  const restored=await desktop.page.evaluate(()=>JSON.parse(localStorage.getItem('chancery-main20-v1')));
  await desktop.context.close(); results.push({viewport:'1440x900',first,restored,errors:desktop.errors});
  const mobile=await newPage({width:390,height:844}); await mobile.page.screenshot({path:`${out}/mobile-start.png`,fullPage:false}); const mobileScene=await scene(mobile.page,1); await mobile.context.close(); results.push({viewport:'390x844',mobileScene,errors:mobile.errors});
  const endings=[]; for(const [name,pattern] of Object.entries({official:[0],dossier:[1],cross:[2],two:[0,1],three:[0,1,2]})) endings.push(await runEnding(pattern,name));
  const report={schemaVersion:'MAIN20-BROWSER-SMOKE-1',status:results.every((item)=>item.errors.length===0&&(!item.first?.imageIssues?.length)&&(!item.mobileScene?.imageIssues?.length))&&endings.every((item)=>item.errors.length===0&&item.ending&&item.scenes.every((scene)=>!scene.imageIssues?.length))&&first.excerptCount===5&&first.windowState.body&&first.windowState.paperHidden&&first.windowState.choiceHidden&&first.scrollAfter>=first.scrollBefore-2?'PASS':'FAIL',results,endings,checkedAt:new Date().toISOString()};
  fs.writeFileSync('docs/v30/MAIN20_BROWSER_EVIDENCE.json',JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2)); if(report.status!=='PASS')process.exitCode=1;
} finally { await browser.close(); }
