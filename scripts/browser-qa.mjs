import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base='http://127.0.0.1:4173/';
await mkdir(new URL('../artifacts/qa/',import.meta.url),{recursive:true});
const failures=[];
async function run(name, viewport, mobile=false){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport,isMobile:mobile,deviceScaleFactor:1});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  const page=await context.newPage(); await page.route('https://cdn.jsdelivr.net/**',route=>route.abort()); const errors=[];
  page.on('console',msg=>{if(msg.type()==='error'&&!/ERR_FAILED|ERR_NETWORK_ACCESS_DENIED/.test(msg.text()))errors.push(msg.text());}); page.on('pageerror',err=>errors.push(String(err)));
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:15000}); await page.locator('#paper').waitFor(); await page.waitForTimeout(1200);
    if(name==='desktop'){
      await page.locator('#sourceBtn').click(); await page.locator('.source-reading').waitFor();
      await page.locator('#transcriptionTab').click(); await page.locator('#sourceTranscription').waitFor({state:'visible'});
      await page.locator('#translationTab').click(); await page.locator('#sourceTranslation').waitFor({state:'visible'});
      await page.locator('#underlineAction').click(); if((await page.locator('#evidenceCount').textContent())==='0')throw new Error('evidence action did not update state');
      await page.locator('#closeDrawer').click();
      await page.locator('#caseSelector').selectOption('C15'); if(await page.locator('#caseReviewList button').count()!==6)throw new Error('case review list not mounted'); await page.locator('#caseReviewList button').first().click(); await page.locator('#closeDrawer').click(); await page.locator('#sourceBtn').click(); if(await page.locator('#caseEvidenceList button').count()===0)throw new Error('source-backed case excerpts not mounted'); await page.locator('#closeDrawer').click(); await page.locator('#caseSelector').selectOption('C01'); await page.locator('#caseReviewList button').nth(0).click(); await page.locator('#closeDrawer').click(); await page.locator('#caseReviewList button').nth(1).click(); await page.locator('#closeDrawer').click(); await page.locator('#paperTitle').waitFor(); if(!(await page.locator('#dialogue').textContent()).includes('봉투에는'))throw new Error('case-specific authored opening not rendered');
      await page.locator('#reply').fill('원문과 발행지를 먼저 대조해 처리합니다.'); await page.locator('#submitReply').click();
      await page.locator('#choiceArea button').first().click(); if(!(await page.locator('#dialogue').textContent()).includes('차다예프'))throw new Error('case-specific follow-up not rendered'); await page.locator('#choiceArea button').first().click(); await page.locator('#choiceArea button').first().click(); await page.locator('#choiceArea button').first().click();
      if((await page.locator('#paperTitle').textContent()).trim()==='차다예프의 첫 철학적 편지')throw new Error('case route did not advance');
      await page.reload({waitUntil:'domcontentloaded',timeout:15000}); await page.locator('#paper').waitFor();
      for(let i=0;i<10;i++){const id=`C${String(i+1).padStart(2,'0')}`;await page.locator('#caseSelector').selectOption(id);for(let review=0;review<2;review++){await page.locator('#caseReviewList button').nth(review).click();await page.locator('#closeDrawer').click();}await page.locator('#reply').fill(`사건 ${id}의 발행 경로와 검토 문서를 대조해 기록합니다.`);await page.locator('#submitReply').click();for(let turn=0;turn<4;turn++)await page.locator('#choiceArea button').first().click();if(i<9&&await page.locator('#caseSelector').inputValue()!==`C${String(i+2).padStart(2,'0')}`)throw new Error(`route stopped after ${id}`);}
      if(!(await page.locator('#paperTitle').textContent()).includes('Досье'))throw new Error('10-case route did not arrive at E07 dossier');
      const catalog=await context.newPage();await catalog.route('https://cdn.jsdelivr.net/**',route=>route.abort());await catalog.goto(base,{waitUntil:'domcontentloaded',timeout:15000});await catalog.locator('#paper').waitFor();for(let i=1;i<=24;i++){const id=`C${String(i).padStart(2,'0')}`;await catalog.locator('#caseSelector').selectOption(id);if((await catalog.locator('#paperTitle').textContent()).trim().length<2)throw new Error(`${id} title did not render`);if(await catalog.locator('#caseReviewList button').count()!==6)throw new Error(`${id} review list incomplete`);for(let review=0;review<2;review++){await catalog.locator('#caseReviewList button').nth(review).click();await catalog.locator('#closeDrawer').click();}await catalog.locator('#reply').fill(`사건 ${id}의 문서와 발행 경로를 대조해 기록합니다.`);await catalog.locator('#submitReply').click();for(let turn=0;turn<4;turn++){await catalog.locator('#choiceArea button').first().click();}if(i<24&&await catalog.locator('#paperTitle').textContent().then(text=>text.trim().length<2))throw new Error(`${id} conversation did not advance`);}await catalog.close();
      await page.locator('#saveBtn').click(); await page.reload({waitUntil:'domcontentloaded',timeout:15000}); await page.locator('#paper').waitFor(); await page.locator('#loadBtn').click();
      await page.goto(base,{waitUntil:'domcontentloaded',timeout:15000}); await page.waitForFunction(()=>window.__chanceryQA);
      for(const [id,title] of [['UVAROV','법무 책상'],['KHOMYAKOV','응접실'],['BELINSKY','열려 있는 한계'],['HERZEN','국경 너머'],['DOSTOEVSKY_PETRASHEVSKY','수사 기록']]){const rendered=await page.evaluate((ending)=>window.__chanceryQA.reachEnding(ending),id);if(rendered!==title)throw new Error(`ending ${id} rendered ${rendered}`);}
    }
    await page.screenshot({path:`artifacts/qa/${name}.png`,fullPage:true});
    if(errors.length)throw new Error(errors.join('\n'));
  }catch(error){failures.push(`${name}: ${error.message}`);}
  finally{await context.tracing.stop({path:`artifacts/qa/${name}.trace.zip`}); await browser.close();}
}
await run('desktop',{width:1440,height:900}); await run('mobile',{width:390,height:844},true);
if(failures.length){console.error(failures.join('\n'));process.exit(1);} console.log('browser-qa: desktop/mobile render, source tabs, evidence action, case route, save/reload, screenshots, and trace — PASS');
