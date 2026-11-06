import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const exhaustive = JSON.parse(fs.readFileSync('docs/v37/ENDING_SEMANTIC_EXHAUSTIVE.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const mainSceneIds = data.v44MainSceneIds ?? data.scenes.map((scene) => scene.id);
data.scenes = data.scenes.filter((scene) => mainSceneIds.includes(scene.id));
const e04 = JSON.parse(fs.readFileSync('narrative/E04_SCENE.json', 'utf8'));
if (!data.scenes.some((scene) => scene.id === 'E04')) {
  const e07Index = data.scenes.findIndex((scene) => scene.id === 'E07');
  data.scenes.splice(e07Index < 0 ? data.scenes.length : e07Index, 0, e04);
}
const sceneIds = data.scenes.map((scene) => scene.id);
if (!exhaustive.status || JSON.stringify(exhaustive.sceneIds) !== JSON.stringify(sceneIds)) throw new Error('Ending route report does not match the active runtime scenes');
const patternFor = (route) => Object.fromEntries(route.map((pair, index) => [sceneIds[index], pair]));
const canonical = Object.fromEntries(Object.entries(exhaustive.representativeRoutes).map(([id, route]) => [id, patternFor(route)]));
const examples = [
  ...exhaustive.legacyMismatchRoutes.slice(0, 2).map((row, index) => ({ name: `setwise-resolution-${index + 1}`, pattern: patternFor(row.route), expected: row.expected, viewport: { width: 390, height: 844 } })),
  ...[exhaustive.tieSamples.first, exhaustive.tieSamples.threeWay].filter(Boolean).map((row, index) => ({ name: index ? 'three-way-resolution' : 'tie-resolution', pattern: patternFor(row.route), expected: row.result, viewport: { width: index ? 1440 : 390, height: index ? 900 : 844 } }))
];
const port = 4187;
const staticOutput = path.resolve('dist-v33');
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env, CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: staticOutput }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', (chunk) => serverErrors.push(String(chunk)));
const readyDeadline = Date.now() + 10_000;
let serverReady = false;
while (Date.now() < readyDeadline && !serverReady) {
  try { serverReady = (await fetch(`http://127.0.0.1:${port}/`)).ok; }
  catch { await new Promise(resolve => setTimeout(resolve, 100)); }
}
if (!serverReady) { server.kill(); throw new Error(`Production preview did not become ready: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const results = [];
async function play(name, pattern, expected, viewport, saveReload = false) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}/chancery.html?main20=1#v37-${name}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20));
  const prepared = await page.evaluate(({ routeByScene, expectedEnding }) => {
    const data = window.__main20.data, state = window.__main20.getState();
    const history = [], flags = [], relationships = { alexei: 0, ekaterina: 0, pavel: 0 }, actions = [];
    for (const scene of data.scenes) for (const [kind, index] of [['pre_read_choice', routeByScene[scene.id][0]], ['post_read_choice', routeByScene[scene.id][1]]]) {
      const choice = kind === 'pre_read_choice' ? scene.choices[index] : scene.postChoices[index];
      if (!choice) throw new Error(`Choice not found for ${scene.id}/${kind}/${index}`);
      history.push({ sceneId: scene.id, kind, action: choice.action, flags: choice.flagsAdd || [], endingAffinity: choice.endingAffinity || {} });
      flags.push(...(choice.flagsAdd || [])); actions.push(choice.action);
      for (const [person, value] of Object.entries(choice.relationship || {})) relationships[person] = (relationships[person] || 0) + value;
    }
    const source = { history, flags: [...new Set(flags)], relationships };
    const resolution = window.__main20.resolveEndingDetailedFor(source);
    if (resolution?.endingId !== expectedEnding) throw new Error(`Representative route resolved to ${resolution?.endingId}, expected ${expectedEnding}`);
    Object.assign(state, { phase: 'ending', onboardingComplete: true, sceneIndex: data.scenes.length - 1, history, flags: source.flags, relationships, actions, endingId: resolution.endingId, endingResolution: resolution });
    localStorage.setItem('chancery-main20-v35', JSON.stringify(state));
    return { endingId: resolution.endingId, sceneCount: data.scenes.length };
  }, { routeByScene: pattern, expectedEnding: expected });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20) && window.__main20.getState().phase === 'ending');
  const actualTitle = await page.locator('#endingTitle').textContent();
  const visibleEndingId = await page.evaluate(() => window.__main20.getState().endingId);
  const visiblePhase = await page.evaluate(() => window.__main20.getState().phase);
  const expectedTitle = await page.evaluate((endingId) => window.__main20.data.endings.find((ending) => ending.id === endingId)?.title || null, expected);
  const viewportAudit = await page.evaluate(() => {
    const card = document.querySelector('.ending-card');
    return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.clientHeight,
      cardClientHeight: card?.clientHeight || 0, cardScrollHeight: card?.scrollHeight || 0, cardOverflowY: card ? getComputedStyle(card).overflowY : 'missing' };
  });
  const matches = actualTitle === expectedTitle && visibleEndingId === expected && visiblePhase === 'ending' && viewportAudit.scrollWidth <= viewportAudit.width + 1;
  await page.screenshot({ path: path.join(output, `${name}-${viewport.width}.png`), fullPage: false });
  let restartWorks = null;
  if (saveReload || viewport.width < 600) {
    await page.locator('#restart').scrollIntoViewIfNeeded();
    await page.locator('#restart').click();
    restartWorks = await page.evaluate(() => window.__main20.getState().phase === 'onboarding');
    if (!restartWorks) throw new Error('Ending restart control did not return to onboarding');
  }
  results.push({ name, viewport, expected, actual: visibleEndingId, title: actualTitle, phase: visiblePhase, matches, saveReload, restartWorks, sceneCount: prepared.sceneCount, viewportAudit, errors });
  await context.close();
}
try {
  for (const [ending, pattern] of Object.entries(canonical)) await play(`representative-${ending}`, pattern, ending, { width: 1440, height: 900 }, ending === 'UVAROV');
  for (const example of examples) await play(example.name, example.pattern, example.expected, example.viewport);
} finally {
  await browser.close();
  server.kill();
}
const report = { schemaVersion: 'V37-REAL-BUILD-BROWSER-3', status: Object.keys(canonical).length === 5 && results.length === Object.keys(canonical).length + examples.length && results.every((row) => row.matches && row.errors.length === 0 && (!(row.saveReload || row.viewport.width < 600) || row.restartWorks)) && serverErrors.length === 0, productionBuild: 'dist-v33/', method: 'Representative choice histories are resolved by the runtime, persisted, and rendered in the deployed static artifact; this validates ending presentation, reload, restart, and viewport behavior, not full manual-route playthrough.', port, routeCount: results.length, results, serverErrors };
fs.mkdirSync('docs/v37', { recursive: true });
fs.writeFileSync('docs/v37/REAL_BUILD_BROWSER_ACCEPTANCE.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, routes: results.map(({ name, expected, actual, viewport, saveReload }) => ({ name, expected, actual, viewport, saveReload })), errors: results.flatMap((row) => row.errors), serverErrors }, null, 2));
if (!report.status) process.exit(1);
