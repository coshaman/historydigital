import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildRoute, runtimeQuestIds } from './v33-ending-route-matrix.mjs';
import { mimeTypeFor } from '../server-mime.mjs';

const require = createRequire(import.meta.url);
const engine = require('../rpg/engine/game-state.js');
const campaign = JSON.parse(await readFile(new URL('../rpg/quests/campaign.json', import.meta.url), 'utf8'));
const previewRoot = path.resolve('dist-v33');
const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4175/';
const mobileOnly = process.argv.includes('--mobile-only');
const desktopOnly = process.argv.includes('--desktop-only');
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

async function routeBuiltGame(page) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || Number(url.port) !== 4175) return route.abort('blockedbyclient');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(previewRoot, relative);
    if (!target.startsWith(`${previewRoot}${path.sep}`) && target !== previewRoot) return route.fulfill({ status: 403, body: 'Forbidden' });
    try {
      return route.fulfill({ status: 200, body: await readFile(target), headers: { 'content-type': mimeTypeFor(target), 'cache-control': 'no-store' } });
    } catch { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
}

try {
  for (const ending of (mobileOnly ? [] : campaign.endings)) {
    const { stateBeforeEnding } = buildRoute(ending.id, 0);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('close', () => console.log(`page closed · ${ending.id}`));
    page.on('crash', error => console.log(`page crashed · ${ending.id} · ${error}`));
    await routeBuiltGame(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(save => localStorage.setItem('v33-rpg-save', save), engine.saveGame(stateBeforeEnding));
    await page.reload({ waitUntil: 'networkidle' });
    const loadWaitError = await page.waitForFunction(() => document.querySelector('#mapname')?.textContent === '관청 접수실', null, { timeout: 10000 }).then(() => null).catch(error => String(error));
    const loadedPlace = await page.locator('#mapname').innerText();
    if (loadedPlace !== '관청 접수실') {
      const diagnosis = await page.evaluate(async ({ savedHostIds, questIds }) => {
        const read = async path => (await fetch(path)).json();
        const mapIds = ['nevsky', 'printshop', 'chancery', 'courtyard', 'market-quay', 'dead-souls', 'overcoat', 'police-station'];
        const maps = Object.fromEntries(await Promise.all(mapIds.map(async id => [id, await read(`./rpg/maps/${id}.json`)])));
        const hostCards = await Promise.all(savedHostIds.map(id => read(`./rpg/characters/${id}.json`)));
        const quests = await Promise.all(questIds.map(id => read(`./rpg/quests/${id}.json`)));
        const learningExam = await read('./rpg/data/learning-exam.json');
        const saved = localStorage.getItem('v33-rpg-save');
        const savedState = JSON.parse(saved).state;
        try {
          const state = window.V33GameState.loadGame(saved, { maps, hostCards, quests, learningExam });
          return { loadError: null, savedMap: state.world.currentMapId, savedHost: state.player.embodiment, saveLength: saved?.length, savedHostCount: Object.keys(savedState.hosts).length, providedHostCount: hostCards.length, questCount: quests.length, missingMapIds: [...new Set(Object.values(savedState.hosts).map(host => host.mapId))].filter(id => !maps[id]) };
        } catch (error) { return { loadError: String(error), saveLength: saved?.length, savedHostCount: Object.keys(savedState.hosts).length, providedHostCount: hostCards.length, questCount: quests.length, savedHostIds: Object.keys(savedState.hosts), providedHostIds: hostCards.map(card => card.id) }; }
      }, { savedHostIds: Object.keys(stateBeforeEnding.hosts), questIds: runtimeQuestIds });
      throw new Error(`Ending route save failed to restore: expected 관청 접수실, saw ${loadedPlace}; ${JSON.stringify({ diagnosis, loadWaitError, pageErrors: errors })}`);
    }
    assert.match(await page.locator('#bodyname').innerText(), /알렉세이 오를로프/);

    await page.keyboard.press('e');
    await page.getByRole('button', { name: '마지막 기록을 정리한다' }).click();
    const visibleChoices = await page.locator('#actions button').allInnerTexts();
    assert.ok(visibleChoices.some(text => text.includes(ending.titleKo)), `${ending.id} must be earned by this route`);
    assert.ok(visibleChoices.length >= 1 && visibleChoices.length <= campaign.endings.length);
    await page.getByRole('button', { name: ending.titleKo, exact: false }).click();
    console.log(`ending selected · ${ending.id} · ${page.url()}`);
    await page.getByRole('heading', { name: ending.titleKo }).waitFor();
    await page.locator('#ending-screen:not([hidden])').waitFor();
    assert.equal(await page.locator('.topline').isVisible(), false);
    assert.equal(await page.locator('.playfield').isVisible(), false);
    assert.equal(await page.locator('.lower').isVisible(), false);
    assert.equal(await page.locator('#ending-history').count(), 0, 'ending omits historical meta notices');
    assert.doesNotMatch(await page.locator('#ending-screen').innerText(), /허구|재구성|게임 설정|실제와 다르/);
    const journeyCount = await page.locator('#ending-journey').count();
    const journeyText = await page.locator('#ending-journey').innerText();
    assert.ok(journeyCount === 1 && journeyText.length > 60, `journey entries not rendered: ${journeyCount}, ${journeyText.length}`);
    assert.equal(await page.locator('#ending-historical-comparison').count(), 0, 'ending keeps only the result and the player life path');
    assert.match(await page.locator('#ending-life-progress').innerText(), /1 \/ 7/);
    const routeBeforeReplay = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
      state.learning.timelineIndex = 0;
      return state;
    });
    await page.locator('#ending-life-next').click();
    assert.match(await page.locator('#ending-life-progress').innerText(), /2 \/ 7/);
    await page.locator('#ending-life-replay').click();
    assert.match(await page.locator('#ending-life-progress').innerText(), /1 \/ 7/);
    const routeAfterReplay = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
      state.learning.timelineIndex = 0;
      return state;
    });
    assert.deepEqual(routeAfterReplay, routeBeforeReplay, 'timeline playback must not mutate the completed route');
    assert.equal(errors.length, 0, errors.join('; '));
    await page.screenshot({ path: `artifacts/v33/V33_RPG_PHASE1/ending-${ending.id.toLowerCase()}-1440x900.png`, fullPage: true });
    results.push({ endingId: ending.id, choiceVisible: true, resolvedInBrowser: true, errors });
    await context.close();
  }
  if (!desktopOnly) {
    const ending = campaign.endings[0], { stateBeforeEnding } = buildRoute(ending.id, 0);
    const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const page = await context.newPage();
    await routeBuiltGame(page);
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(save => localStorage.setItem('v33-rpg-save', save), engine.saveGame(stateBeforeEnding));
    await page.reload({ waitUntil: 'networkidle' });
    const endingChoice = page.getByRole('button', { name: ending.titleKo, exact: false });
    await endingChoice.waitFor({ state: 'visible' });
    await endingChoice.click();
    await page.locator('#ending-screen:not([hidden])').waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.lower').isVisible(), false, 'ending must not expose a dialogue panel');
    assert.equal(await page.locator('#ending-life-next').isVisible(), true, 'reduced-motion timeline remains navigable');
    const reducedMotionStyle = await page.locator('#ending-life-episode').evaluate(element => ({
      preferenceHonored: matchMedia('(prefers-reduced-motion: reduce)').matches,
      animationName: getComputedStyle(element).animationName,
      transitionDuration: getComputedStyle(element).transitionDuration,
    }));
    assert.deepEqual(reducedMotionStyle, { preferenceHonored: true, animationName: 'none', transitionDuration: '0s' });
    const bounds = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, panelScrollHeight: document.querySelector('.ending-document').scrollHeight, panelClientHeight: document.querySelector('.ending-document').clientHeight }));
    assert.equal(bounds.documentWidth, bounds.viewportWidth, 'mobile ending must not overflow horizontally');
    await page.locator('.ending-document').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: 'artifacts/v33/V33_RPG_PHASE1/ending-uvarov-360x800-top.png' });
    await page.locator('#ending-restart').scrollIntoViewIfNeeded();
    const restartBox = await page.locator('#ending-restart').boundingBox();
    assert.ok(restartBox && restartBox.x >= 0 && restartBox.x + restartBox.width <= 360 && restartBox.y + restartBox.height <= 800);
    await page.screenshot({ path: 'artifacts/v33/V33_RPG_PHASE1/ending-uvarov-360x800-bottom.png' });
    await page.locator('#ending-restart').click();
    await page.waitForFunction(() => document.querySelector('#ending-screen').hidden);
    assert.equal(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), null, 'restart clears the completed exam and timeline save');
    results.push({ endingId: ending.id, mobileViewport: bounds, restartControlVisibleAfterScroll: true });
    await context.close();
  }
} finally { await browser.close(); }

if (!mobileOnly) assert.equal(results.filter(result => result.resolvedInBrowser).length, campaign.endings.length);
if (!desktopOnly) assert.equal(results.filter(result => result.mobileViewport).length, 1);
const report = { schemaVersion: 'V33_ENDING_BROWSER_SMOKE_V1', status: 'PASS', browserEndingCount: results.filter(result => result.resolvedInBrowser).length,
  mobileEndingChecked: results.some(result => result.mobileViewport), results };
await mkdir('artifacts/v33', { recursive: true });
await writeFile(path.join('artifacts/v33', 'ENDING_BROWSER_SMOKE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
