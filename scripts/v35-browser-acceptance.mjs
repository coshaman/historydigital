import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8')); const exhaustive = JSON.parse(fs.readFileSync('docs/v35/ENDING_EXHAUSTIVE.json', 'utf8'));
const canonical = {
  UVAROV: { C03:[0,0], C06:[0,0], C07:[0,0], E02:[1,1], E07:[1,1] },
  BELINSKY: { C03:[1,1], C06:[1,1], C07:[1,1], E02:[0,0], E07:[0,0] },
  HERZEN: { C03:[2,2], C06:[2,2], C07:[2,2], E02:[2,2], E07:[2,2] },
  KHOMYAKOV: { C03:[1,1], C06:[1,1], C07:[2,2], E02:[1,1], E07:[3,3] },
  DOSTOEVSKY_PETRASHEVSKY: { C03:[2,2], C06:[2,2], C07:[1,1], E02:[0,2], E07:[0,0] }
};
function rowToPattern(row) { const result = {}; for (const item of row) { const current = data.scenes.find((scene) => scene.id === item.sceneId); result[item.sceneId] = [current.choices.findIndex((choice) => choice.id === item.choiceIds[0]), current.postChoices.findIndex((choice) => choice.id === item.choiceIds[1])]; } return result; }
const mixed = Object.fromEntries(Object.entries(exhaustive.mixed).map(([id, rows]) => [id, rowToPattern(rows[0].row)]));
let seed = 35; const random = []; for (let i = 0; i < 10; i += 1) { const route = {}; for (const scene of data.scenes) { seed = (seed * 1664525 + 1013904223) >>> 0; const first = seed % scene.choices.length; seed = (seed * 1664525 + 1013904223) >>> 0; const post = seed % scene.postChoices.length; route[scene.id] = [first, post]; } random.push(route); }
const root = process.cwd(); const out = path.join(root, 'artifacts', 'v35', 'BROWSER_ACCEPTANCE'); fs.mkdirSync(out, { recursive: true }); const browser = await chromium.launch({ headless: true }); const results = []; const memoryEvidence = [];
async function play(name, pattern, viewport, saveLoad = false) {
  const context = await browser.newContext({ viewport }); const page = await context.newPage(); page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto('http://127.0.0.1:4173/?main20=1#v35-' + name, { waitUntil: 'domcontentloaded' }); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(window.__main20));
  const scenes = []; const renderedMemory = []; const seenMemoryScenes = new Set();
  for (let index = 0; index < data.scenes.length; index += 1) {
    while (await page.evaluate(() => window.__main20.getState().phase === 'intro')) {
      const mem = await page.evaluate(() => window.__main20.renderedMemory()); const introSceneId = await page.evaluate(() => window.__main20.data.scenes[window.__main20.getState().sceneIndex].id); if (mem.length && !seenMemoryScenes.has(introSceneId)) { const shot = name + '-' + introSceneId + '-memory-' + viewport.width + '.png'; await page.screenshot({ path: path.join(out, shot) }); renderedMemory.push({ name, sceneId: introSceneId, viewport, rendered: mem, screenshot: shot }); seenMemoryScenes.add(introSceneId); } await page.locator('#choiceArea button').first().click();
    }
    const sceneId = await page.evaluate(() => window.__main20.data.scenes[window.__main20.getState().sceneIndex].id); const pair = pattern[sceneId];
    await page.locator('#choiceArea button').nth(pair[0]).click(); await page.locator('#choiceArea button').first().click(); await page.waitForFunction(() => window.__main20.getState().phase === 'reading');
    if (['C07', 'E02', 'E07'].includes(sceneId)) await page.screenshot({ path: path.join(out, name + '-' + sceneId + '-reading-' + viewport.width + '.png') });
    const articles = page.locator('.main20-excerpt'); for (let i = 0; i < await articles.count(); i += 1) { const article = articles.nth(i); await article.scrollIntoViewIfNeeded(); await article.locator('.main20-read-mark').click(); }
    const readState = await page.evaluate(() => { const state = window.__main20.getState(); const current = window.__main20.data.scenes[state.sceneIndex]; return { sceneId: current.id, ids: window.__main20.readIds(current.id), required: current.excerpts.length }; });
    if (saveLoad && index === 2) { await page.locator('#saveBtn').click(); const before = await page.evaluate(() => JSON.parse(localStorage.getItem('chancery-main20-v35'))); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(window.__main20)); const after = await page.evaluate(() => window.__main20.getState()); if (!before || after.sceneIndex !== before.sceneIndex || after.readExcerptIdsByScene.C07?.length !== before.readExcerptIdsByScene.C07?.length) throw new Error('save/reload mismatch'); }
    await page.locator('#choiceArea button').first().click(); await page.locator('#choiceArea button').nth(pair[1]).click(); await page.locator('#choiceArea button').first().click(); scenes.push({ sceneId, readState }); if (index < data.scenes.length - 1) await page.waitForFunction(() => window.__main20.getState().phase === 'intro');
  }
  const finalState = await page.evaluate(() => window.__main20.getState()); if (finalState.phase !== 'ending' || !finalState.endingId) throw new Error(name + ' did not reach ending; phase=' + finalState.phase);
  await page.screenshot({ path: path.join(out, name + '-ending-' + viewport.width + '.png') }); results.push({ name, viewport, ending: finalState.endingId, phase: finalState.phase, scenes, renderedMemory, errors }); await context.close();
}
for (const [id, pattern] of Object.entries(canonical)) await play('canonical-' + id, pattern, { width: 1440, height: 900 }, results.length < 3);
for (const [id, pattern] of Object.entries(mixed)) await play('mixed-' + id, pattern, { width: 390, height: 844 });
for (let i = 0; i < random.length; i += 1) await play('random-' + String(i + 1).padStart(2, '0'), random[i], i % 2 ? { width: 390, height: 844 } : { width: 1440, height: 900 });
await browser.close();
const memoryReport = { schemaVersion: 'V35-RENDERED-MEMORY-EVIDENCE-1', status: [...new Set(results.flatMap((item) => item.renderedMemory).flatMap((item) => item.rendered.map((entry) => entry.character)))].length >= 3 ? 'PASS' : 'FAIL', evidence: results.flatMap((item) => item.renderedMemory) };
const report = { schemaVersion: 'V35-BROWSER-ACCEPTANCE-1', status: results.length === 20 && results.every((item) => item.phase === 'ending' && item.ending && item.errors.length === 0 && item.scenes.length === 5), routeCount: results.length, results, canonical, mixed, random };
fs.mkdirSync('docs/v35', { recursive: true }); fs.writeFileSync('docs/v35/RENDERED_MEMORY_EVIDENCE.json', JSON.stringify(memoryReport, null, 2) + '\n'); fs.writeFileSync('docs/v35/BROWSER_ACCEPTANCE.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ status: report.status, routeCount: report.routeCount, endings: results.map((item) => [item.name, item.ending]), memoryEvidence: memoryReport.evidence.length, errors: results.flatMap((item) => item.errors) }, null, 2)); if (!report.status || memoryReport.status !== 'PASS') process.exit(1);
