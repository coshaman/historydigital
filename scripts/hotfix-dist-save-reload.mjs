import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const port=4194;
const server=spawn(process.execPath,['server.mjs'],{cwd:'dist',env:{...process.env,CHANCERY_PORT:String(port)},stdio:['ignore','pipe','pipe']});
const errors=[];server.stderr.on('data',c=>errors.push(String(c)));
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(String(e)));
try {
  const root=`http://127.0.0.1:${port}`;
  await page.goto(`${root}/#v28`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.removeItem('chancery-gold-runtime-v1'));
  await page.goto(`${root}/#v28-reset`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.__goldRuntime?.getV28Graph));
  await page.goto(`${root}/#v28`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{for(let i=0;i<40;i++){const b=[...document.querySelectorAll('.v28-runtime #choiceArea button')];if(b.length!==1||!/다음 대사|대화 뒤 문서를 확인한다/.test(b[0].textContent||''))break;b[0].click()}});
  await page.locator('.v28-runtime #choiceArea button').first().click();
  await page.locator('#saveBtn').click();
  const before=await page.evaluate(()=>window.__goldRuntime.getState().v28.phase);
  await page.reload();
  await page.waitForFunction(()=>Boolean(window.__goldRuntime?.getV28Graph));
  const after=await page.evaluate(()=>window.__goldRuntime.getState().v28.phase);
  const resume=await page.getByText('상대가 건넨 종이를 펼친다',{exact:true}).count();
  const report={schemaVersion:'V29-HOTFIX-DIST-SAVE-RELOAD-1',status:before==='reaction'&&after==='reaction'&&resume===1&&errors.length===0?'PASS':'FAIL',beforePhase:before,afterPhase:after,resumeButtonCount:resume,pageErrors:errors,port};
  fs.mkdirSync('docs/v29-hotfix',{recursive:true});fs.writeFileSync('docs/v29-hotfix/DIST_SAVE_RELOAD.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
} finally {await browser.close();server.kill()}
