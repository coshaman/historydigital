import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const screenshotRoot = new URL('../docs/v7/screenshots/', import.meta.url);
await mkdir(screenshotRoot, {recursive:true});
const browser = await chromium.launch({headless:false});
const context = await browser.newContext({viewport:{width:1440,height:900}, deviceScaleFactor:1});
const page = await context.newPage();
await page.goto('http://127.0.0.1:4173/', {waitUntil:'domcontentloaded', timeout:15000});
await page.waitForFunction(() => window.__goldRuntime && window.__threeRuntime, null, {timeout:15000});
await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
await page.reload({waitUntil:'domcontentloaded'}); await page.waitForFunction(() => window.__goldRuntime && window.__threeRuntime, null, {timeout:15000});

const shot = async (name) => page.screenshot({path:fileURLToPath(new URL(name, screenshotRoot)), fullPage:true});
const render = async (caseId, subSceneId = null) => page.evaluate(({caseId,subSceneId}) => { const state=window.__goldRuntime.getState(); state.subSceneId=subSceneId; window.__goldRuntime.renderGold(caseId); }, {caseId,subSceneId});
await render('E05','E05-A'); await shot('E05-A-desk.png'); await page.locator('#sourceBtn').click(); await page.locator('#scanTab').click(); await shot('E05-A-original-source.png'); await page.locator('#closeDrawer').click();
await render('E05','E05-B'); await shot('E05-B-new-reply.png'); await page.locator('#sourceBtn').click(); await page.locator('#transcriptionTab').click(); await shot('E05-B-letter-reading.png'); await page.locator('#closeDrawer').click();
await render('E07'); await page.locator('#sourceBtn').click(); await page.locator('#scanTab').click(); await shot('E07-original-scan.png'); await page.locator('#transcriptionTab').click(); await shot('E07-metadata-reading.png'); await page.locator('#closeDrawer').click();

const measure = async (label, action = async () => {}) => {
  await action();
  const result = await page.evaluate(async label => {
    const frames = await new Promise(resolve => { const values=[]; let previous=performance.now(); const started=previous; let done=false; const finish=()=>{if(!done){done=true;resolve(values.slice(1));}}; const tick=now => { if (done) return; if (now-started >= 10000) return finish(); values.push(now-previous); previous=now; requestAnimationFrame(tick); }; requestAnimationFrame(tick); setTimeout(finish,10500); });
    const sorted=[...frames].sort((a,b)=>a-b); const percentile=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
    return {label, frameCount:frames.length, durationMs:frames.reduce((a,b)=>a+b,0), medianFrameMs:percentile(.5), p95FrameMs:percentile(.95), fpsMedian:1000/percentile(.5), fpsP95:1000/percentile(.95), longFramesOver33:frames.filter(v=>v>33).length, longFramesOver50:frames.filter(v=>v>50).length};
  }, label);
  return result;
};
const perf = [];
await render('E02'); perf.push(await measure('E02-idle'));
perf.push(await measure('E02-document-pickup', async () => await page.evaluate(() => window.__goldRuntime.selectGoldExcerpt('E02-X2'))));
perf.push(await measure('E02-drawer', async () => await page.locator('#sourceBtn').click()));
await page.locator('#closeDrawer').click();
perf.push(await measure('E02-window', async () => await page.locator('#petersburgWindow').click()));

const client = await context.newCDPSession(page); const chunks=[];
client.on('Tracing.dataCollected', event => chunks.push(...event.value));
await client.send('Tracing.start', {categories:'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-v8.execute', transferMode:'ReportEvents'});
await render('E05','E05-A'); await page.locator('#sourceBtn').click(); await page.locator('#transcriptionTab').click(); await page.waitForTimeout(2000); await page.locator('#closeDrawer').click(); await page.waitForTimeout(1000);
await client.send('Tracing.end'); await new Promise(resolve => client.once('Tracing.tracingComplete', resolve));
const traceSummary = {};
for (const event of chunks) { if (!event.dur || !event.name) continue; const key=event.name; const ms=event.dur/1000; if (!traceSummary[key]) traceSummary[key]={name:key,calls:0,totalMs:0,maxMs:0}; traceSummary[key].calls++; traceSummary[key].totalMs+=ms; traceSummary[key].maxMs=Math.max(traceSummary[key].maxMs,ms); }
const topHotspots = Object.values(traceSummary).sort((a,b)=>b.totalMs-a.totalMs).slice(0,10);
const runtime = await page.evaluate(() => ({browser:navigator.userAgent, viewport:{width:innerWidth,height:innerHeight}, devicePixelRatio, hardwareConcurrency:navigator.hardwareConcurrency, webglRenderer:(() => { const c=document.createElement('canvas'); const gl=c.getContext('webgl'); const ext=gl?.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable'; })(), three:window.__threeRuntime.getMetrics?.()}));
const output = {measurementType:'headed foreground Chromium', runtime, samples:perf, gate:{sustainedBelow30:perf.some(sample => sample.fpsMedian < 30), targetMedianFps50Plus:perf.every(sample => sample.fpsMedian >= 50), targetP95Frame33OrLess:perf.every(sample => sample.p95FrameMs <= 33)}, topHotspots, traceEventCount:chunks.length};
await writeFile(new URL('../docs/v7/v7-headed-performance.json', import.meta.url), JSON.stringify(output,null,2));
await writeFile(new URL('../docs/v7/v7-main-thread-trace.json', import.meta.url), JSON.stringify({measurementType:'headed foreground Chromium', topHotspots, traceEventCount:chunks.length},null,2));
console.log(JSON.stringify(output,null,2));
await browser.close();
