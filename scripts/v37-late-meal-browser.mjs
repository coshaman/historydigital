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
const quest = readJson('rpg/quests/late-meal-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4197, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`Late meal preview failed to start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const interaction = maps['inn-interior'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'inn-interior' });
    state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 1140;
    state.world.currentMapId = 'inn-interior'; state.player.position = { x: interaction.x / 16, y: interaction.y / 16 };
    state.player.embodiment = null;
    const seller = state.hosts.innkeeper_irina, buyer = state.hosts.lodging_tatyana;
    seller.mapId = 'inn-interior'; seller.position = { x: 11, y: 14 };
    buyer.mapId = 'inn-interior'; buyer.position = { x: 11, y: 13 };
    buyer.needs.hunger = 92; buyer.money.amount = 8;
    buyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: 'BROWSER_E18_SUPPER' };
    seller.marketStock['저녁 수프'] = 3;
    const request = game.advanceNpcWorld(state, 1, maps);
    if (request.world.livingEventStates.E18?.status !== 'ACTIVE') throw new Error('The hungry customer did not naturally open E18');
    const triggered = structuredClone(request);
    const controlled = { x: interaction.x / 16, y: interaction.y / 16 };
    triggered.world.currentMapId = 'inn-interior';
    triggered.hosts.lodging_tatyana.mapId = 'inn-interior'; triggered.hosts.lodging_tatyana.position = { ...controlled };
    triggered.hosts.innkeeper_irina.mapId = 'inn-interior'; triggered.hosts.innkeeper_irina.position = { x: 11, y: 14 };
    triggered.player.embodiment = 'lodging_tatyana'; triggered.player.position = { ...controlled };
    const before = { money: triggered.hosts.lodging_tatyana.money.amount, hunger: triggered.hosts.lodging_tatyana.needs.hunger };
    await context.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(triggered));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-late-meal-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('타티야나'), { timeout: 10000 });
    await page.keyboard.press('e');
    const mealButton = page.getByRole('button', { name: '정량의 수프값을 내고 저녁을 먹는다' });
    await mealButton.waitFor({ state: 'visible' });
    await mealButton.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!ui.choices.some(text => text.includes('2코펙') && text.includes('배고픔이 줄지만')) || ui.scrollWidth > ui.width + 1) {
      throw new Error(`E18 choice disclosure or viewport failed: ${JSON.stringify(ui)}`);
    }
    await page.screenshot({ path: path.join(output, `late-meal-choices-${viewport.width}x${viewport.height}.png`) });
    const previous = await page.locator('#record').textContent();
    await mealButton.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previous);
    const stored = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const reloaded = game.loadGame(stored, { maps, hostCards: cards, quests: [quest] });
    const event = reloaded.world.livingEventStates.E18;
    if (event.stage !== 'MEAL_PAID' || reloaded.hosts.lodging_tatyana.money.amount !== before.money - 2
      || reloaded.hosts.innkeeper_irina.marketStock['저녁 수프'] !== 2
      || reloaded.hosts.lodging_tatyana.needs.hunger >= before.hunger || pageErrors.length || serverErrors.length) {
      throw new Error(`E18 browser choice failed: ${JSON.stringify({ stage: event.stage, pageErrors, serverErrors })}`);
    }
    results.push({ viewport, choiceCount: ui.choices.length, stage: event.stage,
      scrollWidth: ui.scrollWidth, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
const report = { status: 'PASS', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'LATE_MEAL_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
