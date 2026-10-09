import fs from 'node:fs';
import { chromium } from 'playwright';

const out = 'artifacts/v28-browser';
fs.mkdirSync(out, {recursive:true});
const forbidden = ['시범 케이스', '자료 처리의 순서', '내 판단', '케이스 후속 기록', '분기 후속 문서'];
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));
const report = {schemaVersion:'V28-LEGACY-COPY-BROWSER-1', status:'FAIL', forbidden, pageErrors, screenshots:[]};
try {
  await page.goto('http://127.0.0.1:4173/#v28', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => Boolean(window.__goldRuntime?.renderGold));
  await page.evaluate(() => { localStorage.removeItem('chancery-gold-runtime-v1'); window.__goldRuntime.renderGold('E02'); });
  await page.waitForTimeout(100);
  const visibleText = await page.locator('body').innerText();
  report.visibleForbidden = forbidden.filter(text => visibleText.includes(text));
  report.visibleCopyClear = report.visibleForbidden.length === 0;
  const screenshot = `${out}/legacy-copy-sanitized-e02.png`;
  await page.screenshot({path:screenshot,fullPage:false});
  report.screenshots.push(screenshot);
  report.status = report.visibleCopyClear && pageErrors.length === 0 ? 'PASS' : 'FAIL';
} catch (error) {
  report.failures = [String(error)];
}
fs.writeFileSync('docs/v28/LEGACY_COPY_BROWSER_EVIDENCE.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (report.status !== 'PASS') process.exitCode = 1;
