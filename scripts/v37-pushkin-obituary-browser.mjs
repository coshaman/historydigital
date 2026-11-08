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
const quest = read('rpg/quests/v37-pushkin-obituary-1847.json');
const packets = read('rpg/data/historical-source-packets.json');
const sourceIndex = read('rpg/data/source-reader-index.json');
const sourceId = 'OBJ-PUSHKIN-OBITUARY-1837';
const source = packets.records.find(row => row.sourceId === sourceId);
const excerpt = sourceIndex.records.find(row => row.sourceId === sourceId);
if (!source || !excerpt || source.paragraphs.length !== 1) throw new Error('E43 source packet or reading locator is missing');

const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4203, staticRoot = path.resolve('dist-v33');
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
if (!ready) { server.kill(); throw new Error(`E43 preview did not start: ${serverErrors.join('')}`); }

const browser = await chromium.launch({ headless: true });
const cases = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'bookshop-interior' });
    state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 600;
    state.world.currentMapId = 'bookshop-interior'; state.player.embodiment = 'bookseller_lev';
    for (const [id, x] of [['bookseller_lev', 13], ['reader_darya', 14], ['student_vasily', 15]]) {
      state.hosts[id].mapId = 'bookshop-interior'; state.hosts[id].position = { x, y: 13 };
      state.hosts[id].historicalAliveAndPresent = true;
    }
    state.player.position = { x: 13, y: 13 };
    const active = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: ['bookseller_lev', 'reader_darya', 'student_vasily'] });
    if (active.world.livingEventStates.E43?.stage !== 'READING_READY') throw new Error('E43 did not reach its dated reading stage');

    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    await page.addInitScript(saved => {
      localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, game.saveGame(active));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-pushkin-obituary-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('레프'), { timeout: 10000 });
    await page.keyboard.press('e');
    const readAction = page.getByRole('button', { name: /자료 읽기 · 푸시킨 사망 부고/ });
    await readAction.waitFor({ state: 'visible', timeout: 5000 });
    await readAction.click();
    const reader = page.locator('#source-reader');
    await page.waitForFunction(() => document.querySelector('#source-reader')?.open, { timeout: 5000 });
    const sourceView = await page.evaluate(() => {
      const dialog = document.querySelector('#source-reader');
      const root = document.documentElement;
      return { title: document.querySelector('#source-reader-title')?.textContent,
        russian: document.querySelector('.source-passage-ru')?.textContent,
        korean: document.querySelector('.source-passage-ko')?.textContent,
        provenance: document.querySelector('#source-reader-provenance-text')?.textContent,
        dates: document.querySelector('#source-reader-dates')?.textContent,
        width: root.clientWidth, scrollWidth: root.scrollWidth,
        dialogScroll: dialog.scrollHeight > dialog.clientHeight };
    });
    if (sourceView.title !== source.titleKo || !sourceView.russian?.includes('Солнце нашей Поэзии закатилось!')
      || !sourceView.russian?.includes('К этой мысли нельзя привыкнуть!') || !sourceView.korean?.includes('푸시킨이 세상을 떠났다')
      || !sourceView.provenance?.includes(excerpt.pageLocator ?? excerpt.excerptId)
      || !sourceView.dates?.includes('1837') || !sourceView.dialogScroll || sourceView.scrollWidth > sourceView.width + 1) {
      throw new Error(`E43 source reader did not show the complete aligned passage and provenance: ${JSON.stringify(sourceView)}`);
    }
    await page.screenshot({ path: path.join(output, `pushkin-obituary-source-${viewport.width}x${viewport.height}.png`) });
    await page.getByRole('button', { name: '한국어 중심' }).click();
    const translation = page.locator('.source-passage-ko');
    await translation.scrollIntoViewIfNeeded();
    const translationReachable = await page.evaluate(() => {
      const reader = document.querySelector('#source-reader');
      const text = document.querySelector('.source-passage-ko').getBoundingClientRect();
      const dialog = document.querySelector('#source-reader').getBoundingClientRect();
      const footer = document.querySelector('.source-reader-actions').getBoundingClientRect();
      reader.scrollTop += Math.max(0, text.bottom - footer.top + 14);
      const adjusted = document.querySelector('.source-passage-ko').getBoundingClientRect();
      return { visible: adjusted.top >= dialog.top && adjusted.bottom <= footer.top,
        top: adjusted.top, bottom: adjusted.bottom, dialogTop: dialog.top, footerTop: footer.top };
    });
    if (!translationReachable.visible) throw new Error(`E43 Korean translation cannot be read above the sticky source-reader controls: ${JSON.stringify(translationReachable)}`);
    await page.screenshot({ path: path.join(output, `pushkin-obituary-translation-${viewport.width}x${viewport.height}.png`) });
    await page.locator('#source-reader-complete').click();
    await page.waitForFunction(() => !document.querySelector('#source-reader')?.open, { timeout: 5000 });
    const readToShop = page.getByRole('button', { name: '부고를 곁에 모인 사람들과 함께 읽는다' });
    await readToShop.waitFor({ state: 'visible', timeout: 5000 });
    const choices = await page.locator('#actions button').allInnerTexts();
    if (choices.length !== 3 || !choices[2].includes('곁에 있는 다리야와 바실리')) {
      throw new Error(`E43 source-reading choices or audience disclosure are missing: ${JSON.stringify(choices)}`);
    }
    await readToShop.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `pushkin-obituary-choices-${viewport.width}x${viewport.height}.png`) });
    const before = await page.locator('#record').textContent();
    await readToShop.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, before);
    const saved = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const restored = game.loadGame(saved, { maps, hostCards: cards, quests: [quest] });
    const event = restored.world.livingEventStates.E43;
    if (event.stage !== 'READ_TO_SHOP' || restored.world.pushkinObituaryRecord?.disposition !== 'READ_TO_SHOP'
      || !restored.hosts.reader_darya.knownEvidenceIds.includes(sourceId)
      || !restored.hosts.student_vasily.knownEvidenceIds.includes(sourceId)
      || !restored.ledger.some(row => row.eventType === 'SOURCE_HEARD_ALOUD' && row.catalogEventId === 'E43')
      || pageErrors.length || serverErrors.length) {
      throw new Error(`E43 public reading failed to persist for listeners: ${JSON.stringify({ stage: event.stage, pageErrors, serverErrors })}`);
    }
    await page.screenshot({ path: path.join(output, `pushkin-obituary-read-aloud-${viewport.width}x${viewport.height}.png`) });
    cases.push({ viewport, sourceId, excerptId: excerpt.excerptId, stage: event.stage,
      choiceCount: choices.length, listenerEvidence: ['reader_darya', 'student_vasily'].every(id => restored.hosts[id].knownEvidenceIds.includes(sourceId)),
      sourceScrollable: sourceView.dialogScroll, translationReachable: translationReachable.visible,
      horizontalOverflow: sourceView.scrollWidth > sourceView.width, pageErrors });
    await context.close();
  }
} finally {
  await browser.close(); server.kill();
}
if (serverErrors.length) throw new Error(`E43 preview server errors: ${serverErrors.join('')}`);
const report = { status: 'PASS', cases };
fs.writeFileSync(path.join(output, 'PUSHKIN_OBITUARY_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
