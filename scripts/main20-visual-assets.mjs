import fs from 'node:fs';
import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
const results = [];
for (const [name, viewport, contextOptions] of [['desktop-start',{width:1440,height:900},{}],['mobile-start',{width:390,height:844},{}],['mobile-reduced',{width:390,height:844},{reducedMotion:'reduce'}]]) {
  const context = await browser.newContext({viewport,...contextOptions});
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/?main20=1#main20-reset',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => Boolean(window.__main20));
  await page.screenshot({path:`artifacts/main20-browser/${name}.png`});
  const state = await page.evaluate(() => ({imageIssues:Array.from(document.images).filter((image) => !image.parentElement?.hidden && getComputedStyle(image).display !== 'none' && (!image.complete || image.naturalWidth === 0)).map((image) => image.getAttribute('src') || image.alt),reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,deskCanvasDisplay:getComputedStyle(document.querySelector('#deskCanvas')).display}));
  results.push({name,viewport,imageIssues:state.imageIssues,reducedMotion:state.reducedMotion,deskCanvasDisplay:state.deskCanvasDisplay});
  await context.close();
}
const report = {schemaVersion:'MAIN20-VISUAL-ASSETS-1',status:results.every((item)=>item.imageIssues.length===0)&&results.find((item)=>item.name==='mobile-reduced')?.reducedMotion&&results.find((item)=>item.name==='mobile-reduced')?.deskCanvasDisplay==='none'?'PASS':'FAIL',results,checkedAt:new Date().toISOString()};
fs.writeFileSync('docs/v30/MAIN20_VISUAL_ASSETS.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
await browser.close();
if (report.status !== 'PASS') process.exit(1);
