import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/?main20=1#v32-reset';
const runId = `V32_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const out = `artifacts/v32/${runId}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const endingPatterns = {
  DOSTOEVSKY_PETRASHEVSKY: { first: 0, post: 0, custom: { C07:{first:1,post:0}, E02:{first:0,post:0}, E07:{first:0,post:0} } },
  HERZEN: { first: 1, post: 1, custom: { C07:{first:0,post:0}, E02:{first:0,post:1}, E07:{first:1,post:1} } },
  BELINSKY: { first: 2, post: 2, custom: { C07:{first:1,post:0}, E02:{first:0,post:2}, E07:{first:2,post:2} } },
  KHOMYAKOV: { first: 0, post: 0, custom: { E02:{first:0,post:1}, E07:{first:0,post:1} } },
  UVAROV: { first: 0, post: 0, custom: { C06:{first:0,post:1}, E02:{first:2,post:0}, E07:{first:2,post:1} } }
};

async function contextPage(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(window.__main20));
  return { context, page, errors };
}
async function advanceIntro(page) { for (let i = 0; i < 10 && await page.evaluate(() => window.__main20.getState().phase === 'intro'); i += 1) await page.locator('#choiceArea button').first().click(); }
async function visibleImageIssues(page) {
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete), { timeout: 2000 }).catch(() => {});
  return page.evaluate(() => Array.from(document.images).filter((image) => !image.parentElement?.hidden && getComputedStyle(image).display !== 'none' && (!image.complete || image.naturalWidth === 0)).map((image) => image.getAttribute('src') || image.alt));
}
async function assertTargets(page) { return page.evaluate(() => Array.from(document.querySelectorAll('button')).filter((button) => !button.disabled && button.offsetParent).map((button) => button.getBoundingClientRect()).filter((box) => box.width < 36 || box.height < 32).map((box) => ({ width: box.width, height: box.height }))); }
async function playScene(page, sceneId, firstIndex, postIndex, options = {}) {
  console.log(`SCENE ${sceneId} start`);
  await advanceIntro(page); const stateAtChoice = await page.evaluate(() => window.__main20.getState());
  if (stateAtChoice.phase !== 'choice') throw new Error(`${sceneId}: intro did not reach choice`);
  await page.locator('#choiceArea button').nth(firstIndex).click(); await page.locator('#choiceArea button').first().click(); await page.waitForFunction(() => window.__main20.getState().phase === 'reading'); await page.screenshot({ path: `${out}/${sceneId}-reading-${page.viewportSize().width}x${page.viewportSize().height}.png` });
  const before = await page.evaluate(() => ({ scene: window.__main20.getState().sceneIndex, ids: window.__main20.readIds(window.__main20.data.scenes[window.__main20.getState().sceneIndex].id), scroll: document.querySelector('#paperColumns')?.scrollTop || 0 }));
  if (options.checkIsolation && before.ids.length !== 0) throw new Error(`${sceneId}: new scene read state was not empty`);
  const columns = page.locator('#paperColumns'); await columns.evaluate((node) => { node.scrollTop = Math.floor(node.scrollHeight / 2); }); const scrollBeforeWindow = await columns.evaluate((node) => node.scrollTop);
  await page.locator('#petersburgWindow').click(); await page.waitForFunction(() => document.body.classList.contains('window-view')); await page.screenshot({ path: `${out}/${sceneId}-window-${page.viewportSize().width}x${page.viewportSize().height}.png` }); const open = await page.evaluate(() => ({ inert: document.querySelector('#paper')?.inert === true, choicesInert: document.querySelector('#choiceArea')?.inert === true, box: document.querySelector('#petersburgWindow')?.getBoundingClientRect().toJSON() }));
  await page.locator('#petersburgWindow').click(); await page.waitForFunction(() => !document.body.classList.contains('window-view')); await page.screenshot({ path: `${out}/${sceneId}-return-${page.viewportSize().width}x${page.viewportSize().height}.png` }); const scrollAfterWindow = await columns.evaluate((node) => node.scrollTop);
  let readClicks = 0; while (await page.locator('.main20-read-mark:not(:disabled)').count()) { await page.locator('.main20-read-mark:not(:disabled)').first().click(); readClicks += 1; }
  const readState = await page.evaluate(() => { const s = window.__main20.getState(); const current = window.__main20.data.scenes[s.sceneIndex]; return { ids: window.__main20.readIds(current.id), required: current.excerpts.length, events: s.readEventsByScene[current.id]?.length || 0 }; }); await page.screenshot({ path: `${out}/${sceneId}-post-reading-${page.viewportSize().width}x${page.viewportSize().height}.png` });
  if (readState.ids.length !== readState.required || readState.events !== readState.required) throw new Error(`${sceneId}: reading did not require every excerpt`);
  await page.locator('#choiceArea button').filter({ hasText: '읽은 대목을 바탕으로' }).click(); await page.locator('#choiceArea button').nth(postIndex).click();
  const after = await page.evaluate(() => window.__main20.getState()); const images = await visibleImageIssues(page); const smallTargets = await assertTargets(page);
  console.log(`SCENE ${sceneId} done reads=${readClicks}`); return { sceneId, firstIndex, postIndex, initialState: stateAtChoice, newSceneReadIds: before.ids, readClicks, readState, window: open, scrollBeforeWindow, scrollAfterWindow, images, smallTargets, afterPhase: after.phase };
}
async function playRoute(viewport, pattern, name, options = {}) {
  console.log(`ROUTE ${name} ${viewport.width} start`);
  const { context, page, errors } = await contextPage(viewport); const scenes = []; let saveLoad = null; await page.screenshot({ path: `${out}/${name}-start-${viewport.width}x${viewport.height}.png` });
  for (let index = 0; index < 5; index += 1) { const sceneId = await page.evaluate(() => window.__main20.data.scenes[window.__main20.getState().sceneIndex].id); const selected = pattern.custom?.[sceneId] || pattern; scenes.push(await playScene(page, sceneId, selected.first, selected.post, { checkIsolation: index > 0 })); if (index === 0 && options.saveLoad) { await page.locator('#saveBtn').click(); const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chancery-main20-v32'))); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(window.__main20)); saveLoad = await page.evaluate(() => ({ phase: window.__main20.getState().phase, readIds: window.__main20.readIds('C03'), savedIds: JSON.parse(localStorage.getItem('chancery-main20-v32')).readExcerptIdsByScene.C03 })); if (!saved || saveLoad.readIds.length !== saveLoad.savedIds.length) throw new Error('save/load read state mismatch'); } if (index < 4) await page.locator('#choiceArea button').first().click(); }
  await page.locator('#choiceArea button').first().click(); await page.waitForFunction(() => window.__main20.getState().phase === 'ending'); const endingId = await page.evaluate(() => window.__main20.getState().endingId); await page.screenshot({ path: `${out}/ending-${name}-${viewport.width}x${viewport.height}.png` }); results.push({ name, viewport, endingId, scenes, saveLoad, errors }); console.log(`ROUTE ${name} done ending=${endingId}`); return endingId;
}

try {
  const viewportSet = [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]; const onlyViewport = Number(process.env.V32_VIEWPORT || 0); const selectedViewports = onlyViewport ? viewportSet.filter((viewport) => viewport.width === onlyViewport) : viewportSet; if (process.env.V32_SKIP_VIEWPORT !== '1') for (const viewport of selectedViewports) { await playRoute(viewport, endingPatterns.UVAROV, `viewport-${viewport.width}`, { saveLoad: viewport.width === 1440 }); }
  const endingResults = {}; const onlyEnding = process.env.V32_ENDING || ''; const selectedEndings = process.env.V32_SKIP_ENDINGS === '1' ? [] : onlyEnding ? Object.entries(endingPatterns).filter(([name]) => name === onlyEnding) : Object.entries(endingPatterns); for (const [name, pattern] of selectedEndings) endingResults[name] = await playRoute({ width: 1440, height: 900 }, pattern, `ending-${name}`);
  const routePass = results.every((item) => item.errors.length === 0 && item.scenes.length === 5 && item.scenes.every((scene) => scene.readState.ids.length === scene.readState.required && scene.newSceneReadIds.length === 0 && scene.window.inert && scene.window.choicesInert && scene.scrollAfterWindow >= scene.scrollBeforeWindow - 2 && scene.images.length === 0 && scene.smallTargets.length === 0));
  const report = { schemaVersion: 'V32-BROWSER-ACCEPTANCE-1', runId, sourceSha256: crypto.createHash('sha256').update(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json')).digest('hex'), status: routePass ? 'PASS' : 'FAIL', results, endingResults, checkedAt: new Date().toISOString() };
  fs.writeFileSync(`${out}/V32_BROWSER_ACCEPTANCE.json`, JSON.stringify(report, null, 2) + '\n'); fs.mkdirSync('docs/v32', { recursive: true }); fs.writeFileSync('docs/v32/V32_BROWSER_ACCEPTANCE.json', JSON.stringify(report, null, 2) + '\n'); fs.writeFileSync('docs/v32/SCENE_READ_ISOLATION.json', JSON.stringify({ schemaVersion: 'V32-READ-ISOLATION-1', status: report.status, assertions: results.flatMap((route) => route.scenes.map((scene) => ({ viewport: route.viewport, sceneId: scene.sceneId, firstEntryReadIds: scene.newSceneReadIds, eventCount: scene.readState.events }))) }, null, 2) + '\n'); fs.writeFileSync('docs/v32/FIVE_ENDING_BROWSER_ROUTES.json', JSON.stringify({ schemaVersion: 'V32-ENDINGS-1', status: Object.values(endingResults).length === 5 && Object.values(endingResults).every(Boolean) ? 'PASS' : process.env.V32_SKIP_ENDINGS === '1' ? 'NOT_RUN' : 'FAIL', endingResults }, null, 2) + '\n'); console.log(JSON.stringify({ status: report.status, runId, viewports: results.length, endingResults }, null, 2)); if (report.status !== 'PASS') process.exit(1);
} finally { await browser.close(); }
