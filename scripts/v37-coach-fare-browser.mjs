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
const quest = readJson('rpg/quests/coach-fare-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4203, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`Coach fare preview failed to start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const results = [];
const scenarios = [
  { name: 'fare-short', viewport: { width: 1440, height: 900 }, actionId: 'COACHMAN_TIMOFEY_CHOICE_1',
    label: '점검을 마친 뒤 가능한 거리만 태운다', expected: { fare: 3, destination: 'nevsky', condition: 'INSPECTED' } },
  { name: 'fare-risk', viewport: { width: 768, height: 900 }, actionId: 'COACHMAN_TIMOFEY_CHOICE_2',
    label: '손님에게 길 상태를 알리고 먼 길을 맡는다', expected: { fare: 5, destination: 'courtyard', condition: 'AT_RISK' } },
  { name: 'repair', viewport: { width: 390, height: 844 }, actionId: 'COACHMAN_TIMOFEY_CHOICE_3',
    label: '운행을 미루고 말과 마차를 고친다', expected: { fare: 0, destination: 'market-quay', condition: 'SERVICEABLE' } },
];
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: scenario.viewport, isMobile: scenario.viewport.width < 600,
      hasTouch: scenario.viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
    state.world.chapterId = 'V33_1847_PRINT'; state.world.date = quest.date;
    state.quests[quest.id] = { status: 'open' };
    const object = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects
      .find(row => row.id === quest.entry.objectId);
    const position = { x: object.x / 16, y: object.y / 16 };
    state.hosts.coachman_timofey.mapId = 'market-quay';
    state.hosts.coachman_timofey.position = { ...position };
    state.player.position = { ...position };
    if (scenario.expected.fare) {
      const passenger = state.hosts.minor_noble_andrei;
      passenger.mapId = 'market-quay'; passenger.position = { x: position.x - 1, y: position.y };
    }
    for (const person of Object.values(state.hosts)) {
      if (person.mapId === 'market-quay' && !['coachman_timofey', 'minor_noble_andrei'].includes(person.id))
        person.position = { x: 5, y: 5 };
    }
    const before = { passengerMoney: state.hosts.minor_noble_andrei.money.amount,
      coachmanMoney: state.hosts.coachman_timofey.money.amount, minute: state.world.clockMinutes };
    const possessed = game.possessHost(state, 'coachman_timofey', maps['market-quay']);
    if (!possessed.ok) throw new Error(`Could not possess coachman for ${scenario.name}: ${possessed.reason}`);
    await context.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(possessed.state));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-coach-${scenario.name}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('티모페이'), { timeout: 10000 });
    await page.keyboard.press('e');
    const button = page.getByRole('button', { name: new RegExp(scenario.label) });
    await button.waitFor({ state: 'visible', timeout: 5000 });
    await button.scrollIntoViewIfNeeded();
    const view = await page.evaluate(() => ({
      choices: [...document.querySelectorAll('#actions button')].map(item => item.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      journal: (() => { const el = document.querySelector('.journal'); return el && {
        top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom,
        scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      }; })(),
    }));
    if (view.scrollWidth > view.width + 1 || !view.choices.every(text => text.includes('코페이카') || text.includes('운임')))
      throw new Error(`E10 choice disclosure or viewport failed for ${scenario.name}: ${JSON.stringify(view)}`);
    await page.screenshot({ path: path.join(output, `coach-fare-${scenario.name}-${scenario.viewport.width}x${scenario.viewport.height}.png`) });
    const previousRecord = await page.locator('#record').textContent();
    await button.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previousRecord);
    const stored = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const restored = game.loadGame(stored, { maps, hostCards: cards, quests: [quest] });
    const event = restored.world.livingEventStates.E10;
    const passenger = event.passengerHostId ? restored.hosts[event.passengerHostId] : null;
    if (event.actionId !== scenario.actionId || event.fareKopeks !== scenario.expected.fare
      || restored.hosts.coachman_timofey.transportState.carriageCondition !== scenario.expected.condition
      || (passenger && (passenger.mapId !== scenario.expected.destination
        || passenger.money.amount !== before.passengerMoney - scenario.expected.fare
        || restored.hosts.coachman_timofey.money.amount !== before.coachmanMoney + scenario.expected.fare))
      || (scenario.expected.fare === 0 && event.tripStatus !== 'REPAIR')
      || pageErrors.length || serverErrors.length) {
      throw new Error(`E10 browser action failed: ${JSON.stringify({ event, coachman: restored.hosts.coachman_timofey,
        passenger, pageErrors, serverErrors })}`);
    }
    results.push({ scenario: scenario.name, viewport: scenario.viewport, choices: view.choices,
      event: { actionId: event.actionId, fareKopeks: event.fareKopeks, destinationMapId: event.destinationMapId,
        carriageCondition: event.transportResult.carriageCondition, passengerHostId: event.passengerHostId ?? null },
      clockDelta: restored.world.clockMinutes - before.minute, scrollWidth: view.scrollWidth,
      journal: view.journal, savedAndReloaded: true, pageErrors });
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const report = { status: 'PASS', eventId: 'E10', sourceStatus: 'DESIGN_SEED_NOT_VERIFIED', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'COACH_FARE_E10_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
