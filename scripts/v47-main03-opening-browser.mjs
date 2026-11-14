import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { toV47StoryQuests, attachV47StoryBeatObjects } from '../rpg/data/v47-story-beats.mjs';
import { v47StoryQuests, attachV47StoryObjects } from '../rpg/data/v47-main-stories.mjs';

const root = process.cwd(), read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const maps = Object.fromEntries(fs.readdirSync('rpg/maps').filter(file => file.endsWith('.json'))
  .map(file => { const map = read(path.join('rpg/maps', file)); return [map.mapId, map]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => read(path.join('rpg/characters', file)));
const campaign = read('rpg/quests/campaign.json');
const quest = read('rpg/quests/europe-news-1848.json');
const storyQuests = [...v47StoryQuests, ...toV47StoryQuests()];
globalThis.V47MainStories.registerStoryBeats(storyQuests.filter(item => item.storyId));
attachV47StoryObjects(maps); attachV47StoryBeatObjects(maps, storyQuests);
const allQuests = [...storyQuests, ...fs.readdirSync('rpg/quests').filter(file => file.endsWith('.json') && file !== 'campaign.json')
  .map(file => read(path.join('rpg/quests', file))), quest];
const output = path.join(root, 'artifacts/v47/MAIN03_OPENING_BROWSER_REPLAY');
fs.mkdirSync(output, { recursive: true });
const port = 4221, staticRoot = path.join(root, 'dist-v33');
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: staticRoot }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = []; server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
try {
  const deadline = Date.now() + 10000; let ready = false;
  while (Date.now() < deadline && !ready) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, `static preview starts: ${serverErrors.join('')}`);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
  const results = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      let state = game.createInitialState({ maps, hostCards: cards, quests: allQuests, startMapId: 'printshop' });
      state.world.chapterId = 'V33_1848_PUBLIC'; state.world.date = '1848-03-27'; state.world.clockMinutes = 539;
      state.world.currentMapId = 'printshop'; state.world.v47.focusStoryId = 'MAIN03'; state.player.embodiment = 'clerk_alexei';
      for (const arc of campaign.arcs) for (const id of [...arc.questIds, ...(arc.optionalQuestIds ?? [])]) {
        if (arc.id !== 'V33_1848_PUBLIC' || arc.questIds.indexOf(id) < arc.questIds.indexOf(quest.id))
          state.quests[id] = { status: 'resolved', result: 'PRIOR_CAMPAIGN_CONTEXT' };
      }
      state.quests[quest.id] = { status: 'open', result: null };
      const actors = [['clerk_alexei', 13, 10], ['printer_ekaterina', 12, 10], ['reader_darya', 14, 10], ['student_vasily', 13, 11]];
      for (const person of Object.values(state.hosts)) person.historicalAliveAndPresent = false;
      for (const [id, x, y] of actors) {
        const host = state.hosts[id]; host.historicalAliveAndPresent = true; host.mapId = 'printshop';
        host.position = { x, y }; host.activeGoal = null;
        host.schedule = [{ atMinute: 0, mapId: 'printshop', position: { x, y }, activityKo: '작업을 기다린다' }];
      }
      state.player.position = { ...state.hosts.clerk_alexei.position };
      const opened = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: actors.map(([id]) => id) });
      assert.equal(opened.world.date, '1848-03-27');
      assert.equal(opened.world.livingEventStates.E42?.stage, 'READING_READY', 'E42 physically gathers its readers on the Gregorian issue-arrival date');

      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(saved => { localStorage.setItem('v33-rpg-save', saved); localStorage.setItem('v34-tutorial-stage', 'done'); }, game.saveGame(opened));
      await page.goto(`http://127.0.0.1:${port}/index.html#v47-main03-opening-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
      assert.equal(await page.locator('#calendar-date').textContent(), '1848년 3월 27일');
      await page.locator('#history-events-open').click();
      const storyCard = page.locator('#actions button').filter({ hasText: '혁명의 소식과 마지막 금요일' }).first();
      await storyCard.waitFor({ state: 'visible' }); await storyCard.click();
      await page.waitForFunction(() => document.querySelector('#headline')?.textContent?.includes('혁명의 소식과 마지막 금요일'));
      assert.match(await page.locator('#mission-title').textContent(), /유럽의 소식, 황제의 선언/,
        'MAIN03 menu keeps the existing physical E42 quest as its first mission');
      assert.match(await page.locator('#mission-action').textContent(), /선언문에서 자료를 읽으세요.*인쇄소/,
        'MAIN03 first task names the exact dated source and the printshop');

      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('e');
      const readButton = page.getByRole('button', { name: /자료 읽기 · 니콜라이 1세의 1848년 3월 선언문/ });
      if (!(await readButton.isVisible().catch(() => false))) {
        console.log(JSON.stringify({ viewport, headline: await page.locator('#headline').textContent(),
          actions: await page.locator('#actions').innerText(), hint: await page.locator('#hint').textContent() }));
      }
      await readButton.waitFor({ state: 'visible', timeout: 5000 }); await readButton.click();
      await page.waitForFunction(() => document.querySelector('#source-reader')?.open);
      const sourceView = await page.evaluate(() => ({ title: document.querySelector('#source-reader-title')?.textContent,
        ru: document.querySelectorAll('.source-passage-ru').length, ko: document.querySelectorAll('.source-passage-ko').length,
        text: [...document.querySelectorAll('.source-passage-ru')].map(node => node.textContent).join('\n'), date: document.querySelector('#source-reader-dates')?.textContent,
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.match(sourceView.title, /니콜라이 1세/); assert.equal(sourceView.ru, 4); assert.equal(sourceView.ko, 4);
      assert.match(sourceView.text, /Объявляем всенародно/); assert.match(sourceView.text, /Но да не будет так/);
      assert.match(sourceView.date, /1848-03-14|1848년 3월 14일/); assert.ok(sourceView.scrollWidth <= sourceView.width + 1);
      await page.screenshot({ path: path.join(output, `MAIN03-E42-SOURCE-${viewport.width}x${viewport.height}.png`), fullPage: false });
      await page.locator('#source-reader-complete').click();
      await page.waitForFunction(() => !document.querySelector('#source-reader')?.open);
      await page.keyboard.press('e');
      const inspectEvent = page.getByRole('button', { name: /사건 살펴보기 · 유럽의 소식, 황제의 선언/ });
      await inspectEvent.waitFor({ state: 'visible', timeout: 5000 }); await inspectEvent.click();
      const choice = page.getByRole('button', { name: /읽은 대목을 개인 수첩에 적는다/ });
      await choice.waitFor({ state: 'visible', timeout: 5000 });
      await page.screenshot({ path: path.join(output, `MAIN03-E42-CHOICES-${viewport.width}x${viewport.height}.png`), fullPage: false });
      await choice.click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.europeNewsRecord?.disposition === 'PRIVATE_NOTE');
      const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('v33-rpg-save'))).state;
      assert.equal(saved.quests[quest.id].status, 'resolved');
      assert.ok(saved.hosts.clerk_alexei.personalEventNotes.some(note => note.eventId === 'E42'));
      assert.ok(saved.ledger.some(entry => entry.eventId?.startsWith('READ_') && entry.sourceId === 'OBJ-NICHOLAS-MANIFESTO-1848'));
      assert.equal(saved.world.immutableOutcomes.EUROPE_REVOLUTIONS_1848, 'the documented events and dates remain unchanged');
      assert.equal(errors.length, 0, `no browser errors: ${errors.join('; ')}`);
      results.push({ status: 'PASS', viewport: `${viewport.width}x${viewport.height}`, date: saved.world.date,
        questId: quest.id, resolution: saved.world.europeNewsRecord.disposition, sourceView, pageErrors: errors });
      await fs.promises.writeFile(path.join(output, `MAIN03-E42-${viewport.width}x${viewport.height}.json`), `${JSON.stringify(results.at(-1), null, 2)}\n`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ status: 'PASS', cases: results, screenshots: output }, null, 2));
} finally { server.kill(); }
