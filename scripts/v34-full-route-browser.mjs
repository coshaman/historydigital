import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const patterns = {
  UVAROV: { custom: { C03: [0, 0], C06: [0, 0], C07: [0, 0], E02: [1, 1], E07: [1, 1] } },
  BELINSKY: { custom: { C03: [1, 1], C06: [1, 1], C07: [1, 1], E02: [0, 0], E07: [0, 0] } },
  HERZEN: { custom: { C03: [2, 2], C06: [2, 2], C07: [2, 2], E02: [2, 2], E07: [2, 2] } },
  KHOMYAKOV: { custom: { C03: [1, 1], C06: [1, 1], C07: [2, 2], E02: [1, 1], E07: [3, 3] } },
  DOSTOEVSKY_PETRASHEVSKY: { custom: { C03: [2, 2], C06: [2, 2], C07: [1, 1], E02: [0, 2], E07: [0, 0] } }
};
const selectedPatterns = process.env.V34_ONLY ? { [process.env.V34_ONLY]: patterns[process.env.V34_ONLY] } : patterns;
const out = path.join(process.cwd(), 'artifacts', 'v34', process.env.V34_RUN_ID || 'V34_20261004_FULL_BROWSER');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
async function route(viewport, name, pattern, saveLoad = false) {
  const context = await browser.newContext({ viewport }); const page = await context.newPage(); page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('http://127.0.0.1:4173/?main20=1#v34-route', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(window.__main20));
  const scenes = [];
  for (let index = 0; index < 5; index += 1) {
    while (await page.evaluate(() => window.__main20.getState().phase === 'intro')) await page.locator('#choiceArea button').first().click();
    const sceneId = await page.evaluate(() => window.__main20.data.scenes[window.__main20.getState().sceneIndex].id); const pair = pattern.custom[sceneId];
    await page.locator('#choiceArea button').nth(pair[0]).click(); await page.locator('#choiceArea button').first().click(); await page.waitForFunction(() => window.__main20.getState().phase === 'reading');
    if (['C07', 'E02', 'E07'].includes(sceneId)) await page.screenshot({ path: path.join(out, name + '-' + sceneId + '-reading-' + viewport.width + '.png') });
    const articles = page.locator('.main20-excerpt');
    for (let i = 0; i < await articles.count(); i += 1) { const article = articles.nth(i); await article.scrollIntoViewIfNeeded(); await article.locator('.main20-read-mark').click(); }
    const readState = await page.evaluate(() => { const state = window.__main20.getState(); const current = window.__main20.data.scenes[state.sceneIndex]; return { scene: current.id, ids: window.__main20.readIds(current.id), required: current.excerpts.length }; });
    if (saveLoad && index === 1) { await page.locator('#saveBtn').click(); const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chancery-main20-v34'))); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(window.__main20)); if (!saved || await page.evaluate(() => window.__main20.readIds('C06').length) !== saved.readExcerptIdsByScene.C06.length) throw new Error('V34 save/load mismatch'); }
    await page.locator('#choiceArea button').first().click(); await page.locator('#choiceArea button').nth(pair[1]).click(); await page.locator('#choiceArea button').first().click();
    scenes.push({ sceneId, readState }); if (index < 4) await page.waitForFunction(() => window.__main20.getState().phase === 'intro');
  }
  const ending = await page.evaluate(() => window.__main20.getState().endingId); const endingTitle = await page.locator('#endingTitle').textContent().catch(() => '');
  await page.screenshot({ path: path.join(out, name + '-ending-' + viewport.width + '.png') }); results.push({ name, viewport, ending, endingTitle, scenes, errors }); await context.close();
}
for (const [id, pattern] of Object.entries(selectedPatterns)) await route({ width: 1440, height: 900 }, 'ending-' + id, pattern);
if (!process.env.V34_ONLY) for (const width of [1440, 1366, 390, 360]) await route({ width, height: width === 1440 ? 900 : width === 1366 ? 768 : width === 390 ? 844 : 800 }, 'viewport-' + width, patterns.UVAROV, width === 1440);
await browser.close();
const report = { schemaVersion: 'V34-FULL-BROWSER-1', status: results.every((item) => item.errors.length === 0 && item.ending && item.scenes.length === 5 && item.scenes.every((scene) => scene.readState.ids.length === scene.readState.required)) ? 'PASS' : 'FAIL', runId: process.env.V34_RUN_ID || 'V34_20261004_FULL_BROWSER', results };
fs.mkdirSync('docs/v34', { recursive: true }); fs.writeFileSync('docs/v34/FULL_BROWSER_ROUTES.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, results: results.map(({ name, viewport, ending, endingTitle, errors }) => ({ name, viewport, ending, endingTitle, errors })) }, null, 2));
if (report.status !== 'PASS') process.exit(1);
