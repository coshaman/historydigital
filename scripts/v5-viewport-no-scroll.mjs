import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.CHANCERY_BASE || 'http://127.0.0.1:4173/';
const cases = [['desktop-1366x768',1366,768],['desktop-1440x900',1440,900],['desktop-1920x1080',1920,1080],['mobile-390x844',390,844]];
const browser = await chromium.launch({headless:true});
await mkdir('docs/audit/v5', {recursive:true});
const results=[]; const failures=[];
for (const [name,width,height] of cases) {
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(700);
  await page.screenshot({path:`docs/audit/v5/${name}.png`,fullPage:false});
  const m=await page.evaluate(()=>({
    viewport:[innerWidth,innerHeight], htmlScrollHeight:document.documentElement.scrollHeight, htmlClientHeight:document.documentElement.clientHeight,
    bodyScrollHeight:document.body.scrollHeight, bodyClientHeight:document.body.clientHeight, bodyOverflow:getComputedStyle(document.body).overflow,
    horizontal:document.documentElement.scrollWidth-document.documentElement.clientWidth, dpr:devicePixelRatio,
    canvas:document.querySelector('#deskCanvas')?.getBoundingClientRect().toJSON(), deskMetrics:window.__deskMetrics?.()
  }));
  results.push({name,...m});
  if(width>=900 && (m.htmlScrollHeight>m.htmlClientHeight+2 || m.bodyScrollHeight>m.bodyClientHeight+2)) failures.push(`${name}: body scroll ${m.htmlScrollHeight}/${m.htmlClientHeight}`);
  if(m.horizontal>0) failures.push(`${name}: horizontal overflow ${m.horizontal}`);
  await page.close();
}
await browser.close();
await writeFile('docs/audit/v5/viewport-metrics.json',JSON.stringify({base,results,failures},null,2));
console.log(JSON.stringify({results,failures},null,2));
if(failures.length) process.exit(1);
console.log('v5-viewport-no-scroll: desktop body fit and horizontal overflow checks — PASS');
