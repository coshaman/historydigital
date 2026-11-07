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
const rumorQuest = read('rpg/quests/market-rumor-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4203;
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
      const state = game.createInitialState({ maps, hostCards: cards, quests: [rumorQuest], startMapId: 'printshop' });
      state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 600;
      state.world.currentMapId = 'printshop';
      const editor = state.hosts.editor_sofia;
      editor.mapId = 'printshop'; editor.position = { x: 15, y: 9 };
      state.player.position = { x: 15, y: 9 };
      state.world.livingEventStates.E23 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E23',
        status: 'RESOLVED', stage: 'EDITORIAL_NOTE_TAKEN', trigger: 'official_price_check_request_repeated_as_public_accusation',
        sourceCatalogEventId: 'E13', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
        occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', valueStatus: 'fictional_gameplay_balance',
        startedAtMinute: 540, autoResolveAtMinute: 630, resolvedAtMinute: 600, carrierHostId: 'street_vendor_matryona',
        clerkHostId: 'clerk_alexei', sellerHostId: 'market_nadezhda', actorHostIds: ['street_vendor_matryona', 'clerk_alexei'],
        witnessHostIds: ['porter_gavrila'], scenePosition: { x: 15, y: 10 }, rumorClaimKo: '상인이 빵을 숨기고 값을 두 배로 받았다는 말',
        claimStatus: 'UNVERIFIED', rumorReachedHostIds: [], correctionReachedHostIds: [], resolutionActionId: 'E23_SEND_TO_PRESS',
        editorialNote: { sourceId: 'V37-E23-MARKET-RUMOR', editorHostId: editor.id, witnessHostIds: ['porter_gavrila'],
          claimStatus: 'UNVERIFIED', takenAtMinute: 600 } };
      editor.inventory.push('editorial-note:E23', 'newsprint_sheet', 'printing_ink');
      editor.knownRumors = [{ eventId: 'E23', sourceEventId: 'E13', status: 'UNVERIFIED', fromHostId: 'street_vendor_matryona', atMinute: 600, recordNumber: null }];
      const possessed = game.possessHost(state, editor.id, maps.printshop);
      if (!possessed.ok) throw new Error(`Could not possess the newspaper editor: ${possessed.reason}`);
      const initialSave = game.saveGame(possessed.state);
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage(), pageErrors = [];
      page.on('pageerror', error => pageErrors.push(String(error)));
      await page.addInitScript(saved => {
        if (!localStorage.getItem('v33-rpg-save')) localStorage.setItem('v33-rpg-save', saved);
        localStorage.setItem('v34-tutorial-stage', 'done');
      }, initialSave);
      await page.goto(`http://127.0.0.1:${port}/index.html#v37-market-note-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('소피야'));
      await page.keyboard.press('e');
      const print = page.getByRole('button', { name: /호외 인쇄 · 장터의 빵값, 말과 장부/ });
      if (!await print.isVisible().catch(() => false)) {
        throw new Error(`Market-note print action did not appear: ${JSON.stringify(await page.evaluate(() => ({
          actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
          record: document.querySelector('#record')?.textContent, headline: document.querySelector('#headline')?.textContent,
        })))}`);
      }
      await print.waitFor({ state: 'visible' });
      const surface = await page.evaluate(() => ({ width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth, buttonCount: document.querySelectorAll('#actions button').length,
        printRect: (() => { const r = [...document.querySelectorAll('#actions button')].find(button => button.innerText.includes('장터의 빵값'))?.getBoundingClientRect();
          return r ? { top: r.top, bottom: r.bottom } : null; })() }));
      if (surface.scrollWidth > surface.width + 1 || !surface.printRect || surface.printRect.top < 0 || surface.printRect.bottom > viewport.height)
        throw new Error(`Market-note print choice overflowed: ${JSON.stringify(surface)}`);
      await page.screenshot({ path: path.join(output, `market-rumor-press-${viewport.width}x${viewport.height}.png`) });
      await print.click();
      await page.waitForFunction(() => document.querySelector('#headline')?.textContent === '거리 신문을 인쇄했다');
      await page.locator('#save').click();
      let saved = game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests: [rumorQuest] });
      const event = saved.world.livingEventStates.E23, issue = saved.player.civic.publishedIssues[0];
      if (event.stage !== 'NEWSPAPER_PRINTED' || issue?.sourceEventId !== 'E13' || issue.claimStatus !== 'UNVERIFIED'
        || !saved.hosts.editor_sofia.inventory.includes(`newspaper_issue:${issue.id}`) || pageErrors.length)
        throw new Error(`Printed issue did not preserve the event trail: ${JSON.stringify({ stage: event.stage, issue, pageErrors })}`);
      const readButton = page.getByRole('button', { name: /새 호를 읽는다/ });
      await readButton.click();
      await page.waitForFunction(() => document.querySelector('#headline')?.textContent === '장터의 빵값, 말과 장부');
      const articleSurface = await page.evaluate(() => {
        const journal = document.querySelector('.journal'), text = document.querySelector('#journal-text');
        const frame = journal.getBoundingClientRect(), body = text.getBoundingClientRect();
        return { missionHidden: document.querySelector('#mission-tracker')?.hidden,
          article: text?.textContent, articleTop: body.top, articleBottom: body.bottom,
          journalTop: frame.top, journalBottom: frame.bottom, scrollTop: journal.scrollTop };
      });
      if (!articleSurface.missionHidden || !articleSurface.article?.includes('아직 확인되지 않은 소문')
        || articleSurface.articleTop < articleSurface.journalTop || articleSurface.articleBottom > articleSurface.journalBottom + 1)
        throw new Error(`Printed article is not readable in the journal surface: ${JSON.stringify(articleSurface)}`);
      await page.locator('#save').click();
      saved = game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests: [rumorQuest] });
      if (!saved.world.livingEventStates.E23.newspaperReaderHostIds.includes('editor_sofia') || pageErrors.length)
        throw new Error(`The editor could not read the newly printed story: ${JSON.stringify({ readers: saved.world.livingEventStates.E23.newspaperReaderHostIds, pageErrors })}`);
      await page.screenshot({ path: path.join(output, `market-rumor-printed-${viewport.width}x${viewport.height}.png`) });
      results.push({ viewport, printed: event.stage, rumorStatus: issue.claimStatus, articleVisible: true,
        horizontalOverflow: surface.scrollWidth > surface.width, pageErrors: pageErrors.length });
      await context.close();
    }
  } finally { await browser.close(); }
  if (serverErrors.length) throw new Error(`Preview server reported errors: ${serverErrors.join('')}`);
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally { server.kill(); }
