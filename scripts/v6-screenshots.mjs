import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
const page = await context.newPage();
await page.goto('http://127.0.0.1:4173/', {waitUntil:'domcontentloaded', timeout:15000});
await page.locator('#paper').waitFor();
await mkdir(new URL('../docs/v6/screenshots/before/', import.meta.url), {recursive:true});
await mkdir(new URL('../docs/v6/screenshots/after/', import.meta.url), {recursive:true});
for (const id of ['E02','E05','E07']) {
  await page.evaluate((scene) => document.querySelector(`[data-scene="${scene}"]`)?.click(), id);
  await page.waitForTimeout(120);
  await page.screenshot({path:fileURLToPath(new URL(`../docs/v6/screenshots/before/${id}.png`, import.meta.url)), fullPage:true});
}
for (const id of ['E02','E05','E07']) {
  await page.evaluate((scene) => document.querySelector(`[data-scene="${scene}"]`)?.click(), id);
  await page.waitForTimeout(120);
  await page.locator('#sourceBtn').click();
  await page.locator('#sourceDrawer').waitFor({state:'visible', timeout:5000});
  await page.screenshot({path:fileURLToPath(new URL(`../docs/v6/screenshots/after/${id}-source-drawer.png`, import.meta.url)), fullPage:true});
  await page.locator('#closeDrawer').click();
}
await browser.close();
console.log('v6 screenshots: before/after E02, E05, E07 — PASS');
