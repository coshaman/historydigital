import fs from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const results = [];
for (const choiceIndex of [0, 1, 2]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto('http://127.0.0.1:4173/#v28-reset', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph), null, { timeout: 30000 });
  await page.locator('.v28-runtime #choiceArea button').nth(choiceIndex).click();
  await page.getByText('상대가 건넨 종이를 펼친다', { exact: true }).click();
  await page.getByText('읽은 것을 말한다', { exact: true }).click();
  const aftermathText = await page.locator('#dialogue').innerText();
  await page.getByText('오늘의 기록을 접는다', { exact: true }).click();
  const memory = await page.evaluate(() => window.__goldRuntime.getState().v28.memoryCallbacks.at(-1));
  await page.getByText('다음 봉투를 받는다', { exact: true }).click();
  const nextCaseText = await page.locator('#dialogue').innerText();
  results.push({ choiceIndex: choiceIndex + 1, aftermathText, memory, nextCaseText, callbackVisibleInNextCase: nextCaseText.includes(memory.callback), pageErrors });
  await context.close();
}
const report = { schemaVersion: 'V28-MEMORY-BROWSER-1', status: results.every((item) => item.callbackVisibleInNextCase && item.pageErrors.length === 0) ? 'PASS' : 'FAIL', results };
fs.writeFileSync('docs/v28/RELATIONSHIP_MEMORY_BROWSER_EVIDENCE.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (report.status !== 'PASS') process.exit(1);
