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
const quests = fs.readdirSync('rpg/quests').filter(file => file.endsWith('.json')
  && !['campaign.json', 'resident-arcs-v36.json'].includes(file))
  .map(file => read(path.join('rpg/quests', file)));
const quest = quests.find(item => item.id === 'V37_SERFDOM_READING_1847');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4213;
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

  // Let the published-reading circle, manuscript offer, and the next reading gather naturally.
  let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'courtyard' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 530;
  const trace = [];
  for (let elapsed = 0; elapsed < 720 && state.world.livingEventStates.E31?.stage !== 'DISCUSSION_READY'; elapsed += 5)
    { state = game.advanceNpcWorld(state, Math.min(5, 720 - elapsed), maps); const circle = state.world.livingEventStates.E24;
      if (circle?.status === 'ACTIVE' && elapsed % 15 === 0) trace.push({ minute: state.world.clockMinutes,
        stage: circle.stage, actors: ['student_vasily','reader_darya'].map(id => ({ id, map: state.hosts[id].mapId,
          position: state.hosts[id].position, goal: state.hosts[id].activeGoal?.taskId })) }); }
  const chain = ['E24', 'E30', 'E31'].map(id => ({ id, stage: state.world.livingEventStates[id]?.stage,
    status: state.world.livingEventStates[id]?.status }));
  if (state.world.livingEventStates.E24?.status !== 'RESOLVED'
    || state.world.livingEventStates.E30?.status !== 'RESOLVED'
    || state.world.livingEventStates.E31?.stage !== 'DISCUSSION_READY')
    throw new Error(`Natural reading chain did not reach the discussion: ${JSON.stringify({ chain,
      minute: state.world.clockMinutes, trace, actors: ['reader_darya','student_vasily','editor_sofia'].map(id => ({ id,
        map: state.hosts[id]?.mapId, position: state.hosts[id]?.position, goal: state.hosts[id]?.activeGoal?.taskId })) })}`);

  const bookshop = maps['bookshop-interior'];
  const sourceObject = bookshop.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.type === 'source'
    && item.properties?.some(property => property.name === 'sourceId' && property.value === 'LIT-GOGOL-RUSSIAN-LANDLORD-1847'));
  if (!sourceObject) throw new Error('The bookshop has no physical copy of Gogol’s text.');
  state.world.currentMapId = 'bookshop-interior';
  const reader = state.hosts.reader_darya, sourcePosition = { x: sourceObject.x / 16, y: sourceObject.y / 16 };
  reader.position = { ...sourcePosition }; reader.mapId = 'bookshop-interior';
  state.player.position = { ...sourcePosition };
  const possessed = game.possessHost(state, reader.id, bookshop);
  if (!possessed.ok) throw new Error(`Could not enter the reader’s viewpoint: ${possessed.reason}`);
  state = possessed.state;
  const browser = await chromium.launch({ headless: true }), results = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(saved => {
        localStorage.setItem('v33-rpg-save', saved);
        localStorage.setItem('v34-tutorial-stage', 'done');
      }, game.saveGame(state));
      await page.goto(`http://127.0.0.1:${port}/index.html#v37-serfdom-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('다리야'));
      await page.locator('#use').click();
      await page.locator('#source-reader').waitFor({ state: 'visible' });
      const sourceText = await page.locator('#source-reader-passages').innerText();
      if (!sourceText.includes('должны покоряться той самой власти') || !sourceText.includes('복종해야'))
        throw new Error('The Russian source and reviewed Korean passage are not both visible.');
      await page.screenshot({ path: path.join(output, `serfdom-source-${viewport.width}x${viewport.height}.png`) });
      await page.locator('#source-reader-complete').click();
      await page.locator('#source-reader').waitFor({ state: 'hidden' });
      await page.locator('[data-move="right"]').click();
      await page.locator('[data-move="down"]').click();
      await page.locator('#use').click();
      const choice = page.getByRole('button', { name: /주인의 책임을 먼저 따져 보자고 말한다/ });
      await choice.waitFor({ state: 'visible' });
      await choice.scrollIntoViewIfNeeded();
      const surface = await page.evaluate(() => ({
        headline: document.querySelector('#headline')?.textContent ?? '',
        choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
        rect: (() => { const r = [...document.querySelectorAll('#actions button')].find(button => button.innerText.includes('주인의 책임'))?.getBoundingClientRect();
          return r ? { top: r.top, bottom: r.bottom } : null; })(),
      }));
      if (!surface.choices.length || surface.scrollWidth > surface.width + 1 || !surface.rect
        || surface.rect.top < 0 || surface.rect.bottom > viewport.height)
        throw new Error(`Natural discussion choice is clipped: ${JSON.stringify(surface)}`);
      await page.screenshot({ path: path.join(output, `serfdom-discussion-${viewport.width}x${viewport.height}.png`) });
      const before = await page.locator('#record').textContent();
      await choice.click();
      await page.waitForFunction(previous => document.querySelector('#record')?.textContent !== previous, before);
      await page.locator('#save').click();
      const saved = game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests });
      if (saved.world.livingEventStates.E31.stage !== 'LANDLORD_DUTY_DISCUSSION'
        || !saved.world.livingEventStates.E24 || !saved.world.livingEventStates.E30 || errors.length)
        throw new Error(`The source-based choice or event chain did not persist: ${JSON.stringify({
          stages: ['E24','E30','E31'].map(id => saved.world.livingEventStates[id]?.stage), errors })}`);
      results.push({ viewport, naturalChain: chain, choices: surface.choices.length, sourceReadInBrowser: true,
        resolution: saved.world.livingEventStates.E31.stage, horizontalOverflow: surface.scrollWidth > surface.width,
        pageErrors: errors.length });
      await context.close();
    }
  } finally { await browser.close(); }
  if (serverErrors.length) throw new Error(`Preview server reported errors: ${serverErrors.join('')}`);
  const report = { status: 'PASS', chain, results };
  fs.writeFileSync(path.join(output, 'SERFDOM_READING_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally { server.kill(); }
