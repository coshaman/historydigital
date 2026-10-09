import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV26Manifest), null, { timeout: 10000 });
const readyIds = await page.evaluate(() => window.__goldRuntime.getV26Manifest().cases.filter(item => !String(item.sourceStatus || '').startsWith('BLOCKED_')).map(item => item.caseId));
const ids = [...new Set([...readyIds, 'C06', 'C07', 'C19'])];
const runs = [];
for (const caseId of ids) {
  await page.evaluate(() => { localStorage.removeItem('chancery-gold-runtime-v1'); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#ledgerObject').click();
  await page.locator(`[data-ledger-scene="${caseId}"]`).last().click({ force: true });
  await page.locator('.v25-pilot-excerpt-head').first().waitFor({ state: 'visible' });
  const excerptCount = await page.locator('.v25-pilot-excerpt-head').count();
  if (excerptCount !== 5) throw new Error(`${caseId} excerpt count ${excerptCount}`);
  for (let index = 0; index < excerptCount; index++) await page.locator('.v25-pilot-excerpt-head').nth(index).click();
  await page.getByText('다섯 발췌를 읽고 처리 단계로 이동').click();
  await page.locator('#choiceArea button').first().click();
  await page.locator('#choiceArea button').first().click();
  await page.locator('#choiceArea button').first().click();
  runs.push(await page.evaluate(() => ({ caseId: window.__goldRuntime.getState().caseId, phase: window.__goldRuntime.getState().phase, completed: window.__goldRuntime.getState().completedScenes.slice(-1)[0] })));
}
await page.screenshot({ path: 'docs/v26/v26-ready-case-smoke.png', fullPage: true });
await browser.close();
if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
console.log(JSON.stringify({ status: 'PASS', readyCaseIds: ids, runs, screenshot: 'docs/v26/v26-ready-case-smoke.png' }, null, 2));
