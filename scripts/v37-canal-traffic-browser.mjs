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
  let natural = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'canal-road' });
  natural.world.chapterId = 'V33_1847_PRINT'; natural.world.date = '1847-06-01';
  natural.world.currentMapId = 'canal-road'; natural.quests[quest.id] = { status: 'open' };
  for (let step = 0; step < 288 && natural.world.livingEventStates.E11?.stage !== 'BOAT_TRAFFIC'; step += 1)
    natural = game.advanceNpcWorld(natural, 5, maps);
  const naturalEvent = natural.world.livingEventStates.E11;
  if (naturalEvent?.stage !== 'BOAT_TRAFFIC')
    throw new Error(`E11 did not naturally reach boat traffic on resident schedules: ${JSON.stringify(naturalEvent ?? null)}`);
  const naturalEventRow = natural.ledger.flatMap(row => row.livingEvents ?? [])
    .find(event => event.catalogEventId === 'E11' && event.stage === 'BOAT_TRAFFIC');
  if (!naturalEventRow) throw new Error('The naturally triggered crossing did not leave an event-log row.');
  const possession = game.possessHost(natural, 'coachman_timofey', maps['canal-road']);
  if (!possession.ok) throw new Error(`The player could not possess the arriving driver at the live event: ${JSON.stringify({ reason: possession.reason,
    driver: natural.hosts.coachman_timofey.position, observer: natural.player.position })}`);
  natural = possession.state;
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const entry = maps['canal-road'].layers.find(layer => layer.name === 'Interactions').objects
      .find(object => object.id === quest.entry.objectId);
    const position = { x: entry.x / 16, y: entry.y / 16 };
    const state = structuredClone(natural);
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
    if (!opened.buttons.some(text => text.includes('배가 지나갈 때까지 기다린다'))) {
      await page.screenshot({ path: path.join(output, `canal-traffic-debug-${viewport.width}.png`) });
      throw new Error(`E11 scene did not expose its action button: ${JSON.stringify({ opened,
        eventPosition: naturalEvent.position, driver: natural.hosts.coachman_timofey.position,
        partner: natural.hosts.watercarrier_luka.position, objectPosition: position })}`);
    }
    const waitButton = page.getByRole('button', { name: /배가 지나갈 때까지 기다린다/ });
    await waitButton.waitFor({ state: 'visible' });
    await waitButton.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!ui.choices.some(text => text.includes('다음 일감이 늦어질 수 있습니다')) || ui.scrollWidth > ui.width + 1)
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
      if (!scroll.inside || (scroll.scrollHeight > scroll.clientHeight && scroll.scrollTop <= 0))
        throw new Error(`E11 mobile choice is not reachable by journal scrolling: ${JSON.stringify(scroll)}`);
      await page.screenshot({ path: path.join(output, `canal-traffic-last-choice-${viewport.width}x${viewport.height}.png`) });
    }
    const previous = await page.locator('#record').textContent();
    await waitButton.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previous);
    const stored = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const restored = game.loadGame(stored, { maps, hostCards: cards, quests: [quest] });
    const event = restored.world.livingEventStates.E11;
    if (event.playerDecision?.response !== 'WAIT_FOR_PASSAGE' || (event.waitMinutesByHost?.coachman_timofey ?? 0) < 5
      || pageErrors.length || serverErrors.length) {
      throw new Error(`E11 browser action failed: ${JSON.stringify({ event, pageErrors, serverErrors })}`);
    }
    results.push({ viewport, naturalTrigger: { minute: naturalEventRow.minute, mapId: naturalEventRow.mapId,
      position: naturalEventRow.position, witnessedByPlayer: naturalEventRow.witnessedByPlayer },
      choiceCount: ui.choices.length, response: event.playerDecision.response,
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
