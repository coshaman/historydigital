import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const maps = Object.fromEntries(fs.readdirSync('rpg/maps').filter(file => file.endsWith('.json'))
  .map(file => { const map = readJson(path.join('rpg/maps', file)); return [map.mapId, map]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => readJson(path.join('rpg/characters', file)));
const quest = readJson('rpg/quests/market-price-dispute-1847.json');
const rentQuest = readJson('rpg/quests/rent-notice-1847.json');
const rumorQuest = readJson('rpg/quests/market-rumor-1847.json');
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
    const start = game.createInitialState({ maps, hostCards: cards, quests: [quest, rentQuest, rumorQuest],
      startMapId: 'market-quay', simulationSeed: 1847 });
    start.world.chapterId = 'V33_1847_PRINT'; start.world.date = '1847-06-01'; start.world.clockMinutes = 540;
    start.player.embodiment = null;
    const activeIds = ['baker_fyodor', 'market_nadezhda', 'porter_gavrila', 'street_vendor_matryona',
      'tenant_mikhail', 'landlady_polina', 'clerk_alexei'];
    for (const host of Object.values(start.hosts)) host.historicalAliveAndPresent = activeIds.includes(host.id);
    const seller = start.hosts.market_nadezhda, firstBuyer = start.hosts.porter_gavrila;
    const secondBuyer = start.hosts.street_vendor_matryona;
    const position = { x: interaction.x / 16, y: interaction.y / 16 };
    seller.mapId = 'market-quay'; seller.position = { ...position };
    seller.marketStock['빵 한 묶음'] = 1;
    start.world.marketPriceModifiers = {};
    start.world.livingEventStates.E02 = undefined;
    start.world.livingEventStates.E13 = undefined;
    start.world.livingEventStates.E26 = undefined;
    for (const buyer of [firstBuyer, secondBuyer]) {
      buyer.mapId = 'market-quay'; buyer.position = { x: position.x + (buyer.id === firstBuyer.id ? 1 : -1), y: position.y };
      buyer.needs.hunger = buyer.id === firstBuyer.id ? 94 : 20;
      buyer.needs.lastMealAtMinute = null; buyer.money.amount = 10;
      buyer.activeGoal = null;
    }
    firstBuyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: `FOOD:${seller.id}:빵 한 묶음` };
    start.hosts.baker_fyodor.mapId = 'market-quay';
    start.hosts.baker_fyodor.position = { x: position.x + 2, y: position.y };
    start.hosts.tenant_mikhail.mapId = 'courtyard'; start.hosts.tenant_mikhail.position = { x: 11, y: 7 };
    start.hosts.landlady_polina.mapId = 'courtyard'; start.hosts.landlady_polina.position = { x: 13, y: 7 };
    const stockout = game.advanceNpcWorld(start, 5, maps);
    if (stockout.world.livingEventStates.E02?.stage !== 'PRICE_NOTICE') throw new Error('Final-stock sale did not start E02');
    const restocked = game.advanceNpcWorld(stockout, 60, maps);
    if (restocked.world.livingEventStates.E02?.stage !== 'RESTOCKED') throw new Error('Scheduled bakery delivery did not restock E02');
    const restockBuyer = restocked.hosts.street_vendor_matryona;
    restockBuyer.mapId = 'market-quay'; restockBuyer.position = { x: position.x - 1, y: position.y };
    restockBuyer.needs.hunger = 94; restockBuyer.needs.lastMealAtMinute = null;
    restockBuyer.activeGoal = { type: 'PURCHASE_MEAL', targetHostId: seller.id, taskId: `FOOD:${seller.id}:빵 한 묶음` };
    const purchase = game.advanceNpcWorld(restocked, 5, maps);
    const event = purchase.world.livingEventStates.E13;
    if (purchase.world.livingEventStates.E02?.stage !== 'RESOLVED' || event?.status !== 'ACTIVE') {
      throw new Error('Natural adjusted-price purchase did not open E13');
    }
    const triggered = structuredClone(purchase);
    const buyer = triggered.hosts[event.buyerHostId], controlled = { x: position.x, y: position.y };
    triggered.world.currentMapId = 'market-quay';
    buyer.mapId = 'market-quay'; buyer.position = { ...controlled };
    triggered.hosts.market_nadezhda.mapId = 'market-quay'; triggered.hosts.market_nadezhda.position = { x: controlled.x + 1, y: controlled.y };
    triggered.player.embodiment = buyer.id; triggered.player.position = { ...controlled };
    await context.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(triggered));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-market-dispute-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('#bodyname')?.textContent?.trim()), { timeout: 10000 });
    // The actual first-run onboarding requires walking before it enables world interactions.
    // Complete that tutorial in the browser, then return to the market tile before E.
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(220);
    }
    await page.waitForFunction(() => document.querySelector('#journal-quest-title')?.textContent?.includes('값이 오른 뒤의 거래'), { timeout: 3000 });
    await page.keyboard.press('e');
    const actionId = viewport.width > 600 ? 'E13_FILE_PRICE_COMPLAINT' : 'E13_ACCEPT_TRANSACTION';
    const action = quest.actions.find(row => row.id === actionId);
    const choiceButton = page.getByRole('button', { name: action.labelKo });
    await page.waitForTimeout(750);
    if (!(await choiceButton.isVisible())) {
      const renderedActions = await page.locator('#actions').innerText();
      const currentSave = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
      const currentState = game.loadGame(currentSave, { maps, hostCards: cards, quests: [quest, rentQuest, rumorQuest] });
      await page.screenshot({ path: path.join(output, `market-natural-chain-debug-${viewport.width}x${viewport.height}.png`) });
      throw new Error(`Natural E13 choice is not visible: ${JSON.stringify({ actionId, renderedActions,
        body: await page.locator('#bodyname').innerText(),
        record: await page.locator('#record').innerText(),
        embodiment: currentState.player.embodiment, event: currentState.world.livingEventStates.E13,
        eligible: questChoices(quest, currentState.player.embodiment, [], currentState).map(item => item.action.id) })}`);
    }
    await choiceButton.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!ui.choices.some(text => text.includes(action.subcopyKo)) || ui.scrollWidth > ui.width + 1) {
      throw new Error(`E13 choice disclosure or viewport failed: ${JSON.stringify(ui)}`);
    }
    await page.screenshot({ path: path.join(output, `market-price-dispute-choices-${viewport.width}x${viewport.height}.png`) });
    const previous = await page.locator('#record').textContent();
    await choiceButton.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previous);
    const stored = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const reloaded = game.loadGame(stored, { maps, hostCards: cards, quests: [quest, rentQuest, rumorQuest] });
    const rumor = reloaded.world.livingEventStates.E23;
    const branchFailed = actionId === 'E13_FILE_PRICE_COMPLAINT'
      ? reloaded.world.livingEventStates.E13.stage !== 'REPORT_FILED' || rumor?.stage !== 'RUMOR_ACTIVE'
        || rumor.sourceCatalogEventId !== 'E13'
        || !reloaded.world.rumorPropagationLog.some(row => row.eventId === 'E23'
          && row.recipientHostId === 'street_vendor_matryona' && row.status === 'UNVERIFIED')
        || !reloaded.hosts.street_vendor_matryona.knownRumors.some(row => row.eventId === 'E23' && row.status === 'UNVERIFIED')
      : reloaded.world.livingEventStates.E13.stage !== 'TRANSACTION_ACCEPTED' || Boolean(rumor);
    if (branchFailed || pageErrors.length || serverErrors.length) {
      throw new Error(`Natural market-chain browser action failed: ${JSON.stringify({ actionId,
        E02: reloaded.world.livingEventStates.E02?.stage, E13: reloaded.world.livingEventStates.E13?.stage,
        E23: rumor?.stage, pageErrors, serverErrors })}`);
    }
    await page.screenshot({ path: path.join(output, `market-natural-chain-result-${viewport.width}x${viewport.height}.png`) });
    results.push({ viewport, choiceCount: ui.choices.length, actionId, E02: reloaded.world.livingEventStates.E02.stage,
      E13: reloaded.world.livingEventStates.E13.stage, E23: rumor?.stage ?? null,
      saveLoadParity: game.stateHash(reloaded) === game.stateHash(game.loadGame(game.saveGame(reloaded), { maps, hostCards: cards,
        quests: [quest, rentQuest, rumorQuest] })), scrollWidth: ui.scrollWidth, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
const report = { status: 'PASS', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'MARKET_PRICE_DISPUTE_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
