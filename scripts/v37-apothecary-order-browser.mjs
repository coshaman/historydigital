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
const quest = read('rpg/quests/apothecary-order-1847.json');
const object = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
const objectTile = { x: object.x / 16, y: object.y / 16 };
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4202, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`E16 preview did not start: ${serverErrors.join('')}`); }

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
    const triggered = game.advanceNpcWorld(state, 25, maps);
    const readyState = structuredClone(triggered);
    readyState.world.currentMapId = 'market-quay'; readyState.player.embodiment = 'apothecary_yakov';
    readyState.player.position = { ...objectTile };
    readyState.hosts.apothecary_yakov.mapId = 'market-quay'; readyState.hosts.apothecary_yakov.position = { ...objectTile };
    readyState.hosts.warehouse_pyotr.mapId = 'market-quay';
    readyState.hosts.warehouse_pyotr.position = { x: objectTile.x + 1, y: objectTile.y };
    if (readyState.world.livingEventStates.E16?.stage !== 'SHORTAGE_FOUND') throw new Error('E16 did not reach the visible shortage stage');
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    await page.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(readyState));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-apothecary-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('야코프'), { timeout: 10000 });
    await page.keyboard.press('e');
    const orderLabel = '사적인 주문 메모를 남기고 꾸러미를 청한다';
    const order = page.getByRole('button', { name: orderLabel });
    await order.waitFor({ state: 'visible', timeout: 5000 });
    const ui = await page.evaluate(() => ({
      title: document.querySelector('#headline')?.textContent ?? '',
      choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      journalScrollHeight: document.querySelector('.journal')?.scrollHeight ?? 0,
    }));
    if (!ui.title.includes('비어 있는 약방 재고표') || ui.choices.length !== 2
      || !ui.choices[0].includes('사적인 주문 메모') || !ui.choices[0].includes('공식 장부에는 올리지 않습니다')
      || ui.scrollWidth > ui.width + 1) throw new Error(`E16 event UI is missing context or clipped: ${JSON.stringify(ui)}`);
    const lastChoice = page.locator('#actions button').last();
    await lastChoice.scrollIntoViewIfNeeded();
    await page.locator('.journal').evaluate(journal => { journal.scrollTop = journal.scrollHeight; });
    const reachable = await lastChoice.evaluate(button => {
      const a = button.getBoundingClientRect(), b = button.closest('.lower')?.getBoundingClientRect();
      return Boolean(b && a.top >= b.top && a.bottom <= b.bottom);
    });
    if (!reachable) throw new Error('E16 second choice cannot be reached inside the dialogue panel');
    await page.screenshot({ path: path.join(output, `apothecary-order-choices-${viewport.width}x${viewport.height}.png`) });
    const beforeRecord = await page.locator('#record').textContent();
    await order.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, beforeRecord);
    const saved = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const after = game.loadGame(saved, { maps, hostCards: cards, quests: [quest] });
    const event = after.world.livingEventStates.E16;
    if (event.stage !== 'ORDER_PLACED' || event.orderMethod !== 'PRIVATE_ORDER_NOTE'
      || after.hosts.apothecary_yakov.money.amount !== readyState.hosts.apothecary_yakov.money.amount
      || after.hosts.apothecary_yakov.inventory.includes(event.itemKo) || pageErrors.length || serverErrors.length) {
      throw new Error(`E16 UI choice did not persist correctly: ${JSON.stringify({ stage: event.stage, pageErrors, serverErrors })}`);
    }
    await page.screenshot({ path: path.join(output, `apothecary-order-placed-${viewport.width}x${viewport.height}.png`) });

    await page.getByRole('button', { name: '인물 목록' }).click();
    const pyotr = page.locator('#actions button').filter({ hasText: '표트르' });
    await pyotr.waitFor({ state: 'visible', timeout: 5000 });
    await pyotr.click();
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('표트르'), { timeout: 5000 });
    await page.keyboard.press('e');
    const handoffLabel = '꾸러미를 건네고 3코페이카를 받는다';
    const withholdLabel = '꾸러미를 내주지 않고 거래를 접는다';
    const nextChoiceLabel = viewport.width < 600 ? withholdLabel : handoffLabel;
    const nextChoice = page.getByRole('button', { name: nextChoiceLabel });
    await nextChoice.waitFor({ state: 'visible', timeout: 5000 });
    const supplierChoices = await page.locator('#actions button').allInnerTexts();
    if (supplierChoices.length !== 2 || !supplierChoices[0].includes('3코페이카')) {
      throw new Error(`E16 supplier choices did not disclose the immediate trade: ${JSON.stringify(supplierChoices)}`);
    }
    const beforeSupplierRecord = await page.locator('#record').textContent();
    await nextChoice.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, beforeSupplierRecord);
    const supplierSave = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const supplierAfter = game.loadGame(supplierSave, { maps, hostCards: cards, quests: [quest] });
    const supplierEvent = supplierAfter.world.livingEventStates.E16;
    if (pageErrors.length || serverErrors.length) throw new Error(`E16 supplier browser errors: ${JSON.stringify({ pageErrors, serverErrors })}`);
    if (viewport.width < 600) {
      if (supplierEvent.stage !== 'SUPPLY_WITHHELD'
        || supplierAfter.hosts.apothecary_yakov.money.amount !== readyState.hosts.apothecary_yakov.money.amount
        || !supplierAfter.hosts.warehouse_pyotr.inventory.includes(supplierEvent.itemKo)) {
        throw new Error(`E16 mobile withhold did not preserve the goods and money: ${supplierEvent.stage}`);
      }
    } else if (supplierEvent.stage !== 'DELIVERED'
      || supplierAfter.hosts.apothecary_yakov.money.amount !== readyState.hosts.apothecary_yakov.money.amount - 3
      || supplierAfter.hosts.warehouse_pyotr.money.amount !== readyState.hosts.warehouse_pyotr.money.amount + 3
      || !supplierAfter.hosts.apothecary_yakov.inventory.includes(supplierEvent.itemKo)) {
      throw new Error(`E16 desktop handoff did not transfer the bundle and payment: ${supplierEvent.stage}`);
    }
    await page.screenshot({ path: path.join(output, `apothecary-order-supplier-${viewport.width}x${viewport.height}.png`) });
    results.push({ viewport, stage: event.stage, orderMethod: event.orderMethod, choiceCount: ui.choices.length,
      journalScrollHeight: ui.journalScrollHeight, secondChoiceReachable: reachable,
      supplierChoice: nextChoiceLabel, supplierStage: supplierEvent.stage,
      horizontalOverflow: ui.scrollWidth > ui.width, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
if (serverErrors.length) throw new Error(`E16 preview server errors: ${serverErrors.join('')}`);
const report = { status: 'PASS', cases: results };
fs.writeFileSync(path.join(output, 'APOTHECARY_ORDER_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
