import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const out='docs/v18'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
await page.bringToFront();
await page.addInitScript(()=>localStorage.removeItem('chancery-gold-runtime-v1'));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__threeRuntime?.loaded&&window.__goldRuntime?.cases,{timeout:15000});
await page.waitForTimeout(1200);

const measure=async label=>page.evaluate(async label=>{const values=[];let previous=performance.now();const start=previous;await new Promise(resolve=>{const tick=now=>{values.push(now-previous);previous=now;if(now-start<1800)requestAnimationFrame(tick);else resolve()};requestAnimationFrame(tick)});const sorted=[...values.slice(1)].sort((a,b)=>a-b);const pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];return {label,frameCount:sorted.length,medianFrameMs:pct(.5),p95FrameMs:pct(.95),fpsMedian:1000/pct(.5),fpsP95:1000/pct(.95),longFrameCount:sorted.filter(frame=>frame>33.33).length};},label);
const samples=[];
samples.push(await measure('E02-idle'));
await page.evaluate(()=>window.__goldRuntime.renderGold('CENSORSHIP_CASE_1847_07')); await page.waitForTimeout(250); samples.push(await measure('censorship-case'));
await page.evaluate(()=>window.__goldRuntime.renderGold('PERIODICAL_REVIEW_GOLD_1847')); await page.waitForTimeout(250); samples.push(await measure('periodical-review'));
await page.locator('#petersburgWindow').click(); await page.waitForTimeout(450); samples.push(await measure('window-dolly-focus'));
await page.locator('#notebookObject').click(); await page.waitForTimeout(450); samples.push(await measure('notebook-dolly-focus'));
const interactionLatency=await page.evaluate(()=>{const start=performance.now();document.querySelector('#closeNotebook')?.click();document.querySelector('#petersburgWindow')?.click();return {windowAndNotebookToggleMs:performance.now()-start,focused:document.body.classList.contains('window-focused')};});
const metrics=await page.evaluate(()=>window.__threeRuntime?.getMetrics?.()||null);
const result={measurementType:'headed Chromium foreground run',viewport:{width:1440,height:900},samples,interactionLatency,threeMetrics:metrics,medianFpsMin:Math.min(...samples.map(s=>s.fpsMedian)),p95FrameTimeMax:Math.max(...samples.map(s=>s.p95FrameMs)),longFrameCountTotal:samples.reduce((n,s)=>n+s.longFrameCount,0),targetMedianFps50Plus:samples.every(s=>s.fpsMedian>=50),pass:samples.every(s=>s.fpsMedian>=50)&&samples.every(s=>s.p95FrameMs<=33.33)};
await writeFile(`${out}/PERFORMANCE_RESULT.json`,JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2)); await browser.close();
