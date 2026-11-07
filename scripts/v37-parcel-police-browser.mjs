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
  .map(file => { const row = read(path.join('rpg/maps', file)); return [row.mapId, row]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => read(path.join('rpg/characters', file)));
const parcelQuest = read('rpg/quests/pavel-missing-parcel-1847.json');
const policeQuest = read('rpg/quests/police-document-check-1847.json');
const quests = [parcelQuest, policeQuest];
const initial = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
initial.world.chapterId = 'V33_1847_PRINT';
initial.world.date = '1847-06-01';
const possessed = game.possessHost(initial, 'courier_pavel', maps.nevsky);
if (!possessed.ok) throw new Error(`Could not possess courier: ${possessed.reason}`);
const missed = game.advanceNpcWorld(possessed.state, 120, maps);
if (missed.world.livingEventStates.E05?.stage !== 'PARCEL_MISSING') throw new Error('The missed delivery did not create E05');
missed.world.currentMapId = 'printshop';
missed.hosts.courier_pavel.mapId = 'printshop';
missed.hosts.courier_pavel.position = { x: 10, y: 13 };
missed.player.position = { x: 10, y: 13 };

const port = 4198;
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: path.resolve('dist-v33') },
  stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
const readyDeadline = Date.now() + 10000;
let ready = false;
while (Date.now() < readyDeadline && !ready) {
  try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; }
  catch { await new Promise(resolve => setTimeout(resolve, 100)); }
}
if (!ready) { server.kill(); throw new Error(`Static preview failed to start: ${serverErrors.join('')}`); }

