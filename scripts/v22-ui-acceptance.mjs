import {chromium} from 'playwright'; import {mkdir,writeFile} from 'node:fs/promises';
const out='docs/v22'; await mkdir(`${out}/screenshots`,{recursive:true}); const browser=await chromium.launch({headless:true});
function overlap(a,b){return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));}
async function run(viewport){const page=await browser.newPage({viewport});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});await page.addInitScript(()=>localStorage.removeItem('chancery-gold-runtime-v1'));await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__goldRuntime?.renderGold);await page.evaluate(()=>window.__goldRuntime.renderGold('PERIODICAL_REVIEW_GOLD_1847'));
  const result={viewport,phases:{},errors};
  const snap=async phase=>{
    const data=await page.evaluate(()=>{
      const els=[...document.querySelectorAll('.periodical-detail,.periodical-followup-detail,.choice-area button,.dialogue-strip')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height});
      const rects=els.map(e=>e.getBoundingClientRect().toJSON()); const intersections=[];
      for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];const area=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));if(area>16)intersections.push([i,j,area]);}
      const samples=[[10,10],[innerWidth/2,innerHeight/2],[innerWidth-10,innerHeight/2],[innerWidth/2,innerHeight-10],[innerWidth/2,100]].map(([x,y])=>document.elementsFromPoint(x,y).slice(0,5).map(e=>e.tagName+'.'+e.className));
      const ko=[...document.querySelectorAll('.ko-text')].map(e=>parseFloat(getComputedStyle(e).fontSize));
      const visible=els.filter(e=>{const r=e.getBoundingClientRect();return r.bottom>=0&&r.top<=innerHeight&&r.right>=0&&r.left<=innerWidth}).length;
      return {visibleRatio:els.length?visible/els.length:1,intersections,samples,ko,bodyScrollHeight:document.body.scrollHeight};
    });
    result.phases[phase]=data; await page.screenshot({path:`${out}/screenshots/ui-${viewport.width}x${viewport.height}-${phase}.png`});
  };
  await page.locator('.periodical-object-head').nth(0).click();await snap('read');await page.locator('.periodical-object-head').nth(0).click();await page.locator('.periodical-object-head').nth(1).click();await snap('attention');await page.locator('.periodical-object-head').nth(1).click();await page.locator('.press-confirm').click();await snap('treatment');await page.locator('[data-choice-id="PERIODICAL-TREATMENT-lead-review"]').click();await snap('judgment');await page.locator('#choiceArea button').first().click();await page.locator('#choiceArea button').first().click();await snap('followup');await page.close();return result;}
const all=[await run({width:1366,height:768}),await run({width:1440,height:900}),await run({width:390,height:844})];const result={capturedAt:'2026-10-01',cases:all,pass:all.every(c=>!c.errors.length&&Object.values(c.phases).every(p=>p.visibleRatio>=.95&&!p.intersections.length&&p.bodyScrollHeight<=c.viewport.height&&(!c.viewport.width||c.viewport.width>500||p.ko.every(size=>size>=16))))};await writeFile(`${out}/UI_ACCEPTANCE.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();
