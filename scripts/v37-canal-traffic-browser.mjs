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
const quest = readJson('rpg/quests/canal-traffic-response-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4202, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`Canal preview failed to start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const entry = maps['canal-road'].layers.find(layer => layer.name === 'Interactions').objects
      .find(object => object.id === quest.entry.objectId);
    const position = { x: entry.x / 16, y: entry.y / 16 };
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'canal-road' });
    state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 600;
    state.world.currentMapId = 'canal-road'; state.player.embodiment = 'coachman_timofey';
    state.player.position = { x: position.x, y: position.y };
    state.quests[quest.id] = { status: 'open' };
    for (const [hostId, hostPosition] of Object.entries({ coachman_timofey: position,
      watercarrier_luka: { x: position.x + 1, y: position.y }, carter_roman: { x: position.x - 1, y: position.y } })) {
      state.hosts[hostId].mapId = 'canal-road'; state.hosts[hostId].position = hostPosition;
    }
    state.world.livingEventStates.E11 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E11',
      status: 'ACTIVE', stage: 'BOAT_TRAFFIC', startedAtMinute: 590, clearsAtMinute: 611,
      actorHostIds: ['coachman_timofey', 'watercarrier_luka'], triggerHostId: 'coachman_timofey',
      waitMinutesByHost: {}, valueStatus: 'fictional_gameplay_balance', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
      occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION' };
    await context.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(state));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-canal-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('티모페이'), { timeout: 10000 });
    await page.keyboard.press('e');
    await page.waitForTimeout(350);
    const opened = await page.evaluate(() => ({
      body: document.querySelector('#bodyname')?.textContent,
      mission: document.querySelector('#mission-title')?.textContent,
      journalOpen: document.querySelector('#quest-journal')?.open,
      buttons: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      record: document.querySelector('#record')?.textContent,
    }));
    if (!opened.buttons.some(text => text.includes('우회 길'))) {
      await page.screenshot({ path: path.join(output, `canal-traffic-debug-${viewport.width}.png`) });
      throw new Error(`E11 scene did not expose its action button: ${JSON.stringify(opened)}`);
    }
    const detourButton = page.getByRole('button', { name: /로만에게 우회 길을 확인하고 돌아간다/ });
    await detourButton.waitFor({ state: 'visible' });
    await detourButton.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!ui.choices.some(text => text.includes('더 늦어집니다')) || ui.scrollWidth > ui.width + 1)
      throw new Error(`E11 choice disclosure or viewport failed: ${JSON.stringify(ui)}`);
    await page.screenshot({ path: path.join(output, `canal-traffic-choices-${viewport.width}x${viewport.height}.png`) });
    if (viewport.width < 600) {
      const lastChoice = page.locator('#actions button').last();
      await lastChoice.scrollIntoViewIfNeeded();
      const scroll = await lastChoice.evaluate(button => {
        const journal = document.querySelector('.journal'), choice = button.getBoundingClientRect(), box = journal.getBoundingClientRect();
        return { inside: choice.top >= box.top - 1 && choice.bottom <= box.bottom + 1,
          choiceTop: choice.top, choiceBottom: choice.bottom, journalTop: box.top, journalBottom: box.bottom,
          scrollTop: journal.scrollTop, scrollHeight: journal.scrollHeight, clientHeight: journal.clientHeight };
      });
      if (!scroll.inside || scroll.scrollTop <= 0)
        throw new Error(`E11 mobile choice is not reachable by journal scrolling: ${JSON.stringify(scroll)}`);
      await page.screenshot({ path: path.join(output, `canal-traffic-last-choice-${viewport.width}x${viewport.height}.png`) });
    }
    const previous = await page.locator('#record').textContent();
    await detourButton.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previous);
    const stored = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const restored = game.loadGame(stored, { maps, hostCards: cards, quests: [quest] });
    const event = restored.world.livingEventStates.E11;
    if (!event.reroutedHostIds?.includes('coachman_timofey') || event.routeAdviceFromHostId !== 'carter_roman'
      || pageErrors.length || serverErrors.length) {
      throw new Error(`E11 browser action failed: ${JSON.stringify({ event, pageErrors, serverErrors })}`);
    }
    results.push({ viewport, choiceCount: ui.choices.length, rerouted: event.reroutedHostIds,
      scrollWidth: ui.scrollWidth, pageErrors });
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const report = { status: 'PASS', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'CANAL_TRAFFIC_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
