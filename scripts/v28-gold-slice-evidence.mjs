import fs from 'node:fs';
import { chromium } from 'playwright';

const cases = ['C01', 'C07', 'C17', 'C24'];
const out = 'artifacts/v28-browser/gold-slice';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));
await page.goto('http://127.0.0.1:4173/#v28-reset', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph), null, { timeout: 30000 });
const results = [];
for (const caseId of cases) {
  await page.evaluate((id) => window.__goldRuntime.renderGold(id), caseId);
  await page.waitForFunction((id) => document.body.classList.contains(`case-${id.toLowerCase()}`), caseId);
  await page.evaluate(() => { for (let guard = 0; guard < 40; guard += 1) { const button = [...document.querySelectorAll('.v28-runtime #choiceArea button')].find((item) => /다음 말을 듣는다|고개를 들고 대답한다/.test(item.textContent || '')); if (!button) break; button.click(); } });
  await page.waitForFunction(() => document.querySelectorAll('.v28-runtime #choiceArea button').length === 3);
  await page.screenshot({ path: `${out}/${caseId}-arrival-1440x900.png` });
  await page.locator('.v28-runtime #choiceArea button').first().click({ force: true });
  await page.screenshot({ path: `${out}/${caseId}-reaction-1440x900.png` });
  await page.getByText('봉투를 펼쳐 본다', { exact: true }).click({ force: true });
  await page.waitForSelector('.v28-excerpt-open');
  await page.screenshot({ path: `${out}/${caseId}-inspection-1440x900.png` });
  await page.evaluate(() => document.querySelectorAll('.v28-excerpt-open').forEach((button) => button.click()));
  await page.getByText('읽은 내용을 들려준다', { exact: true }).click({ force: true });
  await page.screenshot({ path: `${out}/${caseId}-aftermath-1440x900.png` });
  results.push({ caseId, screenshots: ['arrival', 'reaction', 'inspection', 'aftermath'].map((state) => `${out}/${caseId}-${state}-1440x900.png`) });
}
const report = { schemaVersion: 'V28-GOLD-SLICE-EVIDENCE-1', status: pageErrors.length ? 'FAIL' : 'PASS', viewport: { width: 1440, height: 900 }, pageErrors, cases: results };
fs.writeFileSync('docs/v28/GOLD_SLICE_EVIDENCE.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (report.status !== 'PASS') process.exit(1);
