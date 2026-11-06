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
const quest = readJson('rpg/quests/market-day-work-1847.json');
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
if (!ready) { server.kill(); throw new Error(`E32 preview failed to start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const entry = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
    const position = { x: entry.x / 16, y: entry.y / 16 };
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
    state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 600;
    state.world.currentMapId = 'market-quay'; state.player.embodiment = 'market_nadezhda'; state.player.position = { x: position.x + 1, y: position.y };
    const worker = state.hosts.tenant_mikhail, employer = state.hosts.market_nadezhda;
    worker.mapId = employer.mapId = 'market-quay';
    worker.position = { x: position.x - 1, y: position.y }; employer.position = { x: position.x + 1, y: position.y };
    state.world.livingEventStates.E32 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E32',
      status: 'ACTIVE', stage: 'OFFER_READY', trigger: 'low_cash_day_laborer_seeks_a_market_shift',
      startedAtMinute: 540, gatheredAtMinute: 600, offerExpiresAtMinute: 720,
      workerHostId: worker.id, employerHostId: employer.id, actorHostIds: [worker.id, employer.id], witnessHostIds: [],
      venueMapId: 'market-quay', scenePosition: position, resolutionActionId: null };
    await context.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(state));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-market-work-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('나데즈다'), { timeout: 10000 });
    await page.keyboard.press('e');
    const hireButton = page.getByRole('button', { name: '상자 나르기를 2코페이카에 맡긴다' });
    await hireButton.waitFor({ state: 'visible' });
    await hireButton.scrollIntoViewIfNeeded();
    const referralButton = page.getByRole('button', { name: /인쇄소의 일감을 알아보라고 소개한다/ });
    await page.locator('.journal').evaluate(journal => { journal.scrollTop = journal.scrollHeight; });
    const scrollMetrics = await referralButton.evaluate(button => {
      const journal = document.querySelector('.journal'), box = button.getBoundingClientRect(), viewport = journal.getBoundingClientRect();
      return { inside: box.top >= viewport.top && box.bottom <= viewport.bottom, scrollTop: journal.scrollTop,
        scrollHeight: journal.scrollHeight, clientHeight: journal.clientHeight };
    });
    if ((!scrollMetrics.inside || scrollMetrics.scrollTop <= 0) && viewport.width < 600)
      throw new Error(`E32 choices must scroll within the journal at ${viewport.width}px: ${JSON.stringify(scrollMetrics)}`);
    await page.locator('.journal').evaluate(journal => { journal.scrollTop = 0; });
    await hireButton.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!ui.choices.some(text => text.includes('2코페이카')) || !ui.choices.some(text => text.includes('피로가 쌓입니다'))
      || ui.scrollWidth > ui.width + 1) throw new Error(`E32 choice disclosure or viewport failed: ${JSON.stringify(ui)}`);
    await page.screenshot({ path: path.join(output, `market-day-work-choices-${viewport.width}x${viewport.height}.png`) });
    const previous = await page.locator('#record').textContent();
    await hireButton.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previous);
    const stored = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const reloaded = game.loadGame(stored, { maps, hostCards: cards, quests: [quest] });
    const event = reloaded.world.livingEventStates.E32;
    if (event.stage !== 'HEAVY_LOADING_PAID' || reloaded.hosts.market_nadezhda.money.amount !== employer.money.amount - 2
      || reloaded.hosts.tenant_mikhail.money.amount !== worker.money.amount + 2 || pageErrors.length || serverErrors.length) {
      throw new Error(`E32 browser action failed: ${JSON.stringify({ stage: event.stage, pageErrors, serverErrors })}`);
    }
    results.push({ viewport, visibleChoices: ui.choices.length, stage: event.stage, scrollWidth: ui.scrollWidth, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
const report = { status: 'PASS', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'MARKET_DAY_WORK_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
