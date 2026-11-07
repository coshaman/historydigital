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
const innGuestQuest = readJson('rpg/quests/inn-guest-1847.json');
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
    const innState = game.createInitialState({ maps, hostCards: cards, quests: [quest, innGuestQuest], startMapId: 'inn-interior' });
    innState.world.chapterId = 'V33_1847_PRINT'; innState.world.date = '1847-06-01'; innState.world.clockMinutes = 900;
    innState.world.currentMapId = 'inn-interior'; innState.player.embodiment = null;
    const seller = innState.hosts.innkeeper_irina, guest = innState.hosts.courier_pavel;
    seller.mapId = 'inn-interior'; seller.position = { x: 10, y: 10 };
    guest.mapId = 'inn-interior'; guest.position = { x: 10, y: 10 };
    guest.needs.fatigue = 80; guest.money.amount = 8;
    const roomRequest = game.advanceNpcWorld(innState, 1, maps);
    const arrival = game.advanceNpcWorld(roomRequest, 1, maps);
    if (arrival.world.livingEventStates.E17?.stage !== 'GUEST_ARRIVED') throw new Error('The tired courier did not reach the inn desk');
    const readyForChoice = structuredClone(arrival), roomScene = { ...arrival.world.livingEventStates.E17.scenePosition };
    readyForChoice.world.currentMapId = 'inn-interior'; readyForChoice.player.embodiment = guest.id;
    readyForChoice.player.position = { ...roomScene };
    readyForChoice.hosts.courier_pavel.position = { ...roomScene };
    readyForChoice.hosts.innkeeper_irina.position = { ...roomScene };
    const rented = game.performQuestAction(readyForChoice, { questId: innGuestQuest.id, hostId: guest.id,
      actionId: 'E17_RENT_ROOM', objectId: innGuestQuest.entry.objectId }, { quests: [quest, innGuestQuest], maps });
    if (!rented.ok) throw new Error(`The guest could not rent the room: ${rented.reason}`);
    const triggered = rented.state;
    triggered.world.clockMinutes = 1140;
    triggered.world.currentMapId = 'inn-interior';
    const controlled = { x: interaction.x / 16, y: interaction.y / 16 };
    triggered.hosts.courier_pavel.mapId = 'inn-interior'; triggered.hosts.courier_pavel.position = { ...controlled };
    triggered.hosts.courier_pavel.needs.hunger = 92;
    triggered.hosts.innkeeper_irina.mapId = 'inn-interior'; triggered.hosts.innkeeper_irina.position = { ...controlled };
    triggered.hosts.innkeeper_irina.marketStock['저녁 수프'] = 3;
    triggered.player.embodiment = 'courier_pavel'; triggered.player.position = { ...controlled };
    const request = game.advanceNpcWorld(triggered, 1, maps);
    if (request.world.livingEventStates.E18?.status !== 'ACTIVE' || request.world.livingEventStates.E18?.sourceEventId !== 'E17')
      throw new Error('The hungry overnight guest did not create the linked E18 event while possessed');
    const before = { money: request.hosts.courier_pavel.money.amount, hunger: request.hosts.courier_pavel.needs.hunger };
    await context.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(request));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-late-meal-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('파벨'), { timeout: 10000 });
    await page.keyboard.press('e');
    const mealButton = page.getByRole('button', { name: '정량의 수프값을 내고 저녁을 먹는다' });
    await mealButton.waitFor({ state: 'visible' });
    await mealButton.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!ui.choices.some(text => text.includes('2코펙') && text.includes('배고픔이 줄지만')) || ui.scrollWidth > ui.width + 1) {
      throw new Error(`E18 choice disclosure or viewport failed: ${JSON.stringify(ui)}`);
    }
    await page.screenshot({ path: path.join(output, `inn-chain-meal-choices-${viewport.width}x${viewport.height}.png`) });
    const previous = await page.locator('#record').textContent();
    await mealButton.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previous);
    const stored = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const reloaded = game.loadGame(stored, { maps, hostCards: cards, quests: [quest, innGuestQuest] });
    const event = reloaded.world.livingEventStates.E18;
    if (event.stage !== 'MEAL_PAID' || event.sourceEventId !== 'E17' || reloaded.hosts.courier_pavel.money.amount !== before.money - 2
      || reloaded.hosts.innkeeper_irina.marketStock['저녁 수프'] !== 2
      || reloaded.hosts.courier_pavel.needs.hunger >= before.hunger || pageErrors.length || serverErrors.length) {
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