const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const mobile = viewport.width < 500;
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') pageErrors.push(`console: ${message.text()}`); });
    try {
      await context.addInitScript(saved => {
        localStorage.setItem('v33-rpg-save', saved);
        localStorage.setItem('v34-tutorial-stage', 'done');
      }, game.saveGame(missed));
      await page.goto(`http://127.0.0.1:${port}/index.html#v37-parcel-police-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#world');
      await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('파벨'));
      await page.locator('#use').click();
      let buttons = page.locator('#actions button');
      const reportChoice = buttons.filter({ hasText: '봉투를 찾지 못했다고 인쇄소에 알린다' });
      await reportChoice.waitFor({ state: 'visible', timeout: 5000 });
      const parcelChoices = await buttons.allTextContents();
      if (!parcelChoices.some(text => text.includes('공식 업무 기록에 남습니다'))
        || !parcelChoices.some(text => text.includes('봉인은 열지 않습니다'))) {
        throw new Error(`E05 action disclosure missing at ${label}: ${JSON.stringify(parcelChoices)}`);
      }
      await page.screenshot({ path: path.join(output, `parcel-police-e05-choices-${label}.png`) });
      await reportChoice.click();
      await page.locator('#save').click();

      const reportState = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
      let world = game.loadGame(reportState, { maps, hostCards: cards, quests });
      if (world.world.livingEventStates.E05?.stage !== 'LOSS_REPORTED') throw new Error('E05 report click did not persist');
      const released = game.releaseHost(world, maps[world.world.currentMapId]);
      if (!released.ok) throw new Error(`Courier could not resume autonomous travel: ${released.reason}`);
      world = released.state;
      for (let elapsed = 0; elapsed < 360 && world.world.livingEventStates.E25?.stage !== 'INTERVIEW_READY'; elapsed += 30) {
        world = game.advanceNpcWorld(world, 30, maps);
      }
      const followup = world.world.livingEventStates.E25;
      if (followup?.stage !== 'INTERVIEW_READY' || followup.sourceEventId !== 'E05'
        || world.hosts.courier_pavel.mapId !== 'police-station'
        || world.hosts.police_sergeant_ivan.mapId !== 'police-station') {
        throw new Error(`E05 did not cause a physical E25 meeting at ${label}: ${JSON.stringify({ followup,
          clock: world.world.clockMinutes, courier: { mapId: world.hosts.courier_pavel.mapId,
            position: world.hosts.courier_pavel.position, goal: world.hosts.courier_pavel.activeGoal },
          officer: { mapId: world.hosts.police_sergeant_ivan.mapId,
            position: world.hosts.police_sergeant_ivan.position, goal: world.hosts.police_sergeant_ivan.activeGoal } })}`);
      }
      world.world.currentMapId = 'police-station';
      world.player.position = { ...world.hosts.courier_pavel.position };
      const embodied = game.possessHost(world, 'courier_pavel', maps['police-station']);
      if (!embodied.ok) throw new Error(`Could not return to courier for E25: ${embodied.reason}`);
      world = embodied.state;
      const preflightReload = game.loadGame(game.saveGame(world), { maps, hostCards: cards, quests });
      if (preflightReload.world.currentMapId !== 'police-station' || preflightReload.player.embodiment !== 'courier_pavel')
        throw new Error(`E25 save did not preserve the on-scene player: ${preflightReload.world.currentMapId}/${preflightReload.player.embodiment}`);
      const policeContext = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
      const policePage = await policeContext.newPage();
      policePage.on('pageerror', error => pageErrors.push(String(error)));
      policePage.on('console', message => { if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`); });
      await policeContext.addInitScript(saved => {
        localStorage.setItem('v33-rpg-save', saved);
        localStorage.setItem('v34-tutorial-stage', 'done');
      }, game.saveGame(world));
      await policePage.goto(`http://127.0.0.1:${port}/index.html#v37-parcel-police-e25-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await policePage.waitForSelector('#world');
      await policePage.locator('#load').click();
      await policePage.waitForFunction(() => document.querySelector('#mapname')?.textContent?.trim()
        && document.querySelector('#bodyname')?.textContent?.trim(), null, { timeout: 5000 });
      const resumedUi = await policePage.evaluate(() => ({ map: document.querySelector('#mapname')?.textContent,
        body: document.querySelector('#bodyname')?.textContent,
        savedMap: (() => { try { return JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.currentMapId; }
          catch { return 'invalid'; } })(), savedBody: (() => { try { return JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.player?.embodiment; }
          catch { return 'invalid'; } })() }));
      if (!resumedUi.map?.includes('경찰 접수실') || !resumedUi.body?.includes('파벨'))
        throw new Error(`E25 scene did not restore in browser: ${JSON.stringify({ resumedUi, pageErrors })}`);
      let browserState = game.loadGame(await policePage.evaluate(() => localStorage.getItem('v33-rpg-save')),
        { maps, hostCards: cards, quests });
      const objectTile = { x: 5, y: 3 };
      const moveKeys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
      for (let moves = 0; moves < 8; moves += 1) {
        const position = browserState.player.position;
        if (Math.abs(position.x - objectTile.x) + Math.abs(position.y - objectTile.y) <= 1) break;
        const directions = [
          ...(position.y > objectTile.y ? ['up'] : position.y < objectTile.y ? ['down'] : []),
          ...(position.x > objectTile.x ? ['left'] : position.x < objectTile.x ? ['right'] : []),
        ];
        let moved = false;
        for (const direction of directions) {
          const expected = game.moveActor(browserState, direction, maps['police-station']);
          if (!expected.moved) continue;
          await policePage.keyboard.press(moveKeys[direction]);
          await policePage.locator('#save').click();
          browserState = game.loadGame(await policePage.evaluate(() => localStorage.getItem('v33-rpg-save')),
            { maps, hostCards: cards, quests });
          if (browserState.player.position.x !== expected.state.player.position.x
            || browserState.player.position.y !== expected.state.player.position.y) {
            throw new Error(`Browser movement diverged from game rules: ${direction}`);
          }
          moved = true;
          break;
        }
        if (!moved) throw new Error(`Courier cannot reach the police desk from ${JSON.stringify(position)}`);
      }
      const approach = browserState.player.position;
      if (Math.abs(approach.x - objectTile.x) + Math.abs(approach.y - objectTile.y) > 1)
        throw new Error(`Player movement did not reach the police desk: ${JSON.stringify(approach)}`);
      await policePage.locator('#use').click();
      buttons = policePage.locator('#actions button');
      const registerChoice = buttons.filter({ hasText: '배달 경로와 시각을 접수 장부에 덧붙인다' });
      await registerChoice.waitFor({ state: 'visible', timeout: 5000 });
      const policeChoices = await buttons.allTextContents();
      if (policeChoices.length !== 3 || !policeChoices.some(text => text.includes('경찰 접수 장부에 남습니다'))
        || !policeChoices.some(text => text.includes('장부에는 새 항목을 남기지 않습니다'))) {
        throw new Error(`E25 choices/disclosure missing at ${label}: ${JSON.stringify(policeChoices)}`);
      }
      await policePage.screenshot({ path: path.join(output, `parcel-police-e25-choices-${label}.png`) });
      await registerChoice.click();
      await policePage.locator('#save').click();
      const savedResult = await policePage.evaluate(() => localStorage.getItem('v33-rpg-save'));
      const completed = game.loadGame(savedResult, { maps, hostCards: cards, quests });
      const event = completed.world.livingEventStates.E25;
      if (event?.stage !== 'ROUTE_ENTERED' || event.sourceEventId !== 'E05'
        || event.recordScope !== 'POLICE_INTAKE_REGISTER' || !Number.isInteger(event.officialRecordNumber)) {
        throw new Error(`E25 click did not create the linked official record at ${label}: ${JSON.stringify(event)}`);
      }
      await policePage.reload({ waitUntil: 'domcontentloaded' });
      await policePage.waitForFunction(() => document.querySelector('#mapname')?.textContent?.includes('경찰 접수실'));
      const display = await policePage.evaluate(() => ({ width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth, text: document.querySelector('#record')?.textContent ?? '' }));
      if (display.scrollWidth > display.width + 1 || pageErrors.length || serverErrors.length) {
        throw new Error(`E05→E25 browser/save route failed at ${label}: ${JSON.stringify({ display, pageErrors, serverErrors })}`);
      }
      results.push({ viewport, e05: 'LOSS_REPORTED', e25: event.stage, sourceEventId: event.sourceEventId,
        recordScope: event.recordScope, choiceCount: policeChoices.length, scrollWidth: display.scrollWidth,
        pageErrors: [...pageErrors] });
      await policeContext.close();
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
const report = { status: 'PASS', causalChain: ['E05', 'E25'], cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'PARCEL_POLICE_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
