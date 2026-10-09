import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({headless:true});
const viewports = { '1440x900':{width:1440,height:900}, '1366x768':{width:1366,height:768}, '1920x1080':{width:1920,height:1080} };
for (const [name, viewport] of Object.entries(viewports)) {
  const context = await browser.newContext({viewport,deviceScaleFactor:1}); const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/#legacy', {waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(() => window.__goldRuntime && window.__threeRuntime?.loaded, null, {timeout:15000});
  if (await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1)) throw new Error(`${name}: body scroll present`);
  for (const id of ['E02','E05','E07']) {
    await page.evaluate(scene => document.querySelector(`[data-scene="${scene}"]`).click(), id); await page.waitForTimeout(150);
    const dir = new URL(`../docs/v6/screenshots/runtime/${name}/`, import.meta.url); await mkdir(dir,{recursive:true});
    await page.screenshot({path:fileURLToPath(new URL(`${id}-desk.png`,dir)),fullPage:true});
    await page.locator('#sourceBtn').click(); await page.waitForTimeout(150); await page.screenshot({path:fileURLToPath(new URL(`${id}-drawer.png`,dir)),fullPage:true}); await page.locator('#closeDrawer').click();
  }
  await context.close();
}
await browser.close();
console.log('gold-browser-qa: E02/E05/E07, local desk, window, drawer, and 3 viewports — PASS');
