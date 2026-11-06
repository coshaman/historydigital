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
const quest = read('rpg/quests/rent-notice-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4196;
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: path.resolve('dist-v33') }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
const deadline = Date.now() + 10000;
let ready = false;
while (Date.now() < deadline && !ready) {
  try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; }
  catch { await new Promise(resolve => setTimeout(resolve, 100)); }
}
if (!ready) { server.kill(); throw new Error(`Rent notice preview did not start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'courtyard' });
    state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 700;
    state.world.currentMapId = 'courtyard';
    state.hosts.tenant_mikhail.mapId = 'courtyard'; state.hosts.tenant_mikhail.position = { x: 11, y: 7 };
    state.hosts.landlady_polina.mapId = 'courtyard'; state.hosts.landlady_polina.position = { x: 13, y: 7 };
    state.player.position = { x: 11, y: 7 };
    state.world.livingEventStates.E26 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E26',
      status: 'ACTIVE', stage: 'NOTICE_POSTED', sourceEventId: 'E02', startedAtMinute: 700, closesAtMinute: 880,
      actorHostIds: ['tenant_mikhail', 'landlady_polina'], tenantHostId: 'tenant_mikhail', landlordHostId: 'landlady_polina',
      venueMapId: 'courtyard', scenePosition: { x: 12, y: 7 }, previousRent: 3, proposedRent: 4,
      valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
      validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
    const possessed = game.possessHost(state, 'tenant_mikhail', maps.courtyard);
    if (!possessed.ok) throw new Error(`Could not possess tenant: ${possessed.reason}`);
    await context.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v33-rpg-tutorial-stage', 'done');
    }, game.saveGame(possessed.state));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-rent-notice-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('미하일'));
    await page.keyboard.press('e');
    const holdChoice = page.getByRole('button', { name: '이번 납부일까지 이전 금액을 내겠다고 말한다' });
    await holdChoice.waitFor({ state: 'visible' });
    const surface = await page.evaluate(() => ({
      title: document.querySelector('#headline')?.textContent ?? '',
      choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      viewport: { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
      bodyScrollHeight: document.body.scrollHeight, viewportHeight: document.documentElement.clientHeight,
    }));
    if (surface.choices.length !== 3 || !surface.choices.some(text => text.includes('미하일과 폴리나가 압니다'))
      || !surface.choices.some(text => text.includes('안나에게 다음 대화에서 제안합니다'))
      || surface.viewport.scrollWidth > surface.viewport.width + 1
      || surface.bodyScrollHeight > surface.viewportHeight + 1) throw new Error(`Rent choice UI failed: ${JSON.stringify(surface)}`);
    await page.screenshot({ path: path.join(output, `rent-notice-choices-${viewport.width}x${viewport.height}.png`) });
    const beforeRecord = await page.locator('#record').textContent();
    await page.getByRole('button', { name: '다음 납부일부터 오른 방세를 내기로 한다' }).click();
    await page.waitForFunction(previous => document.querySelector('#record')?.textContent !== previous, beforeRecord);
    const saved = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const savedState = game.loadGame(saved, { maps, hostCards: cards, quests: [quest] });
    if (savedState.hosts.tenant_mikhail.housing.amount !== 4 || savedState.world.livingEventStates.E26.status !== 'RESOLVED'
      || pageErrors.length || serverErrors.length) throw new Error(`Rent decision did not persist: ${JSON.stringify({
        rent: savedState.hosts.tenant_mikhail.housing.amount, pageErrors, serverErrors,
      })}`);
    results.push({ viewport, choices: surface.choices.length, immediateDirectionVisible: true,
      rentAfterClick: savedState.hosts.tenant_mikhail.housing.amount, saved: true,
      horizontalOverflow: surface.viewport.scrollWidth > surface.viewport.width,
      bodyScrollHeight: surface.bodyScrollHeight, viewportHeight: surface.viewportHeight, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
const report = { status: 'PASS', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'RENT_NOTICE_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
