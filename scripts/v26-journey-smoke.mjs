import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('#ledgerObject').click();
await page.locator('[data-ledger-scene="C01"]').click({ force: true });
for (let index = 0; index < 24; index++) {
  await page.locator('.v25-pilot-excerpt-head').first().waitFor({ state: 'visible' });
  const count = await page.locator('.v25-pilot-excerpt-head').count();
  if (count !== 5) throw new Error(`C${String(index + 1).padStart(2, '0')} excerpt count ${count}`);
  for (let excerpt = 0; excerpt < count; excerpt++) await page.locator('.v25-pilot-excerpt-head').nth(excerpt).click();
  await page.getByText('다섯 발췌를 읽고 처리 단계로 이동').click();
  await page.locator('#choiceArea button').first().click();
  await page.locator('#choiceArea button').first().click();
  await page.locator('#choiceArea button').first().click();
}
await page.locator('#endingOverlay').waitFor({ state: 'visible' });
const result = await page.evaluate(() => ({
  state: window.__goldRuntime.getState().v26,
  endingTitle: document.querySelector('#endingTitle')?.textContent,
  endingVisible: !document.querySelector('#endingOverlay')?.hidden,
  caseCount: window.__goldRuntime.getV26Manifest().cases.length
}));
await page.screenshot({ path: 'docs/v26/v26-c24-ending-smoke.png', fullPage: true });
await browser.close();
if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
if (!result.endingVisible || result.state.completedCaseIds.length !== 24) throw new Error(`journey incomplete: ${JSON.stringify(result)}`);
console.log(JSON.stringify({ status: 'PASS', result, screenshot: 'docs/v26/v26-c24-ending-smoke.png' }, null, 2));
