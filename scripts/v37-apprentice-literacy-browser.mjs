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
const quest = readJson('rpg/quests/apprentice-literacy-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE'); fs.mkdirSync(output, { recursive: true });
const port = 4199, staticRoot = path.resolve('dist-v33');
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: staticRoot }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = []; server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
const deadline = Date.now() + 10000; let ready = false;
while (Date.now() < deadline && !ready) { try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
if (!ready) { server.kill(); throw new Error(`Literacy preview failed to start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true }), cases = [];
try {
  const object = maps.printshop.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = []; page.on('pageerror', error => pageErrors.push(String(error)));
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'printshop' });
    state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 999;
    const triggered = game.advanceNpcWorld(state, 2, maps);
    const tile = { x: object.x / 16, y: object.y / 16 };
    triggered.world.currentMapId = 'printshop'; triggered.hosts.teacher_lyubov.mapId = 'printshop';
    triggered.hosts.teacher_lyubov.position = { ...tile };
    triggered.hosts.print_apprentice_stepan.mapId = 'printshop'; triggered.hosts.print_apprentice_stepan.position = { x: tile.x + 1, y: tile.y };
    triggered.player.embodiment = 'print_apprentice_stepan'; triggered.player.position = { ...triggered.hosts.print_apprentice_stepan.position };
    const stateAtDesk = game.advanceNpcWorld(triggered, 1, maps, { pausedHostIds: ['teacher_lyubov', 'print_apprentice_stepan'] });
    if (stateAtDesk.world.livingEventStates.E19.stage !== 'LESSON_READY') throw new Error('The physical lesson was not ready');
    const moneyBefore = stateAtDesk.hosts.print_apprentice_stepan.money.amount;
    const skillBefore = stateAtDesk.hosts.print_apprentice_stepan.skills.basicReading;
    await context.addInitScript(saved => { localStorage.setItem('v33-rpg-save', saved); localStorage.setItem('v34-tutorial-stage', 'done'); }, game.saveGame(stateAtDesk));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-literacy-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('스테판'), { timeout: 10000 });
    await page.keyboard.press('e');
    const button = page.getByRole('button', { name: '오늘 배운 글자를 한 줄 더 읽어 달라고 한다' });
    await button.waitFor({ state: 'visible' }); await button.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(item => item.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (ui.choices.length !== 3 || !ui.choices.some(choice => choice.includes('수업 장부는 남지 않습니다'))
      || ui.scrollWidth > ui.width + 1) throw new Error(`E19 choice disclosure/layout failed: ${JSON.stringify(ui)}`);
    await page.screenshot({ path: path.join(output, `apprentice-literacy-choices-${viewport.width}x${viewport.height}.png`) });
    const lastButton = page.getByRole('button', { name: '오늘은 여기서 그만하고 각자 돌아간다' });
    await lastButton.scrollIntoViewIfNeeded();
    const lastChoiceRect = await lastButton.evaluate(element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: window.innerHeight }; });
    if (lastChoiceRect.top < 0 || lastChoiceRect.bottom > lastChoiceRect.height) throw new Error(`The last mobile/desktop choice cannot be reached by scrolling: ${JSON.stringify(lastChoiceRect)}`);
    await page.screenshot({ path: path.join(output, `apprentice-literacy-last-choice-${viewport.width}x${viewport.height}.png`) });
    await button.scrollIntoViewIfNeeded();
    const previousRecord = await page.locator('#record').textContent(); await button.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previousRecord);
    const saved = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const reloaded = game.loadGame(saved, { maps, hostCards: cards, quests: [quest] });
    const event = reloaded.world.livingEventStates.E19;
    if (event.stage !== 'LESSON_COMPLETED' || reloaded.hosts.print_apprentice_stepan.skills.basicReading !== skillBefore + 1
      || reloaded.hosts.print_apprentice_stepan.money.amount !== moneyBefore
      || !reloaded.hosts.print_apprentice_stepan.inventory.includes('류보프와 함께 읽은 연습지 (게임 재구성)')
      || pageErrors.length || serverErrors.length) throw new Error(`E19 browser choice failed: ${JSON.stringify({ stage: event.stage, pageErrors, serverErrors })}`);
    await page.keyboard.press('j');
    await page.waitForFunction(() => document.querySelector('#quest-journal')?.open === true);
    await page.locator('[data-journal-tab="inventory"]').click();
    const skillNotebookText = await page.locator('#journal-skills').textContent();
    if (!skillNotebookText.includes('기초 읽기 · 2 / 5 · 게임 설정 수치')) throw new Error(`The saved skill is not visible in the character notebook: ${skillNotebookText}`);
    await page.screenshot({ path: path.join(output, `apprentice-literacy-skill-notebook-${viewport.width}x${viewport.height}.png`) });
    cases.push({ viewport, visibleChoices: ui.choices.length, stage: event.stage, literacy: reloaded.hosts.print_apprentice_stepan.skills.basicReading,
      skillNotebookVisible: true, lastChoiceReachable: true, lastChoiceRect, scrollWidth: ui.scrollWidth, pageErrors });
    await context.close();
  }
} finally { await browser.close(); server.kill(); }
const report = { status: 'PASS', cases, serverErrors, eventId: 'E19', validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
fs.writeFileSync(path.join(output, 'APPRENTICE_LITERACY_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
