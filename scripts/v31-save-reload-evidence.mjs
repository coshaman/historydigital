import fs from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/?v31=save-reload#v28-reset';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(15000);
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.goto('http://127.0.0.1:4173/?v31=save-reload#v28', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph));

async function intro() {
  await page.evaluate(() => {
    for (let guard = 0; guard < 12; guard += 1) {
      const button = document.querySelector('.v28-runtime #choiceArea button');
      if (!button || !/다음 말을 듣는다|고개를 들고 대답한다/.test(button.textContent || '')) break;
      button.click();
    }
  });
  await page.waitForFunction(() => document.querySelectorAll('.v28-runtime #choiceArea button').length === 3);
}

const checkpoints = [];
await intro();
const introState = await page.evaluate(() => window.__goldRuntime.getState().v28);
await page.reload();
await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph));
checkpoints.push({ point: 'intro', phase: await page.evaluate(() => window.__goldRuntime.getState().v28.phase), choices: await page.locator('#choiceArea button').count() });

await page.locator('#choiceArea button').nth(0).click();
await page.locator('button.v28-action:visible').filter({ hasText: '봉투를 펼쳐 본다' }).count();
await page.reload();
await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph));
await page.waitForFunction(() => [...document.querySelectorAll('button.v28-action')].some((button) => button.textContent?.includes('봉투를 펼쳐 본다')));
checkpoints.push({ point: 'reaction', phase: await page.evaluate(() => window.__goldRuntime.getState().v28.phase), envelope: await page.locator('button.v28-action:visible').filter({ hasText: '봉투를 펼쳐 본다' }).count() });

await page.evaluate(() => [...document.querySelectorAll('button.v28-action')].find((button) => button.textContent?.includes('봉투를 펼쳐 본다'))?.click());
await page.waitForSelector('.v28-excerpt-open');
await page.locator('.v28-excerpt-open').first().click();
await page.reload();
await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph));
checkpoints.push({ point: 'evidence', phase: await page.evaluate(() => window.__goldRuntime.getState().v28.phase), openExcerpt: await page.locator('.v28-excerpt-open').count(), readExcerpt: await page.locator('.v28-excerpt-open.is-read').count() });

await browser.close();
const report = { schemaVersion: 'V31-SAVE-RELOAD-EVIDENCE-1', status: checkpoints.every((item) => item.phase && item.phase !== 'arrival') && pageErrors.length === 0 ? 'PASS' : 'FAIL', checkpoints, introState: { phase: introState.phase, introIndex: introState.introIndex }, pageErrors, checkedAt: new Date().toISOString() };
fs.mkdirSync('docs/v31', { recursive: true });
fs.writeFileSync('docs/v31/SAVE_RELOAD_EVIDENCE.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exit(1);
