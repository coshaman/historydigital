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
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json')).map(file => readJson(path.join('rpg/characters', file)));
const quest = readJson('rpg/quests/pavel-missing-parcel-1847.json');
const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });
state.player.position = { ...state.hosts.courier_pavel.position };
const possessed = game.possessHost(state, 'courier_pavel', maps.nevsky);
if (!possessed.ok) throw new Error(`Could not possess courier for browser fixture: ${possessed.reason}`);
let missed = game.advanceNpcWorld(possessed.state, 120, maps);
if (missed.world.livingEventStates.E05?.stage !== 'PARCEL_MISSING') throw new Error('The authored courier deadline did not create the parcel scene');
missed.world.currentMapId = 'printshop';
missed.player.position = { x: 10, y: 13 };
missed.hosts.courier_pavel.mapId = 'printshop';
missed.hosts.courier_pavel.position = { x: 10, y: 13 };
const savedFixture = game.saveGame(missed);

const port = 4191, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`Static preview did not start: ${serverErrors.join('')}`); }

const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const mobile = process.argv.includes('--mobile');
const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const viewportLabel = `${viewport.width}x${viewport.height}`;
const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
const page = await context.newPage();
const pageErrors = [];
const consoleWarnings = [];
page.on('pageerror', error => pageErrors.push(String(error)));
page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') consoleWarnings.push(message.text()); });
let report;
try {
  await context.addInitScript(value => { if (!localStorage.getItem('v33-rpg-save')) localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v33-rpg-tutorial-stage', 'done'); }, savedFixture);
  await page.goto(`http://127.0.0.1:${port}/index.html#v37-e05-parcel`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#world');
  await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('파벨'), null, { timeout: 5000 });
  const initial = await page.evaluate(() => ({ map: document.querySelector('#mapname')?.textContent,
    body: document.querySelector('#bodyname')?.textContent, width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth, url: location.href, title: document.title,
    saved: localStorage.getItem('v33-rpg-save')?.length ?? 0,
    savedEmbodiment: (() => { try { return JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.player?.embodiment ?? null; } catch { return 'invalid'; } })() }));
  if (!initial.map?.includes('인쇄소') || initial.scrollWidth > initial.width + 1) throw new Error(`Unexpected parcel scene viewport/map: ${JSON.stringify({ initial, consoleWarnings })}`);
  await page.locator('#use').click();
  const actionButtons = page.locator('#actions button');
  await actionButtons.filter({ hasText: '문 앞의 봉투를 찾아 다시 맡는다' }).waitFor({ state: 'visible', timeout: 3000 });
  const choices = await actionButtons.allTextContents();
  if (!choices.some(text => text.includes('늦은 사정')) || !choices.some(text => text.includes('봉인은 열지 않습니다'))) {
    throw new Error(`Immediate choice disclosure missing: ${JSON.stringify(choices)}`);
  }
  await page.screenshot({ path: path.join(output, `parcel-event-before-choice-${viewportLabel}.png`) });
  await actionButtons.filter({ hasText: '문 앞의 봉투를 찾아 다시 맡는다' }).click();
  await page.locator('#save').click();
  const afterAction = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
    return { stage: stored.world.livingEventStates.E05.stage, status: stored.world.livingEventStates.E05.status,
      courierHasParcel: stored.hosts.courier_pavel.inventory.includes('밀봉 봉투'),
      questStatus: stored.quests.PAVEL_MISSING_PARCEL_1847.status,
      headline: document.querySelector('#headline')?.textContent, journal: document.querySelector('#journal-text')?.textContent,
      record: document.querySelector('#record')?.textContent, choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText) };
  });
  if (afterAction.stage !== 'RECOVERED_BY_COURIER' || !afterAction.courierHasParcel || afterAction.questStatus !== 'resolved') {
    throw new Error(`Clicked recovery did not change persistent world state: ${JSON.stringify(afterAction)}`);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#mapname')?.textContent?.includes('인쇄소')
    && document.querySelector('#bodyname')?.textContent?.includes('파벨'), null, { timeout: 5000 });
  const afterReload = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
    return { stage: stored.world.livingEventStates.E05.stage, questStatus: stored.quests.PAVEL_MISSING_PARCEL_1847.status,
      map: document.querySelector('#mapname')?.textContent, body: document.querySelector('#bodyname')?.textContent,
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  await page.screenshot({ path: path.join(output, `parcel-event-after-recovery-${viewportLabel}.png`) });
  if (afterReload.stage !== 'RECOVERED_BY_COURIER' || afterReload.questStatus !== 'resolved'
    || !afterReload.map?.includes('인쇄소') || !afterReload.body?.includes('파벨') || afterReload.scrollWidth > afterReload.width + 1
    || pageErrors.length || serverErrors.length || consoleWarnings.length) {
    throw new Error(`Parcel click/save/reload acceptance failed: ${JSON.stringify({ afterReload, pageErrors, consoleWarnings, serverErrors })}`);
  }
  report = { status: 'PASS', viewport: { ...initial, mobile }, physicalObjectClicked: true, visibleImmediateChoices: choices.length,
    chosenOutcome: afterAction, saveReload: afterReload, pageErrors, serverErrors };
} finally {
  await context.close();
  await browser.close();
  server.kill();
}
fs.writeFileSync(path.join(output, `PARCEL_EVENT_BROWSER_ACCEPTANCE-${viewportLabel}.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
