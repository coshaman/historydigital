import fs from 'node:fs';
import { chromium } from 'playwright';

const graph = JSON.parse(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json', 'utf8'));
const out = 'artifacts/v28-browser/all-cases';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error)));
await page.goto('http://127.0.0.1:4173/#v28-reset', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph), null, { timeout: 30000 });
const results = [];
for (const data of graph.cases) {
  await page.evaluate((caseId) => window.__goldRuntime.renderGold(caseId), data.caseId);
  await page.waitForFunction((caseId) => document.body.classList.contains(`case-${caseId.toLowerCase()}`), data.caseId, { timeout: 10000 });
  await page.evaluate(() => { for (let guard = 0; guard < 40; guard += 1) { const button = [...document.querySelectorAll('.v28-runtime #choiceArea button')].find((item) => /다음 말을 듣는다|고개를 들고 대답한다/.test(item.textContent || '')); if (!button) break; button.click(); } });
  await page.waitForFunction(() => document.querySelectorAll('.v28-runtime #choiceArea button').length === 3, null, { timeout: 10000 });
  const title = await page.locator('#paperTitle').innerText();
  const date = await page.locator('#paperDate').innerText();
  const screenshot = `${out}/${data.caseId}-arrival.png`;
  await page.screenshot({ path: screenshot });
  results.push({ caseId: data.caseId, expectedTitle: data.titleKo, actualTitle: title, date, choiceCount: 3, screenshot });
}
const dates = results.map((item) => String(item.date));
const chronological = dates.every((date, index) => index === 0 || date >= dates[index - 1]);
const report = { schemaVersion: 'V28-ALL-CASES-BROWSER-1', status: results.length === 24 && chronological && results.every((item) => item.expectedTitle === item.actualTitle) && pageErrors.length === 0 ? 'PASS' : 'FAIL', caseCount: results.length, chronological, pageErrors, results };
fs.writeFileSync('docs/v28/ALL_CASES_BROWSER_EVIDENCE.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (report.status !== 'PASS') process.exit(1);
