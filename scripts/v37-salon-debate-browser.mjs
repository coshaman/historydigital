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
const quest = read('rpg/quests/v37-salon-debate-1847.json');
const sourceId = 'LIT-BELINSKY-GOGOL-REVIEW-1847';
const source = read('rpg/data/historical-source-packets.json').records.find(row => row.sourceId === sourceId);
if (!source || source.paragraphs.length !== 9) throw new Error('E21 source packet is missing its nine contextual paragraphs');

const initial = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'bookshop-interior' });
initial.world.chapterId = 'V33_1847_PRINT';
initial.world.date = '1847-06-01';
initial.world.clockMinutes = 600;
initial.world.currentMapId = 'bookshop-interior';
initial.player.embodiment = 'reader_darya';
initial.hosts.reader_darya.mapId = 'bookshop-interior';
initial.hosts.reader_darya.position = { x: 13, y: 11 };
initial.player.position = { ...initial.hosts.reader_darya.position };
for (const [id, position] of [['student_vasily', { x: 12, y: 12 }], ['editor_sofia', { x: 13, y: 12 }]]) {
  initial.hosts[id].mapId = 'bookshop-interior';
  initial.hosts[id].position = position;
}
const readResult = game.recordSourceRead(initial, sourceId, maps);
if (!readResult.ok) throw new Error(`Darya could not read the public review: ${readResult.reason}`);
const opened = game.advanceWorldTime(readResult.state, 2, maps);
const gathered = game.advanceWorldTime(opened, 90, maps);
if (gathered.world.livingEventStates.E21?.stage !== 'DEBATE_READY'
  || !gathered.world.livingEventStates.E21.actorHostIds.every(id => gathered.hosts[id].mapId === 'bookshop-interior')) {
  throw new Error(`The readers did not gather at the bookshop after the source was read: ${JSON.stringify({ event: gathered.world.livingEventStates.E21,
    actors: ['reader_darya', 'student_vasily', 'editor_sofia'].map(id => ({ id, mapId: gathered.hosts[id].mapId,
      position: gathered.hosts[id].position, goal: gathered.hosts[id].activeGoal })) })}`);
}
const startingSave = game.saveGame(gathered);

const port = 4212;
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: path.resolve('dist-v33') },
  stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const results = [];
try {
  const deadline = Date.now() + 10000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch {}
    if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`Static preview did not start: ${serverErrors.join('')}`);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });
      await page.addInitScript(saved => {
        localStorage.setItem('v33-rpg-save', saved);
        localStorage.setItem('v34-tutorial-stage', 'done');
      }, startingSave);
      await page.goto(`http://127.0.0.1:${port}/index.html#v37-salon-debate-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('다리야'));
      await page.keyboard.press('e');
      const choice = page.locator('#actions button').filter({ hasText: '유럽의 경험도 살펴야 한다고 말한다' });
      await choice.waitFor({ state: 'visible', timeout: 5000 });
      const visibleChoices = await page.locator('#actions button').allTextContents();
      if (!visibleChoices.some(text => text.includes('바실리와 소피아가 듣습니다'))
        || !visibleChoices.some(text => text.includes('개인 독서 메모에 남습니다'))) {
        throw new Error(`E21 action or immediate consequences missing at ${viewport.width}: ${JSON.stringify(visibleChoices)}`);
      }
      const initialSurface = await page.evaluate(() => ({ width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth, headline: document.querySelector('#headline')?.textContent,
        article: document.querySelector('#journal-text')?.textContent }));
      if (initialSurface.scrollWidth > initialSurface.width + 1 || pageErrors.length)
        throw new Error(`E21 scene layout/runtime error: ${JSON.stringify({ initialSurface, pageErrors })}`);
      await page.screenshot({ path: path.join(output, `salon-debate-choice-${viewport.width}x${viewport.height}.png`) });
      await choice.click();
      await page.locator('#save').click();
      const saved = game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')),
        { maps, hostCards: cards, quests: [quest] });
      const event = saved.world.livingEventStates.E21;
      if (event.stage !== 'EUROPEAN_METHOD_DEFENDED' || event.resolvedByHostId !== 'reader_darya'
        || !saved.hosts.reader_darya.knownEvidenceIds.includes(sourceId)
        || !saved.hosts.reader_darya.relations.student_vasily
        || saved.world.livingEventStates.E29?.stage !== 'INVITATION_OFFERED'
        || !saved.ledger.at(-1).sourceIds.includes(sourceId) || pageErrors.length || serverErrors.length) {
        throw new Error(`E21 choice did not persist source and relationship effects: ${JSON.stringify({ event,
          knownEvidence: saved.hosts.reader_darya.knownEvidenceIds, relation: saved.hosts.reader_darya.relations.student_vasily,
          pageErrors, serverErrors })}`);
      }
      await context.close();
      const followContext = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const followPage = await followContext.newPage();
      followPage.on('pageerror', error => pageErrors.push(String(error)));
      followPage.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });
      await followPage.addInitScript(savedData => {
        localStorage.setItem('v33-rpg-save', savedData);
        localStorage.setItem('v34-tutorial-stage', 'done');
      }, game.saveGame(saved));
      await followPage.goto(`http://127.0.0.1:${port}/index.html#v37-salon-invitation-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await followPage.locator('#load').click();
      await followPage.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('다리야'));
      await followPage.keyboard.press('ArrowDown');
      await followPage.keyboard.press('e');
      const invitation = followPage.locator('#actions button').filter({ hasText: '초대를 받고 종이를 챙긴다' });
      await invitation.waitFor({ state: 'visible', timeout: 5000 });
      const finalSurface = await followPage.evaluate(() => ({ width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth, text: document.querySelector('#record')?.textContent,
        followup: [...document.querySelectorAll('#actions button')].map(button => button.innerText) }));
      if (finalSurface.scrollWidth > finalSurface.width + 1 || pageErrors.length)
        throw new Error(`E21 saved result failed to reload cleanly: ${JSON.stringify({ finalSurface, pageErrors })}`);
      await invitation.click();
      await followPage.locator('#save').click();
      const invitationSaved = game.loadGame(await followPage.evaluate(() => localStorage.getItem('v33-rpg-save')),
        { maps, hostCards: cards, quests: [quest] });
      if (invitationSaved.world.livingEventStates.E29?.stage !== 'INVITATION_ACCEPTED'
        || !invitationSaved.hosts.reader_darya.inventory.includes('저녁 독서회 초대장') || pageErrors.length) {
        throw new Error(`E29 response did not persist after E21: ${JSON.stringify({ event: invitationSaved.world.livingEventStates.E29,
          inventory: invitationSaved.hosts.reader_darya.inventory, pageErrors })}`);
      }
      await followPage.screenshot({ path: path.join(output, `salon-debate-result-${viewport.width}x${viewport.height}.png`) });
      results.push({ viewport, stage: event.stage, reader: event.resolvedByHostId,
        invitation: invitationSaved.world.livingEventStates.E29.stage,
        sourceLinked: saved.ledger.at(-1).sourceIds.includes(sourceId), choices: visibleChoices.length,
        scrollWidth: finalSurface.scrollWidth, pageErrors: [...pageErrors] });
      await followContext.close();
    }
  } finally { await browser.close(); }
  if (serverErrors.length) throw new Error(`Preview server errors: ${serverErrors.join('')}`);
} finally { server.kill(); }
const report = { status: 'PASS', event: 'E21', sourceId, contextualParagraphs: source.paragraphs.length, results, serverErrors };
fs.writeFileSync(path.join(output, 'SALON_DEBATE_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
