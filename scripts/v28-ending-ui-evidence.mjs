import fs from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/#v28';
const out = 'artifacts/v28-browser';
fs.mkdirSync(out, { recursive: true });
const cases = {
  DOSTOEVSKY_PETRASHEVSKY: { counts: { 1: 1, 2: 0, 3: 0 } },
  HERZEN: { counts: { 1: 0, 2: 1, 3: 0 } },
  BELINSKY: { counts: { 1: 0, 2: 0, 3: 1 } },
  KHOMYAKOV: { counts: { 1: 1, 2: 1, 3: 0 } },
  UVAROV: { counts: { 1: 1, 2: 1, 3: 1 } }
};
const browser = await chromium.launch({ headless: true });
const report = { schemaVersion: 'V28-ENDING-UI-EVIDENCE-1', generatedAt: new Date().toISOString(), endings: [], pageErrors: [] };
try {
  for (const [endingId, spec] of Object.entries(cases)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => report.pageErrors.push(`${endingId}: ${error}`));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph), null, { timeout: 30000 });
    await page.evaluate(counts => {
      const state = window.__goldRuntime.getState();
      state.v28.choiceCounts = counts;
      state.v28.witnessedCharacters = ['alexei', 'ekaterina', 'pavel'];
      window.__goldRuntime.v28ShowEnding();
    }, spec.counts);
    await page.locator('#endingOverlay').waitFor({ state: 'visible', timeout: 10000 });
    const title = await page.locator('#endingTitle').innerText();
    const filename = `ending-${endingId.toLowerCase()}.png`;
    await page.screenshot({ path: `${out}/${filename}`, fullPage: false, timeout: 10000 });
    report.endings.push({ endingId, title, filename, visible: true, counts: spec.counts });
    await page.close();
  }
} catch (error) {
  report.status = 'FAIL';
  report.failure = String(error);
}
if (!report.status) report.status = report.pageErrors.length ? 'FAIL' : (report.endings.length === 5 ? 'PASS' : 'FAIL');
fs.writeFileSync(`${out}/V28_ENDING_UI_EVIDENCE.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (report.status !== 'PASS') process.exitCode = 1;
