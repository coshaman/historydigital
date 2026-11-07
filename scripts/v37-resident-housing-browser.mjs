import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const maps = Object.fromEntries(fs.readdirSync('rpg/maps').filter(file => file.endsWith('.json'))
  .map(file => { const map = readJson(path.join('rpg/maps', file)); return [map.mapId, map]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => readJson(path.join('rpg/characters', file)));
const fixtures = [
  { id: 'street_vendor_matryona', displayName: '마트료나', label: 'homeless', viewport: { width: 390, height: 844 }, expected: '정해진 방 없음' },
  { id: 'porter_gavrila', displayName: '가브릴라', label: 'rented-room', viewport: { width: 1440, height: 900 }, expected: '허구의 공동주택 셋방' },
  { id: 'lodging_tatyana', displayName: '타티야나', label: 'aunt-niece-household-mobile', viewport: { width: 390, height: 844 }, expected: '허구의 안뜰 셋방' },
  { id: 'teacher_lyubov', displayName: '류보프', label: 'aunt-niece-household-desktop', viewport: { width: 1440, height: 900 }, expected: '허구의 안뜰 셋방' },
];
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4192, staticRoot = path.resolve('dist-v33');
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: staticRoot }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
const deadline = Date.now() + 10000;
let ready = false;
while (Date.now() < deadline && !ready) {
  try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; }
  catch { await new Promise(resolve => setTimeout(resolve, 100)); }
}
if (!ready) { server.kill(); throw new Error(`Housing browser preview did not start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const fixture of fixtures) {
    const context = await browser.newContext({ viewport: fixture.viewport, isMobile: fixture.viewport.width < 600, hasTouch: fixture.viewport.width < 600 });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
    state.world.currentMapId = state.hosts[fixture.id].mapId;
    state.player.position = { ...state.hosts[fixture.id].position };
    const possessed = game.possessHost(state, fixture.id, maps[state.world.currentMapId]);
    if (!possessed.ok) throw new Error(`${fixture.id}: possession fixture failed: ${possessed.reason}`);
    await context.addInitScript(saved => {
      if (!localStorage.getItem('v33-rpg-save')) localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v33-rpg-tutorial-stage', 'done');
    }, game.saveGame(possessed.state));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-housing-${fixture.label}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(name => document.querySelector('#bodyname')?.textContent?.includes(name), fixture.displayName);
    await page.keyboard.press('j');
    await page.locator('[data-journal-tab="people"]').click();
    const audit = await page.evaluate(() => ({
      viewport: { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
      journalOpen: document.querySelector('#quest-journal')?.open ?? false,
      rows: document.querySelector('#journal-relations')?.innerText ?? '',
    }));
    if (!audit.journalOpen || !audit.rows.includes(fixture.expected)
      || audit.viewport.scrollWidth > audit.viewport.width + 1 || pageErrors.length || serverErrors.length) {
      throw new Error(`Resident housing UI failed: ${JSON.stringify({ resident: fixture.id, audit, pageErrors, serverErrors })}`);
    }
    await page.screenshot({ path: path.join(output, `resident-housing-${fixture.label}-${fixture.viewport.width}x${fixture.viewport.height}.png`) });
    results.push({ resident: fixture.id, viewport: audit.viewport, journalOpen: true, expectedResidenceVisible: fixture.expected,
      residenceText: audit.rows.split('\n').find(row => row.includes(fixture.expected)), pageErrors });
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const report = { status: 'PASS', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'RESIDENT_HOUSING_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
