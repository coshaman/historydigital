import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState, readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const maps = Object.fromEntries(fs.readdirSync('rpg/maps').filter(file => file.endsWith('.json'))
  .map(file => { const map = readJson(path.join('rpg/maps', file)); return [map.mapId, map]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => readJson(path.join('rpg/characters', file)));
const quest = readJson('rpg/quests/sick-lodger-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE'); fs.mkdirSync(output, { recursive: true });
const port = 4207, staticRoot = path.resolve('dist-v33');
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: staticRoot }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = []; server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
const deadline = Date.now() + 10000; let ready = false;
while (Date.now() < deadline && !ready) { try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
if (!ready) { server.kill(); throw new Error(`E15 preview failed to start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true }), cases = [];
try {
  const bed = maps['inn-interior'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const [actionId, label, stage, filename] of [
      ['E15_REQUEST_AUNT_COMPANY', '이모 류보프를 부른다', 'FAMILY_COMPANION_REQUESTED', 'family'],
      ['E15_REQUEST_NEIGHBOR_HELP', '산파 아브도티야를 불러 2코페이카를 건넨다', 'MIDWIFE_REQUESTED', 'help'],
      ['E15_KEEP_PRIVATE', '문을 닫고 혼자 쉬겠다고 한다', 'PRIVACY_CHOSEN', 'privacy'],
    ]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage(), pageErrors = []; page.on('pageerror', error => pageErrors.push(error.stack ?? String(error)));
      const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'inn-interior' });
      state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-06'; state.world.clockMinutes = 418;
      state.hosts.lodging_tatyana.needs.hunger = 80;
      let eventState = game.advanceNpcWorld(state, 2, maps);
      const event = eventState.world.livingEventStates.E15, tile = { ...event.scenePosition };
      eventState.world.currentMapId = 'inn-interior'; eventState.player.embodiment = 'lodging_tatyana'; eventState.player.position = tile;
      eventState.hosts.lodging_tatyana.mapId = 'inn-interior'; eventState.hosts.lodging_tatyana.position = tile;
      await context.addInitScript(saved => { localStorage.setItem('v33-rpg-save', saved); localStorage.setItem('v34-tutorial-stage', 'done'); }, game.saveGame(eventState));
      await page.goto(`http://127.0.0.1:${port}/index.html#v37-sick-lodger-${filename}-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('타티야나'), { timeout: 10000 });
      await page.keyboard.press('e');
      const button = page.getByRole('button', { name: label }); await button.waitFor({ state: 'visible', timeout: 2000 }); await button.scrollIntoViewIfNeeded();
      const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(item => item.innerText),
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      if (ui.choices.length !== 3 || ui.scrollWidth > ui.width + 1 || !ui.choices.some(choice => choice.includes('공식 장부') || choice.includes('공식 기록'))) {
        throw new Error(`E15 choice disclosure/layout failed: ${JSON.stringify(ui)}`);
      }
      const lastButton = page.getByRole('button', { name: '문을 닫고 혼자 쉬겠다고 한다' }); await lastButton.scrollIntoViewIfNeeded();
      const lastChoiceRect = await lastButton.evaluate(element => { const rect = element.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, height: window.innerHeight }; });
      if (lastChoiceRect.top < 0 || lastChoiceRect.bottom > lastChoiceRect.height) throw new Error(`E15 last choice is clipped: ${JSON.stringify(lastChoiceRect)}`);
      await page.screenshot({ path: path.join(output, `sick-lodger-last-choice-${viewport.width}x${viewport.height}.png`) });
      const before = await page.locator('#record').textContent(); await button.click();
      await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, before);
      const saved = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
      const restored = game.loadGame(saved, { maps, hostCards: cards, quests: [quest] });
      if (restored.world.livingEventStates.E15.stage !== stage || pageErrors.length || serverErrors.length) {
        throw new Error(`E15 browser choice failed: ${JSON.stringify({ stage: restored.world.livingEventStates.E15.stage, pageErrors, serverErrors })}`);
      }
      const visibleUiText = await page.locator('body').innerText();
      if (actionId === 'E15_REQUEST_NEIGHBOR_HELP' && !visibleUiText.includes('아브도티야를 불러 주세요'))
        throw new Error(`E15 character voice/result was not shown after selection: ${visibleUiText.slice(-1000)}`);
      if (actionId === 'E15_REQUEST_AUNT_COMPANY' && !visibleUiText.includes('이모를 불러 줄래요'))
        throw new Error(`E15 family choice result was not shown after selection: ${visibleUiText.slice(-1000)}`);
      await page.screenshot({ path: path.join(output, `sick-lodger-${filename}-${viewport.width}x${viewport.height}.png`) });
      cases.push({ viewport, actionId, stage, choicesVisible: ui.choices.length, disclosureVisible: true,
        lastChoiceReachable: true, lastChoiceRect, scrollWidth: ui.scrollWidth, pageErrors });
      await context.close();
    }
  }
} finally { await browser.close(); server.kill(); }
const report = { status: 'PASS', eventId: 'E15', validationStatus: 'DESIGN_SEED_NOT_VERIFIED', cases, serverErrors };
fs.writeFileSync(path.join(output, 'SICK_LODGER_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
