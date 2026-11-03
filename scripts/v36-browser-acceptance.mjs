import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const sourceData = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const e04Scene = JSON.parse(fs.readFileSync('narrative/E04_SCENE.json', 'utf8'));
const exhaustive = JSON.parse(fs.readFileSync('docs/v36/ENDING_SEMANTIC_EXHAUSTIVE.json', 'utf8'));
const data = { ...sourceData, scenes: exhaustive.sceneIds.map(id => id === 'E04' ? e04Scene : sourceData.scenes.find(scene => scene.id === id)) };
function routeToPattern(route) { const result = {}; route.forEach((pair, index) => { result[data.scenes[index].id] = pair; }); return result; }
const canonical = Object.fromEntries(Object.entries(exhaustive.canonicalRoutes).map(([id, route]) => [id, routeToPattern(route)]));
const mixed = Object.fromEntries(Object.entries(exhaustive.mixed).map(([id, rows]) => [id, routeToPattern(rows[0].route)]));
const tieRoutes = Object.entries(exhaustive.tieSamples).flatMap(([reason, rows]) => rows.slice(0, 2).map((row, index) => ({ name: `tie-${reason}-${index + 1}`, pattern: routeToPattern(row.route), reason })));
let seed = 35; const random = []; for (let i = 0; i < 10; i += 1) { const route = {}; for (const scene of data.scenes) { seed = (seed * 1664525 + 1013904223) >>> 0; const first = seed % scene.choices.length; seed = (seed * 1664525 + 1013904223) >>> 0; const post = seed % scene.postChoices.length; route[scene.id] = [first, post]; } random.push(route); }
const root = process.cwd(); const out = path.join(root, 'artifacts', 'v36', 'BROWSER_ACCEPTANCE'); fs.mkdirSync(out, { recursive: true }); const browser = await chromium.launch({ headless: true }); const results = []; const memoryEvidence = []; const dialogueEvidence = [];
const baseUrl = process.env.CHANCERY_BASE_URL || 'http://127.0.0.1:4173';
async function play(name, pattern, viewport, saveLoad = false) {
  const context = await browser.newContext({ viewport }); const page = await context.newPage(); page.setDefaultTimeout(20000); const errors = []; page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(baseUrl + '/chancery.html?main20=1#v36-' + name, { waitUntil: 'domcontentloaded' }); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(window.__main20));
  const scenes = []; const renderedMemory = []; const seenMemoryScenes = new Set(); const savedSceneIds = new Set();
  for (let step = 0; step < 1200; step += 1) {
    const state = await page.evaluate(() => window.__main20.getState()); if (state.phase === 'ending') break;
    const sceneId = await page.evaluate(() => window.__main20.data.scenes[window.__main20.getState().sceneIndex].id); const phase = state.phase;
    if (step % 25 === 0) console.log('route-progress', name, step, sceneId, phase);
    const mem = await page.evaluate(() => window.__main20.renderedMemory()); if (mem.length && !seenMemoryScenes.has(sceneId)) { const shot = name + '-' + sceneId + '-memory-' + viewport.width + '.png'; await page.screenshot({ path: path.join(out, shot) }); renderedMemory.push({ name, sceneId, viewport, rendered: mem, screenshot: shot }); seenMemoryScenes.add(sceneId); }
    if (phase === 'decision') {
      if (savedSceneIds.has(sceneId)) throw new Error(`${name}/${sceneId}: duplicate decision loop`);
      savedSceneIds.add(sceneId); const pair = pattern[sceneId]; if (!pair) throw new Error(`${name}: no route choice for ${sceneId}`);
      if (['C07', 'E02', 'E04', 'E07'].includes(sceneId)) await page.screenshot({ path: path.join(out, name + '-' + sceneId + '-decision-' + viewport.width + '.png') });
      await page.locator('#choiceArea button').nth(pair[0]).click();
      if (sceneId === 'C07') { await page.screenshot({ path: path.join(out, name + '-C07-reaction-' + viewport.width + '.png') }); dialogueEvidence.push({ name, sceneId, kind: 'C07-reaction', speaker: await page.locator('#speaker').textContent(), dialogue: await page.locator('#dialogue').textContent(), sequence: await page.locator('.main20-reaction-sequence').textContent().catch(() => '') }); }
      continue;
    }
    if (phase === 'post_choice') { const pair = pattern[sceneId]; await page.locator('#choiceArea button').nth(pair[1]).click(); continue; }
    if (phase === 'reading') {
      const articles = page.locator('.main20-excerpt'); const count = await articles.count();
      for (let i = 0; i < count; i += 1) { const article = articles.nth(i); await article.scrollIntoViewIfNeeded(); const mark = article.locator('.main20-read-mark'); if (await mark.isEnabled()) await mark.click(); await page.waitForFunction(({ id, index }) => window.__main20.readIds(id).length > index, { id: sceneId, index: i }); }
      const readState = await page.evaluate((id) => ({ sceneId: id, ids: window.__main20.readIds(id), required: window.__main20.data.scenes.find((item) => item.id === id).excerpts.length }), sceneId);
      if (saveLoad && sceneId === 'C07' && !savedSceneIds.has('SAVE')) { await page.locator('#saveBtn').click(); const before = await page.evaluate(() => JSON.parse(localStorage.getItem('chancery-main20-v35'))); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(window.__main20)); const after = await page.evaluate(() => window.__main20.getState()); if (!before || after.sceneIndex !== before.sceneIndex || after.readExcerptIdsByScene.C07?.length !== before.readExcerptIdsByScene.C07?.length) throw new Error('save/reload mismatch'); savedSceneIds.add('SAVE'); }
      if (!scenes.some((item) => item.sceneId === sceneId)) scenes.push({ sceneId, readState });
      if (['C07', 'E02', 'E04', 'E07'].includes(sceneId)) await page.screenshot({ path: path.join(out, name + '-' + sceneId + '-reading-' + viewport.width + '.png') });
      const next = page.locator('#choiceArea button').first(); await page.waitForFunction(() => { const button = document.querySelector('#choiceArea button'); return button && !button.disabled; }); await next.click(); continue;
    }
    if (phase === 'branch_hub') { const read = page.locator('.main20-ideology-read'); if (await read.count() && await read.isVisible()) { await read.click(); continue; } }
    if (phase === 'exam_questions') { const selected = page.locator('.main20-exam-option[aria-pressed="true"]'); if (await selected.count()) await page.locator('#choiceArea button:not(.main20-exam-option)').last().click(); else await page.locator('.main20-exam-option').first().click(); continue; }
    if (phase === 'onboarding') { await page.locator('#choiceArea button').first().click(); continue; }
    if (phase === 'ideology_prologue' || phase === 'c07_ideology') { const read = page.locator('.main20-ideology-read'); const buttons = page.locator('#choiceArea button'); if (await buttons.count() && await buttons.first().isVisible()) await buttons.first().click(); else { await read.waitFor({ state: 'visible' }); await read.click(); } continue; }
    if (phase === 'branch_hub' || phase === 'branch_event' || phase === 'branch_callback' || phase === 'circle_learning' || phase === 'exam_prep' || phase === 'exam_questions' || phase === 'exam_result' || phase === 'intro' || phase === 'source_discussion' || phase === 'reaction' || phase === 'final_reaction' || phase === 'exam_result') {
      const buttons = page.locator('#choiceArea button:not([disabled])'); await buttons.first().waitFor({ state: 'visible', timeout: 10000 }); await buttons.first().click(); continue;
    }
    throw new Error(`${name}: unsupported phase ${phase} at ${sceneId}`);
  }
  const finalState = await page.evaluate(() => window.__main20.getState()); if (finalState.phase !== 'ending' || !finalState.endingId) throw new Error(name + ' did not reach ending; phase=' + finalState.phase);
  await page.screenshot({ path: path.join(out, name + '-ending-' + viewport.width + '.png') }); results.push({ name, viewport, ending: finalState.endingId, phase: finalState.phase, scenes, renderedMemory, errors }); await context.close();
}
const plannedRoutes = [
  ...Object.entries(canonical).map(([id, pattern]) => ({ name: 'canonical-' + id, pattern, viewport: { width: 1440, height: 900 }, saveLoad: true })),
  ...Object.entries(mixed).map(([id, pattern]) => ({ name: 'mixed-' + id, pattern, viewport: { width: 390, height: 844 } })),
  ...tieRoutes.map((item) => ({ ...item, viewport: { width: 390, height: 844 } })),
  ...random.map((pattern, i) => ({ name: 'random-' + String(i + 1).padStart(2, '0'), pattern, viewport: i % 2 ? { width: 390, height: 844 } : { width: 1440, height: 900 } }))
].slice(0, Number(process.env.V36_ACCEPTANCE_LIMIT || 28));
for (const route of plannedRoutes) { await play(route.name, route.pattern, route.viewport, route.saveLoad); console.log('accepted', results.length, route.name); }
await browser.close();
const memorySpeakers = [...new Set(results.flatMap((item) => item.renderedMemory).flatMap((item) => item.rendered.map((entry) => entry.character)))].sort();
const memoryReport = { schemaVersion: 'V36-RENDERED-MEMORY-EVIDENCE-1', status: memorySpeakers.length >= 3 ? 'PASS' : 'FAIL', distinctSpeakers: memorySpeakers, evidence: results.flatMap((item) => item.renderedMemory) };
const endingsReached = [...new Set(results.map((item) => item.ending))].sort();
const allFiveEndingsReached = ['BELINSKY', 'DOSTOEVSKY_PETRASHEVSKY', 'HERZEN', 'KHOMYAKOV', 'UVAROV'].every((ending) => endingsReached.includes(ending));
const report = { schemaVersion: 'V36-BROWSER-ACCEPTANCE-4', status: results.length === plannedRoutes.length && plannedRoutes.length > 0 && results.every((item) => item.phase === 'ending' && item.ending && item.errors.length === 0 && item.scenes.length === data.scenes.length) && (plannedRoutes.length !== 28 || allFiveEndingsReached), coverageKind: plannedRoutes.length === 28 ? 'FULL' : 'SMOKE', routeCount: results.length, plannedRouteCount: plannedRoutes.length, endingsReached, allFiveEndingsReached, results, canonical, mixed, tieRoutes, random, dialogueEvidence };
fs.mkdirSync('docs/v36', { recursive: true }); fs.writeFileSync('docs/v36/RENDERED_MEMORY_EVIDENCE.json', JSON.stringify(memoryReport, null, 2) + '\n'); fs.writeFileSync('docs/v36/BROWSER_ACCEPTANCE.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ status: report.status, routeCount: report.routeCount, endings: results.map((item) => [item.name, item.ending]), memoryEvidence: memoryReport.evidence.length, errors: results.flatMap((item) => item.errors) }, null, 2)); if (!report.status || memoryReport.status !== 'PASS') process.exit(1);

