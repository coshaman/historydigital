import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const root = 'docs/v25/visuals2';
await mkdir(`${root}/screenshots`, { recursive: true });
const viewports = [['desktop_1366x768', 1366, 768], ['desktop_1440x900', 1440, 900], ['desktop_1920x1080', 1920, 1080], ['mobile_390x844', 390, 844], ['mobile_360x780', 360, 780]];
const runs = [];
for (const [name, width, height] of viewports) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(() => localStorage.removeItem('chancery-gold-runtime-v1'));
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(() => window.__goldRuntime?.getPilotManifest);
  await page.locator('#ledgerObject').click();
  await page.locator('[data-ledger-scene="C06"]').click();
  const capture = async (phase) => {
    const metrics = await page.evaluate((currentPhase) => {
      const buttons = [...document.querySelectorAll('button')].filter((button) => { const rect = button.getBoundingClientRect(); return rect.width && rect.height && !button.hidden && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth; });
      return { phase: currentPhase, small: buttons.filter((button) => { const rect = button.getBoundingClientRect(); return rect.width < 44 || rect.height < 44; }).length, horizontal: document.documentElement.scrollWidth - innerWidth, bodyScroll: document.body.scrollHeight, state: window.__goldRuntime.getState().phase };
    }, phase);
    await page.screenshot({ path: `${root}/screenshots/${name}-${phase}.png` });
    return metrics;
  };
  const read = await capture('read');
  for (let index = 0; index < 5; index += 1) await page.locator('.v25-pilot-excerpt-head').nth(index).click();
  await page.locator('.pilot-continue').click();
  const treatment = await capture('treatment');
  await page.locator('#choiceArea button').first().click();
  const judgment = await capture('judgment');
  await page.locator('#choiceArea button').first().click();
  const follow = await capture('followup');
  runs.push({ name, read, treatment, judgment, follow });
  await page.close();
}
const result = { status: runs.every((run) => [run.read, run.treatment, run.judgment, run.follow].every((phase) => phase.horizontal <= 0 && phase.small === 0)) ? 'PASS' : 'FAIL', runs };
await writeFile(`${root}/manifest.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: result.status, count: runs.length }, null, 2));
await browser.close();
if (result.status !== 'PASS') process.exitCode = 1;
