import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const maps = Object.fromEntries(fs.readdirSync('rpg/maps').filter(file => file.endsWith('.json'))
  .map(file => { const map = read(path.join('rpg/maps', file)); return [map.mapId, map]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => read(path.join('rpg/characters', file)));
const quest = read('rpg/quests/v37-official-procession-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4204, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`E45 preview did not start: ${serverErrors.join('')}`); }

const browser = await chromium.launch({ headless: true });
const cases = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });
    state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 660;
    state.world.currentMapId = 'nevsky'; state.player.position = { x: 2, y: 2 };
    let staged = state;
    for (let elapsed = 0; elapsed < 240 && staged.world.livingEventStates.E45?.stage !== 'CLEARANCE_READY'; elapsed += 30) {
      staged = game.advanceNpcWorld(staged, 30, maps);
    }
    if (staged.world.livingEventStates.E45?.stage !== 'CLEARANCE_READY') {
      throw new Error(`Natural E45 event did not stage within 240 minutes: ${JSON.stringify(staged.world.livingEventStates.E45)}`);
    }
    staged.player.position = { ...staged.hosts.street_vendor_matryona.position };
    const possessed = game.possessHost(staged, 'street_vendor_matryona', maps.nevsky);
    if (!possessed.ok) throw new Error(`Could not embody Matryona at the staged market scene: ${possessed.reason}`);
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    await page.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(possessed.state));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-procession-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('마트료나'), { timeout: 10000 });
    await page.keyboard.press('e');
    const choice = page.getByRole('button', { name: /물건을 거두어 길 가장자리로 옮긴다/ });
    await choice.waitFor({ state: 'visible', timeout: 5000 });
    const beforeChoice = await page.locator('#record').textContent();
    const scene = await page.evaluate(() => {
      const root = document.documentElement;
      return { title: document.querySelector('#headline')?.textContent ?? '',
        actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        width: root.clientWidth, scrollWidth: root.scrollWidth,
        worldCanvas: document.querySelector('#world')?.width > 0,
        canvasLabel: document.querySelector('#world')?.getAttribute('aria-label') ?? '' };
    });
    if (scene.scrollWidth > scene.width + 1 || !scene.actions.some(text => text.includes('물건을 거두어 길 가장자리로 옮긴다'))
      || !scene.worldCanvas) throw new Error(`E45 carriage scene and choice are not visible without overflow: ${JSON.stringify(scene)}`);
    await page.screenshot({ path: path.join(output, `procession-ready-${viewport.width}x${viewport.height}.png`) });
    await choice.scrollIntoViewIfNeeded();
    await choice.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, beforeChoice);
    const saved = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const restored = game.loadGame(saved, { maps, hostCards: cards, quests: [quest] });
    const event = restored.world.livingEventStates.E45;
    if (event?.status !== 'RESOLVED' || event.disposition !== 'STALL_MOVED_ASIDE'
      || restored.world.processionRecords?.at(-1)?.disposition !== 'STALL_MOVED_ASIDE'
      || pageErrors.length || serverErrors.length) {
      throw new Error(`E45 choice did not persist its route change: ${JSON.stringify({ event, pageErrors, serverErrors })}`);
    }
    await page.screenshot({ path: path.join(output, `procession-stall-moved-${viewport.width}x${viewport.height}.png`) });
    cases.push({ viewport, embodiment: 'street_vendor_matryona', stageBeforeChoice: 'CLEARANCE_READY',
      stageAfterChoice: event.stage, disposition: event.disposition, carriageVisible: scene.worldCanvas,
      visibleChoices: scene.actions.length, horizontalOverflow: scene.scrollWidth > scene.width, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
if (serverErrors.length) throw new Error(`E45 preview server errors: ${serverErrors.join('')}`);
const report = { status: 'PASS', cases };
fs.writeFileSync(path.join(output, 'PROCESSION_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
