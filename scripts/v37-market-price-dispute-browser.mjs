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
const quest = readJson('rpg/quests/market-price-dispute-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4196, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`Market dispute preview failed to start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const interaction = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
    const start = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
    start.world.chapterId = 'V33_1847_PRINT'; start.world.date = '1847-06-01'; start.world.clockMinutes = 601;
    start.player.embodiment = null;
    const seller = start.hosts.market_nadezhda, buyer = start.hosts.porter_gavrila;
    const position = { x: interaction.x / 16, y: interaction.y / 16 };
    seller.mapId = 'market-quay'; seller.position = { ...position };
    buyer.mapId = 'market-quay'; buyer.position = { x: position.x + 1, y: position.y };
    buyer.needs.hunger = 94; buyer.money.amount = 10;
    buyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: 'BROWSER_E13_PURCHASE' };
    seller.marketStock['빵 한 묶음'] = 1;
    start.world.marketPriceModifiers['market_nadezhda:빵 한 묶음'] = 1;
    start.world.livingEventStates.E02 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E02',
      status: 'ACTIVE', stage: 'RESTOCKED', startedAtMinute: 540, restockedAtMinute: 600,
      buyerHostId: 'baker_fyodor', sellerHostId: 'market_nadezhda', supplierHostId: 'baker_fyodor',
      itemKo: '빵 한 묶음', basePrice: 1, currentPrice: 2, valueStatus: 'fictional_gameplay_balance',
      validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
    const purchase = game.advanceNpcWorld(start, 1, maps);
    if (purchase.world.livingEventStates.E13?.status !== 'ACTIVE') throw new Error('The adjusted-price purchase did not naturally open E13');
    const triggered = structuredClone(purchase);
    const controlled = { x: position.x, y: position.y };
    triggered.world.currentMapId = 'market-quay';
    triggered.hosts.porter_gavrila.mapId = 'market-quay'; triggered.hosts.porter_gavrila.position = { ...controlled };
    triggered.hosts.market_nadezhda.mapId = 'market-quay'; triggered.hosts.market_nadezhda.position = { x: controlled.x + 1, y: controlled.y };
    triggered.player.embodiment = 'porter_gavrila'; triggered.player.position = { ...controlled };
    await context.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(triggered));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-market-dispute-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('가브릴라'), { timeout: 10000 });
    await page.keyboard.press('e');
    const acceptButton = page.getByRole('button', { name: '빵을 가지고 거래를 마친다' });
    await acceptButton.waitFor({ state: 'visible' });
    await acceptButton.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!ui.choices.some(text => text.includes('이미 낸 돈은 돌려받지 않습니다')) || ui.scrollWidth > ui.width + 1) {
      throw new Error(`E13 choice disclosure or viewport failed: ${JSON.stringify(ui)}`);
    }
    await page.screenshot({ path: path.join(output, `market-price-dispute-choices-${viewport.width}x${viewport.height}.png`) });
    const previous = await page.locator('#record').textContent();
    await acceptButton.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previous);
    const stored = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const reloaded = game.loadGame(stored, { maps, hostCards: cards, quests: [quest] });
    if (reloaded.world.livingEventStates.E13.stage !== 'TRANSACTION_ACCEPTED' || pageErrors.length || serverErrors.length) {
      throw new Error(`E13 browser action failed: ${JSON.stringify({ stage: reloaded.world.livingEventStates.E13.stage, pageErrors, serverErrors })}`);
    }
    results.push({ viewport, choiceCount: ui.choices.length, stage: reloaded.world.livingEventStates.E13.stage,
      scrollWidth: ui.scrollWidth, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
const report = { status: 'PASS', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'MARKET_PRICE_DISPUTE_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
