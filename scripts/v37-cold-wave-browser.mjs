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
const quest = readJson('rpg/quests/cold-wave-firewood-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4193, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`Cold-wave preview did not start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
    state.world.date = '1847-01-01';
    state.world.currentMapId = state.hosts.landlady_polina.mapId;
    state.player.position = { ...state.hosts.landlady_polina.position };
    const possessed = game.possessHost(state, 'landlady_polina', maps[state.world.currentMapId]);
    if (!possessed.ok) throw new Error(`Could not prepare cold-wave player: ${possessed.reason}`);
    const beforeTrigger = structuredClone(possessed.state);
    beforeTrigger.hosts.landlady_polina.mapId = 'market-quay';
    beforeTrigger.hosts.landlady_polina.position = { x: 12, y: 11 };
    beforeTrigger.hosts.tenant_mikhail.mapId = 'market-quay';
    beforeTrigger.hosts.tenant_mikhail.position = { x: 11, y: 11 };
    beforeTrigger.world.currentMapId = 'market-quay';
    beforeTrigger.player.position = { x: 12, y: 11 };
    const winter = game.advanceNpcWorld(structuredClone(possessed.state), 1, maps);
    winter.world.currentMapId = 'market-quay';
    winter.hosts.landlady_polina.mapId = 'market-quay';
    winter.hosts.landlady_polina.position = { x: 12, y: 11 };
    winter.hosts.tenant_mikhail.mapId = 'market-quay';
    winter.hosts.tenant_mikhail.position = { x: 11, y: 11 };
    winter.world.currentMapId = 'market-quay';
    winter.player.position = { x: 12, y: 11 };
    await context.addInitScript(saved => {
      if (!localStorage.getItem('v33-rpg-save')) localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v33-rpg-tutorial-stage', 'done');
    }, game.saveGame(beforeTrigger));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-cold-wave-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('폴리나'));
    await page.keyboard.press('e');
    if (await page.getByRole('button', { name: '장작 한 단을 사서 가져간다' }).count()) {
      throw new Error('The E03 choice appeared before its weather trigger');
    }
    await page.evaluate(saved => localStorage.setItem('v33-rpg-save', saved), game.saveGame(winter));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('폴리나'));
    await page.keyboard.press('e');
    await page.getByRole('button', { name: '장작 한 단을 사서 가져간다' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: '장작 한 단을 사서 가져간다' }).scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => ({
      title: document.querySelector('#dialogue-speaker')?.textContent ?? '',
      choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      viewport: { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    }));
    if (!before.choices.some(choice => choice.includes('주변에 선택이 보입니다'))
      || !before.choices.some(choice => choice.includes('미하일과 장작 몫을 함께 마련한다'))
      || before.viewport.scrollWidth > before.viewport.width + 1) throw new Error(`Cold-wave UI disclosure failed: ${JSON.stringify(before)}`);
    await page.screenshot({ path: path.join(output, `cold-wave-choices-${viewport.width}x${viewport.height}.png`) });
    const lastChoice = page.getByRole('button', { name: '오늘은 사지 않고 장부만 확인한다' });
    await lastChoice.scrollIntoViewIfNeeded();
    const lastChoiceVisible = await page.evaluate(() => {
      const button = [...document.querySelectorAll('#actions button')].find(item => item.innerText.includes('오늘은 사지 않고 장부만 확인한다'));
      const rect = button?.getBoundingClientRect();
      return Boolean(rect && rect.top >= 0 && rect.bottom <= document.documentElement.clientHeight);
    });
    if (!lastChoiceVisible) throw new Error(`The last cold-wave option is not reachable at ${viewport.width}px`);
    await page.screenshot({ path: path.join(output, `cold-wave-last-choice-${viewport.width}x${viewport.height}.png`) });
    const beforeRecord = await page.locator('#record').textContent();
    await page.getByRole('button', { name: '장작 한 단을 사서 가져간다' }).click();
    await page.waitForFunction(previous => document.querySelector('#record')?.textContent !== previous, beforeRecord);
    const stateAfter = await page.evaluate(() => ({ stored: localStorage.getItem('v33-rpg-save'), record: document.querySelector('#record')?.textContent,
      title: document.querySelector('#headline')?.textContent, text: document.querySelector('#journal-text')?.textContent }));
    const stored = stateAfter.stored;
    const roundTrip = game.loadGame(stored, { maps, hostCards: cards, quests: [quest] });
    if (roundTrip.world.livingEventStates.E03.stage !== 'FIREWOOD_BOUGHT'
      || !roundTrip.hosts.landlady_polina.inventory.includes('장작 한 단')
      || pageErrors.length || serverErrors.length) throw new Error(`Cold-wave purchase did not persist: ${JSON.stringify({ stage: roundTrip.world.livingEventStates.E03.stage,
        record: stateAfter.record, title: stateAfter.title, text: stateAfter.text, pageErrors, serverErrors })}`);
    results.push({ viewport, choicesVisible: before.choices.length, lastChoiceReachable: lastChoiceVisible,
      stageAfterClick: roundTrip.world.livingEventStates.E03.stage, firewoodInInventory: true,
      scrollWidth: before.viewport.scrollWidth, pageErrors });
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const report = { status: 'PASS', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'COLD_WAVE_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
