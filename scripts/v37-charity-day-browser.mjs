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
const quest = readJson('rpg/quests/charity-day-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4198, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`Charity-day preview failed to start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const cases = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const object = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
    state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-06'; state.world.clockMinutes = 719;
    state.world.currentMapId = 'market-quay'; state.player.position = { x: object.x / 16, y: object.y / 16 };
    state.hosts.market_nadezhda.marketStock['빵 한 묶음'] = 2;
    state.hosts.tenant_mikhail.needs.hunger = 84;
    const triggered = game.advanceNpcWorld(state, 1, maps);
    if (triggered.world.livingEventStates.E14?.status !== 'ACTIVE') throw new Error('Sunday market stock and hunger did not trigger E14');
    const actorIds = ['yardkeeper_semyon', 'market_nadezhda', 'tenant_mikhail'];
    const tile = { x: object.x / 16, y: object.y / 16 };
    const positions = [{ ...tile }, { x: tile.x - 1, y: tile.y }, { x: tile.x, y: tile.y - 1 }];
    actorIds.forEach((id, index) => { triggered.hosts[id].mapId = 'market-quay'; triggered.hosts[id].position = positions[index]; });
    triggered.world.currentMapId = 'market-quay'; triggered.player.embodiment = 'tenant_mikhail';
    triggered.player.position = { ...triggered.hosts.tenant_mikhail.position };
    const readyState = game.advanceNpcWorld(triggered, 1, maps, { pausedHostIds: actorIds });
    if (readyState.world.livingEventStates.E14.stage !== 'RELIEF_LINE_FORMS') throw new Error('The three participants did not form the in-world relief line');
    const previousMoney = readyState.hosts.tenant_mikhail.money.amount;
    const previousHunger = readyState.hosts.tenant_mikhail.needs.hunger;
    const previousStock = readyState.hosts.market_nadezhda.marketStock['빵 한 묶음'];
    await context.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(readyState));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-charity-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('미하일'), { timeout: 10000 });
    await page.keyboard.press('e');
    const button = page.getByRole('button', { name: '1코페이카를 내고 빵을 받아 간다' });
    await button.waitFor({ state: 'visible' }); await button.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(item => item.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (ui.choices.length !== 2 || !ui.choices[0].includes('1코페이카') || !ui.choices[0].includes('공동 장부') && !ui.choices[0].includes('시장 구호 장부')
      || ui.scrollWidth > ui.width + 1) throw new Error(`E14 choice disclosure/layout failed: ${JSON.stringify(ui)}`);
    await page.screenshot({ path: path.join(output, `charity-day-choices-${viewport.width}x${viewport.height}.png`) });
    const priorRecord = await page.locator('#record').textContent();
    await button.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, priorRecord);
    const saved = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const reloaded = game.loadGame(saved, { maps, hostCards: cards, quests: [quest] });
    const event = reloaded.world.livingEventStates.E14;
    if (event.stage !== 'RATION_PURCHASED' || reloaded.hosts.tenant_mikhail.money.amount !== previousMoney - 1
      || reloaded.hosts.market_nadezhda.marketStock['빵 한 묶음'] !== previousStock - 1
      || reloaded.hosts.tenant_mikhail.needs.hunger >= previousHunger - 25 || pageErrors.length || serverErrors.length) {
      throw new Error(`E14 browser choice failed: ${JSON.stringify({ stage: event.stage, pageErrors, serverErrors })}`);
    }
    cases.push({ viewport, visibleChoices: ui.choices.length, stage: event.stage, scrollWidth: ui.scrollWidth, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
const report = { status: 'PASS', cases, serverErrors, eventId: 'E14', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
fs.writeFileSync(path.join(output, 'CHARITY_DAY_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
