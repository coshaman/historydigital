import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out = path.join('artifacts', 'v38-browser');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const viewports = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const results = [];
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:4173/?main20=1#v38-${viewport.name}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__main20));
    while (await page.evaluate(() => window.__main20.getState().phase === 'intro')) await page.locator('#choiceArea button').first().click();
    const choiceTexts = await page.locator('#choiceArea .main20-choice-card').allTextContents();
    await page.screenshot({ path: path.join(out, `${viewport.name}-choice-direction.png`), fullPage: false });
    await page.locator('#choiceArea .main20-choice-card').first().click();
    await page.locator('#choiceArea button').first().click();
    await page.waitForFunction(() => window.__main20.getState().phase === 'reading');
    const contextTexts = await page.locator('.main20-context-range').allTextContents();
    await page.screenshot({ path: path.join(out, `${viewport.name}-contiguous-context.png`), fullPage: false });
    const state = await page.evaluate(() => ({ phase: window.__main20.getState().phase, sceneId: window.__main20.data.scenes[window.__main20.getState().sceneIndex].id }));
    results.push({ viewport, choiceTexts, contextTexts, state, errors });
    await page.close();
  }
} finally {
  await browser.close();
}
const failures = results.flatMap((item) => [
  ...(item.errors || []).map((error) => `${item.viewport.name}: ${error}`),
  ...(item.choiceTexts || []).filter((text) => !/알림 ·/.test(text) || !/기록 ·/.test(text) || !/이동 ·/.test(text) || !/위험 ·/.test(text)).map(() => `${item.viewport.name}: choice direction not rendered`),
  ...(item.contextTexts || []).filter((text) => !/연속 문맥/.test(text)).map(() => `${item.viewport.name}: context range not rendered`)
]);
const report = { schemaVersion: 'V38-BROWSER-EVIDENCE-1', status: failures.length === 0, viewports: results, screenshots: results.flatMap((item) => [`artifacts/v38-browser/${item.viewport.name}-choice-direction.png`, `artifacts/v38-browser/${item.viewport.name}-contiguous-context.png`]), failures };
fs.mkdirSync('docs/v38', { recursive: true });
fs.writeFileSync('docs/v38/V38_BROWSER_EVIDENCE.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, screenshots: report.screenshots, failures }, null, 2));
if (!report.status) process.exit(1);
