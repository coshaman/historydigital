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
const quest = read('rpg/quests/newspaper-release-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4212;
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: path.resolve('dist-v33') }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
try {
  const deadline = Date.now() + 10000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch {}
    if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`Preview server did not start: ${serverErrors.join('')}`);
  const browser = await chromium.launch({ headless: true }), results = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      let state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });
      state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 540;
      state.world.currentMapId = 'printshop';
      const printer = state.hosts.printer_ekaterina;
      printer.mapId = 'printshop'; printer.position = { x: 12, y: 10 };
      printer.knownEvidenceIds.push('LIT-TURGENEV-KHOR-KALYNYCH-1847');
      printer.inventory.push('newsprint_sheet', 'printing_ink');
      state.player.embodiment = printer.id; state.player.position = { ...printer.position };
      const civicLife = await import('../rpg/engine/civic-life.mjs');
      const published = civicLife.publishNewspaperIssue(state, { hostId: printer.id, storyId: 'LITERARY_RURAL_LIFE_1847' });
      if (!published.ok || published.state.world.livingEventStates.E22?.stage !== 'ISSUE_RELEASED')
        throw new Error(`The press did not release E22: ${published.reason ?? published.state.world.livingEventStates.E22?.stage}`);
      state = game.advanceNpcWorld(published.state, 1, maps);
      if (!state.ledger.at(-1).livingEvents.some(event => event.catalogEventId === 'E22' && event.stage === 'ISSUE_RELEASED'))
        throw new Error('The printed issue did not appear as an in-world release event');
      state.world.currentMapId = 'nevsky'; state.player.embodiment = null;
      const buyer = state.hosts.seamstress_anna, seller = state.hosts.bookseller_lev;
      buyer.mapId = seller.mapId = 'nevsky'; buyer.position = { x: 24, y: 14 }; seller.position = { x: 25, y: 15 };
      state.player.position = { ...buyer.position };
      const possessed = game.possessHost(state, buyer.id, maps.nevsky);
      if (!possessed.ok) throw new Error(`Could not possess buyer: ${possessed.reason}`);
      const sold = civicLife.purchaseCityProduct(possessed.state,
        { hostId: buyer.id, productId: 'newspaper_1847_01' });
      if (!sold.ok) throw new Error(`The physical newspaper sale failed: ${sold.reason}`);
      let staged = game.advanceNpcWorld(sold.state, 1, maps);
      if (staged.world.livingEventStates.E22?.stage !== 'DISCUSSION_OPEN')
        throw new Error(`The sale did not open the reader discussion: ${staged.world.livingEventStates.E22?.stage}`);
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage(), pageErrors = [];
      page.on('pageerror', error => pageErrors.push(String(error)));
      const requestFailures = [], badResponses = [];
      page.on('requestfailed', request => requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
      page.on('response', response => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
      const consoleWarnings = [];
      page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') consoleWarnings.push(message.text()); });
      const savedState = game.saveGame(staged);
      const directReload = game.loadGame(savedState, { maps, hostCards: cards, quests: [quest] });
      if (directReload.player.embodiment !== buyer.id)
        throw new Error(`E22 browser fixture lost its player before navigation: ${directReload.player.embodiment}`);
      await page.addInitScript(saved => {
        localStorage.setItem('v33-rpg-save', saved);
        localStorage.setItem('v34-tutorial-stage', 'done');
      }, savedState);
      await page.goto(`http://127.0.0.1:${port}/index.html#v37-newspaper-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent);
      const loadedBody = await page.locator('#bodyname').textContent();
      if (!loadedBody?.includes('안나')) throw new Error(`The saved newspaper route did not restore Anna: ${JSON.stringify({
        loadedBody, map: await page.locator('#mapname').textContent(), title: await page.title(), pageErrors, consoleWarnings,
        requestFailures, badResponses, resources: await page.evaluate(() => performance.getEntriesByType('resource').map(row => row.name).filter(name => /main\.js|game-state\.js/.test(name))),
        storedSaveLength: await page.evaluate(() => localStorage.getItem('v33-rpg-save')?.length ?? 0),
      })}`);
      await page.keyboard.press('e');
      await page.getByRole('button', { name: /자료 읽기.*호리와 칼리니치/ }).click();
      await page.locator('#source-reader').waitFor({ state: 'visible' });
      const sourceTitle = await page.locator('#source-reader-title').textContent();
      const sourceBody = await page.locator('#source-reader').innerText();
      if (!sourceTitle?.includes('호리와 칼리니치') || !sourceBody.includes('Хорь былъ человѣкъ положительный')
        || !sourceBody.includes('호리는 실리적이고 실제적이었으며'))
        throw new Error(`The full bilingual literary excerpt did not open: ${sourceTitle}`);
      await page.screenshot({ path: path.join(output, `newspaper-release-literary-passage-${viewport.width}x${viewport.height}.png`) });
      await page.locator('#source-reader-complete').click();
      await page.locator('#source-reader').waitFor({ state: 'hidden' });
      await page.keyboard.press('e');
      const keepPrivate = page.getByRole('button', { name: /읽은 대목을 혼자 간직한다/ });
      await keepPrivate.waitFor({ state: 'visible', timeout: 5000 }).catch(async () => {
        throw new Error(`The newspaper scene did not open: ${JSON.stringify(await page.evaluate(() => ({
          headline: document.querySelector('#headline')?.textContent,
          actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
          body: document.querySelector('#bodyname')?.textContent,
        })))}`);
      });
      await page.screenshot({ path: path.join(output, `newspaper-release-choices-top-${viewport.width}x${viewport.height}.png`) });
      await keepPrivate.scrollIntoViewIfNeeded();
      const surface = await page.evaluate(() => ({
        headline: document.querySelector('#headline')?.textContent ?? '',
        choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
        rect: (() => { const r = [...document.querySelectorAll('#actions button')].find(button => button.innerText.includes('혼자 간직한다'))?.getBoundingClientRect();
          return r ? { top: r.top, bottom: r.bottom } : null; })(),
      }));
      if (surface.choices.length !== 4 || !surface.choices.some(text => text.includes('호리와 칼리니치'))
        || surface.scrollWidth > surface.width + 1 || !surface.rect || surface.rect.top < 0 || surface.rect.bottom > viewport.height)
        throw new Error(`Newspaper choices are incomplete or clipped: ${JSON.stringify(surface)}`);
      await page.screenshot({ path: path.join(output, `newspaper-release-choices-${viewport.width}x${viewport.height}.png`) });
      const previous = await page.locator('#record').textContent();
      await keepPrivate.click();
      await page.waitForFunction(old => document.querySelector('#record')?.textContent !== old, previous);
      await page.locator('#save').click();
      const saved = game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests: [quest] });
      const event = saved.world.livingEventStates.E22;
      if (event.stage !== 'PRIVATE_READING' || event.resolutionActionId !== 'E22_KEEP_PRIVATE'
        || event.valueStatus !== 'fictional_gameplay_balance'
        || saved.world.periodicalDiscussionRecords.at(-1)?.passageSourceId !== 'LIT-TURGENEV-KHOR-KALYNYCH-1847'
        || pageErrors.length)
        throw new Error(`The newspaper choice did not persist: ${JSON.stringify({ stage: event.stage, pageErrors })}`);
      results.push({ viewport, choiceCount: surface.choices.length, immediateScopeVisible: true,
        resolution: event.stage, persisted: true, horizontalOverflow: surface.scrollWidth > surface.width, pageErrors: pageErrors.length });
      await context.close();
    }
  } finally { await browser.close(); }
  if (serverErrors.length) throw new Error(`Preview server reported errors: ${serverErrors.join('')}`);
  const report = { status: 'PASS', results };
  fs.writeFileSync(path.join(output, 'NEWSPAPER_RELEASE_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally { server.kill(); }
