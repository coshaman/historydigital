import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const maps = Object.fromEntries(fs.readdirSync('rpg/maps').filter(file => file.endsWith('.json'))
  .map(file => { const map = read(path.join('rpg/maps', file)); return [map.mapId, map]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => read(path.join('rpg/characters', file)));
const quest = read('rpg/quests/bookbinding-order-choice-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4199, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`Bookbinding preview did not start: ${serverErrors.join('')}`); }

const makeState = () => {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 660;
  state.world.currentMapId = 'market-quay'; state.player.embodiment = 'bookbinder_elizaveta';
  state.player.position = { x: 21, y: 14 }; state.quests[quest.id] = { status: 'open' };
  state.hosts.bookbinder_elizaveta.mapId = state.hosts.bookseller_lev.mapId = 'market-quay';
  state.hosts.bookbinder_elizaveta.position = { x: 21, y: 14 };
  state.hosts.bookseller_lev.position = { x: 22, y: 14 };
  state.hosts.bookbinder_elizaveta.inventory.push('제본 중인 책 한 권');
  state.world.livingEventStates.E08 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E08',
    status: 'ACTIVE', stage: 'BOOK_BOUND', startedAtMinute: 440, dayIndex: 0,
    binderHostId: 'bookbinder_elizaveta', booksellerHostId: 'bookseller_lev', itemKo: '제본 중인 책 한 권',
    contractTaskId: 'ELIZAVETA_BOOKBINDER_ORDER_TO_LEV_1847', valueStatus: 'fictional_gameplay_balance',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  return state;
};

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const scenario of [
    { id: 'deliver-desktop', actionId: 'E08_DELIVER_BOOK_NOW', width: 1440, height: 900,
      label: '레프에게 책을 넘기고 2코페이카를 받는다', disclosure: '납품 장부에 남습니다' },
    { id: 'defer-mobile', actionId: 'E08_DEFER_DELIVERY', width: 390, height: 844,
      label: '오늘은 가져가지 않고 내일 다시 온다', disclosure: '대금은 미뤄지고' },
  ]) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height },
      isMobile: scenario.width < 600, hasTouch: scenario.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    await page.addInitScript(saved => {
      if (!localStorage.getItem('v33-rpg-save')) localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v33-rpg-tutorial-stage', 'done');
    }, game.saveGame(makeState()));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-bookbinding-${scenario.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('엘리자베타'));
    await page.waitForFunction(title => document.querySelector('#mission-title')?.textContent?.includes(title), quest.titleKo);
    await page.keyboard.press('e');
    const button = page.getByRole('button', { name: scenario.label });
    await button.waitFor({ state: 'visible' });
    const choiceText = await button.innerText();
    const before = await page.evaluate(() => ({ width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth, visibleButtons: [...document.querySelectorAll('#actions button')]
        .filter(row => row.getBoundingClientRect().width > 0).length }));
    if (!choiceText.includes(scenario.disclosure) || before.scrollWidth > before.width + 1)
      throw new Error(`${scenario.id}: disclosure or viewport failed (${JSON.stringify({ choiceText, before })})`);
    await page.screenshot({ path: path.join(output, `bookbinding-${scenario.id}-${scenario.width}x${scenario.height}.png`) });
    const recordBefore = await page.locator('#record').textContent();
    await button.click();
    await page.waitForFunction(previous => document.querySelector('#record')?.textContent !== previous, recordBefore);
    const saved = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const state = game.loadGame(saved, { maps, hostCards: cards, quests: [quest] });
    const event = state.world.livingEventStates.E08;
    const expectedStage = scenario.actionId === 'E08_DELIVER_BOOK_NOW' ? 'DELIVERED_PAID' : 'BOOK_BOUND';
    if (event.stage !== expectedStage || event.playerDecision?.actionId !== scenario.actionId
      || (scenario.actionId === 'E08_DELIVER_BOOK_NOW'
        && (!state.hosts.bookseller_lev.inventory.includes(event.itemKo)
          || state.hosts.bookbinder_elizaveta.inventory.includes(event.itemKo)))) {
      throw new Error(`${scenario.id}: saved outcome mismatch (${JSON.stringify({ stage: event.stage,
        decision: event.playerDecision, pageErrors })})`);
    }
    if (pageErrors.length || serverErrors.length) throw new Error(`${scenario.id}: browser errors ${JSON.stringify({ pageErrors, serverErrors })}`);
    results.push({ id: scenario.id, viewport: { width: scenario.width, height: scenario.height },
      actionId: scenario.actionId, stage: event.stage, choiceText, visibleButtons: before.visibleButtons,
      scrollWidth: before.scrollWidth, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
const report = { status: results.length === 2 && results.every(result => result.pageErrors.length === 0)
  && serverErrors.length === 0, staticBuild: staticRoot, scenarios: results, serverErrors };
fs.writeFileSync(path.join(output, 'BOOKBINDING_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.status) process.exit(1);
