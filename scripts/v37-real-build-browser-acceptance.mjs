import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const exhaustive = JSON.parse(fs.readFileSync('docs/v37/ENDING_SEMANTIC_EXHAUSTIVE.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const sceneIds = data.scenes.map((scene) => scene.id);
const patternFor = (route) => Object.fromEntries(route.map((pair, index) => [sceneIds[index], pair]));
const canonical = {
  UVAROV: { C03: [0, 0], C06: [0, 0], C07: [0, 0], E02: [1, 1], E07: [1, 1] },
  BELINSKY: { C03: [1, 1], C06: [1, 1], C07: [1, 1], E02: [0, 0], E07: [0, 0] },
  HERZEN: { C03: [2, 2], C06: [2, 2], C07: [2, 2], E02: [2, 2], E07: [2, 2] },
  KHOMYAKOV: { C03: [1, 1], C06: [1, 1], C07: [2, 2], E02: [1, 1], E07: [3, 3] },
  DOSTOEVSKY_PETRASHEVSKY: { C03: [2, 2], C06: [2, 2], C07: [1, 1], E02: [0, 2], E07: [0, 0] }
};
const examples = [
  { name: 'legacy-mismatch-named-three-way', pattern: patternFor(exhaustive.namedTieCheck.route), expected: 'KHOMYAKOV', viewport: { width: 1440, height: 900 } },
  ...exhaustive.legacyMismatchRoutes.slice(0, 2).map((row, index) => ({ name: `legacy-mismatch-${index + 2}`, pattern: patternFor(row.route), expected: row.setWise, viewport: { width: 390, height: 844 } })),
  { name: 'three-way-official-public-community', pattern: patternFor(exhaustive.tieSamples.support.route), expected: exhaustive.tieSamples.support.result, viewport: { width: 390, height: 844 } },
  { name: 'three-way-uvarov-herzen-dostoevsky', pattern: patternFor(exhaustive.tieSamples.relationship.route), expected: exhaustive.tieSamples.relationship.result, viewport: { width: 1440, height: 900 } }
];
const port = 4187;
const server = spawn(process.execPath, ['server.mjs'], { cwd: 'dist', env: { ...process.env, CHANCERY_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', (chunk) => serverErrors.push(String(chunk)));
const browser = await chromium.launch({ headless: true });
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const results = [];
async function play(name, pattern, expected, viewport, saveReload = false) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}/?main20=1#v37-${name}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20));
  for (let index = 0; index < data.scenes.length; index += 1) {
    while (await page.evaluate(() => window.__main20.getState().phase === 'intro')) await page.locator('#choiceArea button').first().click();
    const current = data.scenes[index];
    const pair = pattern[current.id];
    await page.locator('#choiceArea button').nth(pair[0]).click();
    await page.locator('#choiceArea button').first().click();
    await page.waitForFunction(() => window.__main20.getState().phase === 'reading');
    const excerpts = page.locator('.main20-excerpt');
    for (let item = 0; item < await excerpts.count(); item += 1) { const excerpt = excerpts.nth(item); await excerpt.scrollIntoViewIfNeeded(); await excerpt.locator('.main20-read-mark').click(); }
    if (saveReload && index === 2) {
      await page.locator('#saveBtn').click();
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('chancery-main20-v35')));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__main20));
      const after = await page.evaluate(() => window.__main20.getState());
      if (!before || after.sceneIndex !== before.sceneIndex || after.readExcerptIdsByScene.C07?.length !== before.readExcerptIdsByScene.C07?.length) throw new Error('save/reload state mismatch');
    }
    await page.locator('#choiceArea button').first().click();
    await page.locator('#choiceArea button').nth(pair[1]).click();
    await page.locator('#choiceArea button').first().click();
  }
  const state = await page.evaluate(() => window.__main20.getState());
  const matches = state.phase === 'ending' && state.endingId === expected;
  if (saveReload) await page.screenshot({ path: path.join(output, `${name}-save-reload-${viewport.width}.png`), fullPage: false });
  else await page.screenshot({ path: path.join(output, `${name}-${viewport.width}.png`), fullPage: false });
  results.push({ name, viewport, expected, actual: state.endingId, phase: state.phase, matches, saveReload, errors });
  await context.close();
}
try {
  for (const [ending, pattern] of Object.entries(canonical)) await play(`canonical-${ending}`, pattern, ending, { width: 1440, height: 900 }, ending === 'UVAROV');
  for (const example of examples) await play(example.name, example.pattern, example.expected, example.viewport);
} finally {
  await browser.close();
  server.kill();
}
const report = { schemaVersion: 'V37-REAL-BUILD-BROWSER-1', status: results.length === 10 && results.every((row) => row.matches && row.errors.length === 0) && serverErrors.length === 0, productionBuild: 'dist/', port, routeCount: results.length, results, serverErrors };
fs.mkdirSync('docs/v37', { recursive: true });
fs.writeFileSync('docs/v37/REAL_BUILD_BROWSER_ACCEPTANCE.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, routes: results.map(({ name, expected, actual, viewport, saveReload }) => ({ name, expected, actual, viewport, saveReload })), errors: results.flatMap((row) => row.errors), serverErrors }, null, 2));
if (!report.status) process.exit(1);
