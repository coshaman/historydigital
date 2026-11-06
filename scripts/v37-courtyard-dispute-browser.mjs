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
const quest = readJson('rpg/quests/courtyard-dispute-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4195, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`Courtyard preview failed to start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const interaction = maps.courtyard.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === quest.entry.objectId);
    const start = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'courtyard' });
    start.world.chapterId = 'V33_1847_PRINT';
    start.world.date = '1847-06-01';
    start.hosts.tenant_mikhail.money.amount = 0;
    start.hosts.carter_roman.money.amount = 0;
    let triggered = game.advanceNpcWorld(start, 840, maps);
    if (triggered.world.livingEventStates.E09?.status !== 'ACTIVE') throw new Error('Rent arrears did not naturally trigger E09 for browser acceptance');
    const position = { x: interaction.x / 16, y: interaction.y / 16 };
    for (const [hostId, hostPosition] of Object.entries({ yardkeeper_semyon: position, tenant_mikhail: { x: 13, y: 4 }, landlady_polina: { x: 14, y: 4 } })) {
      triggered.hosts[hostId].mapId = 'courtyard';
      triggered.hosts[hostId].position = hostPosition;
    }
    triggered.player.position = { ...position };
    triggered.player.embodiment = 'yardkeeper_semyon';
    triggered.hosts.yardkeeper_semyon.mapId = 'courtyard';
    triggered.world.currentMapId = 'courtyard';
    await context.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(triggered));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-courtyard-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('세묜'), { timeout: 10000 });
    await page.waitForFunction(title => document.querySelector('#mission-title')?.textContent?.includes(title), quest.titleKo);
    await page.keyboard.press('e');
    const mediateButton = page.getByRole('button', { name: '두 사람 말을 듣고 장부를 함께 확인한다' });
    await mediateButton.waitFor({ state: 'visible' });
    await mediateButton.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!ui.choices.some(text => text.includes('공식 신고는 남지 않습니다')) || ui.scrollWidth > ui.width + 1) {
      throw new Error(`E09 choice disclosure or viewport failed: ${JSON.stringify(ui)}`);
    }
    await page.screenshot({ path: path.join(output, `courtyard-dispute-choices-${viewport.width}x${viewport.height}.png`) });
    const previous = await page.locator('#record').textContent();
    await mediateButton.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previous);
    const stored = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const reloaded = game.loadGame(stored, { maps, hostCards: cards, quests: [quest] });
    if (reloaded.world.livingEventStates.E09.stage !== 'NEIGHBORS_SETTLED' || pageErrors.length || serverErrors.length) {
      throw new Error(`E09 browser action failed: ${JSON.stringify({ stage: reloaded.world.livingEventStates.E09.stage, pageErrors, serverErrors })}`);
    }
    results.push({ viewport, choiceCount: ui.choices.length, stage: reloaded.world.livingEventStates.E09.stage,
      scrollWidth: ui.scrollWidth, pageErrors });
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const report = { status: 'PASS', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'COURTYARD_DISPUTE_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
