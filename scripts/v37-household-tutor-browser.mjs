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
const quest = read('rpg/quests/household-tutor-offer-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4201, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`E37 preview did not start: ${serverErrors.join('')}`); }

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [viewport, actionId, label, expectedStage, weeklyPay] of [
    [{ width: 1440, height: 900 }, 'E37_ACCEPT_OFFER', '주 2회 수업하고 첫 주 품삯 10코페이카를 받는다', 'OFFER_ACCEPTED', 10],
    [{ width: 390, height: 844 }, 'E37_AGREE_LIGHTER_SCHEDULE', '주 1회 수업하고 첫 주 품삯 6코페이카를 받는다', 'SCHEDULE_REDUCED', 6],
  ]) {
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'courtyard' });
    state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 959;
    state.world.currentMapId = 'courtyard'; state.player.embodiment = 'teacher_lyubov';
    state.hosts.teacher_lyubov.mapId = 'courtyard'; state.hosts.teacher_lyubov.position = { x: 17, y: 13 };
    state.player.position = { ...state.hosts.teacher_lyubov.position };
    state.hosts.minor_noble_andrei.mapId = 'courtyard'; state.hosts.minor_noble_andrei.position = { x: 18, y: 13 };
    const eventState = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: ['teacher_lyubov'] });
    if (eventState.world.livingEventStates.E37?.stage !== 'OFFER_DELIVERED') throw new Error('E37 did not reach its visible offer stage');

    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    await page.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(eventState));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-household-tutor-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('류보프'), { timeout: 10000 });
    await page.keyboard.press('e');
    const choice = page.getByRole('button', { name: label });
    await choice.waitFor({ state: 'visible', timeout: 5000 });
    await choice.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => ({
      title: document.querySelector('#journal-title')?.textContent || document.querySelector('#scene-title')?.textContent || '',
      actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      buttons: [...document.querySelectorAll('#actions button')].map(button => { const rect = button.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom }; }),
    }));
    if (!before.actions.some(text => text.includes('아이들의 수업')) || before.scrollWidth > before.width + 1
      || before.buttons.some(rect => rect.top < 0 || rect.bottom > viewport.height)) {
      throw new Error(`E37 offer choices are unclear or clipped: ${JSON.stringify(before)}`);
    }
    await page.screenshot({ path: path.join(output, `household-tutor-offer-${viewport.width}x${viewport.height}.png`) });
    const lastChoice = page.locator('#actions button').nth(before.actions.length - 1);
    await lastChoice.scrollIntoViewIfNeeded();
    await page.locator('.journal').evaluate(journal => { journal.scrollTop = journal.scrollHeight; });
    const scrollCheck = await page.evaluate(() => {
      const button = document.querySelector('#actions button:last-of-type'), journal = document.querySelector('.journal');
      const a = button.getBoundingClientRect(), b = journal.getBoundingClientRect();
      return { choiceVisible: a.top >= b.top && a.bottom <= b.bottom, choiceTop: a.top, choiceBottom: a.bottom,
        journalTop: b.top, journalBottom: b.bottom, scrollTop: journal.scrollTop };
    });
    if (!scrollCheck.choiceVisible) throw new Error(`Last E37 choice cannot be reached in the journal scroll area: ${JSON.stringify(scrollCheck)}`);
    await page.screenshot({ path: path.join(output, `household-tutor-last-choice-${viewport.width}x${viewport.height}.png`) });
    const recordBefore = await page.locator('#record').textContent();
    await choice.click();
    await page.waitForFunction(previous => document.querySelector('#record')?.textContent !== previous, recordBefore);
    const saved = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const after = game.loadGame(saved, { maps, hostCards: cards, quests: [quest] });
    const event = after.world.livingEventStates.E37, contract = after.world.householdTutorContract;
    if (event.stage !== expectedStage || contract?.status !== 'ACTIVE' || contract.weeklyPay !== weeklyPay
      || after.hosts.teacher_lyubov.money.amount !== eventState.hosts.teacher_lyubov.money.amount + weeklyPay
      || after.hosts.minor_noble_andrei.money.amount !== eventState.hosts.minor_noble_andrei.money.amount - weeklyPay
      || pageErrors.length || serverErrors.length) {
      throw new Error(`E37 choice did not persist: ${JSON.stringify({ stage: event.stage, contract, pageErrors, serverErrors })}`);
    }
    await page.screenshot({ path: path.join(output, `household-tutor-accepted-${viewport.width}x${viewport.height}.png`) });
    results.push({ viewport, actionId, stage: event.stage, weeklyPay,
      choiceCount: before.actions.length, horizontalOverflow: before.scrollWidth > before.width, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
if (serverErrors.length) throw new Error(`E37 preview server errors: ${serverErrors.join('')}`);
const report = { status: 'PASS', cases: results };
fs.writeFileSync(path.join(output, 'HOUSEHOLD_TUTOR_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
