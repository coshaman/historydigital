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
const quests = [read('rpg/quests/v37-manuscript-offer-1847.json')];
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4199;
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
    let prepared = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'bookshop-interior' });
    prepared.world.chapterId = 'V33_1847_PRINT'; prepared.world.date = '1847-06-01'; prepared.world.clockMinutes = 900;
    prepared.world.currentMapId = 'bookshop-interior'; prepared.player.embodiment = null;
    prepared.world.livingEventStates.E24 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E24',
      status: 'RESOLVED', stage: 'UNATTENDED_DISCUSSION', studentHostId: 'student_vasily', organizerHostId: 'reader_darya',
      actorHostIds: ['student_vasily', 'reader_darya'], witnessHostIds: [], venueMapId: 'courtyard', scenePosition: { x: 15, y: 13 } };
    prepared = game.advanceNpcWorld(prepared, 1, maps);
    for (let minute = 0; minute < 180 && prepared.world.livingEventStates.E30.stage === 'OFFER_POSTED'; minute += 1) {
      prepared = game.advanceNpcWorld(prepared, 1, maps);
    }
    if (prepared.world.livingEventStates.E30.stage !== 'REVIEW_READY') throw new Error('NPCs did not gather for the manuscript offer');
    prepared.hosts.editor_sofia.position = { ...prepared.world.livingEventStates.E30.scenePosition };
    const possession = game.possessHost(prepared, 'editor_sofia', maps['bookshop-interior']);
    if (!possession.ok) throw new Error(`Could not possess the editor: ${possession.reason}`);
    const before = possession.state;
    const initialSave = game.saveGame(before);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage(), pageErrors = [];
      page.on('pageerror', error => pageErrors.push(String(error)));
      await context.addInitScript(saved => {
        localStorage.setItem('v33-rpg-save', saved); localStorage.setItem('v34-tutorial-stage', 'done');
      }, initialSave);
      await page.goto(`http://127.0.0.1:${port}/index.html#v37-manuscript-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('소피야'));
      await page.keyboard.press('e');
      const buy = page.getByRole('button', { name: '원고를 검토하고 바실리에게 2코페이카를 건넨다' });
      if (!await buy.isVisible().catch(() => false)) {
        const debug = await page.evaluate(() => ({ body: document.querySelector('#bodyname')?.textContent,
          map: document.querySelector('#mapname')?.textContent,
          actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
          record: document.querySelector('#record')?.innerText?.slice(0, 900),
          scene: document.querySelector('#scene')?.innerText?.slice(0, 700) }));
        await page.screenshot({ path: path.join(output, `manuscript-debug-${viewport.width}.png`) });
        throw new Error(`Manuscript choice not visible: ${JSON.stringify(debug)}`);
      }
      await buy.waitFor({ state: 'visible' });
      const surface = await page.evaluate(() => ({
        labels: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        rects: [...document.querySelectorAll('#actions button')].map(button => { const r = button.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }),
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.clientHeight, bodyHeight: document.body.scrollHeight,
      }));
      if (surface.labels.length !== 2 || surface.rects.some(rect => rect.top < 0 || rect.bottom > viewport.height)
        || surface.scrollWidth > surface.width + 1 || surface.bodyHeight > surface.height + 1) {
        throw new Error(`Manuscript choices overflowed or were hidden: ${JSON.stringify(surface)}`);
      }
      await page.screenshot({ path: path.join(output, `manuscript-offer-${viewport.width}x${viewport.height}.png`) });
      const editorMoneyBefore = before.hosts.editor_sofia.money.amount, authorMoneyBefore = before.hosts.student_vasily.money.amount;
      await buy.click();
      await page.waitForFunction(() => {
        try { return JSON.parse(localStorage.getItem('v33-rpg-save'))?.state?.world?.livingEventStates?.E30?.status === 'RESOLVED'; }
        catch { return false; }
      });
      const saved = game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests });
      const event = saved.world.livingEventStates.E30;
      if (event.stage !== 'REVIEW_PURCHASED' || saved.hosts.editor_sofia.money.amount !== editorMoneyBefore - 2
        || saved.hosts.student_vasily.money.amount !== authorMoneyBefore + 2
        || !saved.hosts.editor_sofia.inventory.includes(event.manuscriptItemKo)
        || saved.hosts.student_vasily.inventory.includes(event.manuscriptItemKo) || pageErrors.length) {
        throw new Error(`Manuscript purchase did not persist cleanly: ${JSON.stringify({ stage: event.stage, pageErrors })}`);
      }
      results.push({ viewport, choices: surface.labels.length, purchase: event.stage,
        horizontalOverflow: surface.scrollWidth > surface.width, pageErrors: pageErrors.length });
      await context.close();
    }
  } finally { await browser.close(); }
  if (serverErrors.length) throw new Error(`Preview server reported errors: ${serverErrors.join('')}`);
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally { server.kill(); }
