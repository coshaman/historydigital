import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
const page = await context.newPage();
await page.goto('http://127.0.0.1:4173/#legacy', {waitUntil:'domcontentloaded',timeout:15000});
await page.waitForFunction(() => window.__threeRuntime && window.__goldRuntime, null, {timeout:15000});
const result = await page.evaluate(async () => {
  const gate = window.__threeRuntime;
  if (!gate?.loaded || !gate.local || gate.fallback || !gate.renderer?.info || !document.querySelector('#deskCanvas')?.dataset.threeLoaded) throw new Error('real local WebGL gate failed');
  const samples = async (label) => {
    const frames = await new Promise(resolve => { const values=[]; let previous=performance.now(); let count=0; const tick=now=>{ if(count++) values.push(now-previous); previous=now; if(count<31) requestAnimationFrame(tick); else resolve(values.slice(1)); }; requestAnimationFrame(tick); });
    const sorted=[...frames].sort((a,b)=>a-b); const percentile=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
    return {label, frameTimeMedian:percentile(.5), frameTimeP95:percentile(.95), fpsMedian:1000/percentile(.5), fpsP95:1000/percentile(.95), metrics:gate.getMetrics()};
  };
  const idle=await samples('idle');
  await window.__goldRuntime.selectGoldExcerpt('E02-X2');
  const pickup=await samples('document-pickup');
  document.querySelector('#sourceBtn').click();
  const drawer=await samples('drawer-interaction');
  document.querySelector('#closeDrawer').click();
  document.querySelector('#petersburgWindow').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const windowInteraction=await samples('window-interaction');
  return {gate:{loaded:gate.loaded,local:gate.local,fallback:gate.fallback,canvas:gate.canvas.dataset.threeLoaded}, samples:[idle,pickup,drawer,windowInteraction]};
});
await mkdir(new URL('../docs/v6/', import.meta.url), {recursive:true});
await writeFile(new URL('../docs/v6/gold-webgl-performance.json', import.meta.url), JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
await browser.close();
