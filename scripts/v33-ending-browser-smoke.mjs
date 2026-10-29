import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildRoute } from './v33-ending-route-matrix.mjs';

const require = createRequire(import.meta.url);
const engine = require('../rpg/engine/game-state.js');
const campaign = JSON.parse(await readFile(new URL('../rpg/quests/campaign.json', import.meta.url), 'utf8'));
const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

try {
  for (const ending of campaign.endings) {
    const { stateBeforeEnding } = buildRoute(ending.id, 0);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('close', () => console.log(`page closed · ${ending.id}`));
    page.on('crash', error => console.log(`page crashed · ${ending.id} · ${error}`));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(save => localStorage.setItem('v33-rpg-save', save), engine.saveGame(stateBeforeEnding));
    await page.reload({ waitUntil: 'networkidle' });
    const loadedPlace = await page.locator('#place').innerText();
    if (loadedPlace !== '관청 접수실') {
      const diagnosis = await page.evaluate(async () => {
        const read = async path => (await fetch(path)).json();
        const maps = Object.fromEntries(await Promise.all(['nevsky', 'printshop', 'chancery', 'courtyard', 'dead-souls'].map(async id => [id, await read(`./rpg/maps/${id}.json`)])));
        const hostCards = await Promise.all(['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','nekrasov_reconstruction','literary_chichikov'].map(id => read(`./rpg/characters/${id}.json`)));
        const quests = await Promise.all(['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','literary-dead-souls'].map(id => read(`./rpg/quests/${id}.json`)));
        const learningExam = await read('./rpg/data/learning-exam.json');
        const saved = localStorage.getItem('v33-rpg-save');
        try {
          const state = window.V33GameState.loadGame(saved, { maps, hostCards, quests, learningExam });
          return { loadError: null, savedMap: state.world.currentMapId, savedHost: state.player.embodiment, saveLength: saved?.length };
        } catch (error) { return { loadError: String(error), saveLength: saved?.length }; }
      });
      throw new Error(`Ending route save failed to restore: expected 관청 접수실, saw ${loadedPlace}; ${JSON.stringify(diagnosis)}`);
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
    assert.match(await page.locator('#ending-history').innerText(), /실제 잡지의 발행.*플레이어의 선택으로 바뀌지 않는다/);
    const journeyCount = await page.locator('#ending-journey').count();
    const journeyText = await page.locator('#ending-journey').innerText();
    assert.ok(journeyCount === 1 && journeyText.length > 60, `journey entries not rendered: ${journeyCount}, ${journeyText.length}`);
    assert.ok(await page.locator('#ending-sources a').count() >= 3);
    const historyComesFirst = await page.evaluate(() => Boolean(
      document.querySelector('#ending-historical-comparison').compareDocumentPosition(document.querySelector('#ending-life-section')) & Node.DOCUMENT_POSITION_FOLLOWING,
    ));
    assert.equal(historyComesFirst, true, 'documented biography must precede the fictional life timeline');
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
  {
    const ending = campaign.endings[0], { stateBeforeEnding } = buildRoute(ending.id, 0);
    const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(save => localStorage.setItem('v33-rpg-save', save), engine.saveGame(stateBeforeEnding));
    await page.reload({ waitUntil: 'networkidle' });
    await page.keyboard.press('e');
    await page.getByRole('button', { name: '마지막 기록을 정리한다' }).click();
    await page.getByRole('button', { name: ending.titleKo, exact: false }).click();
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

assert.equal(results.filter(result => result.resolvedInBrowser).length, campaign.endings.length);
assert.equal(results.filter(result => result.mobileViewport).length, 1);
const report = { schemaVersion: 'V33_ENDING_BROWSER_SMOKE_V1', status: 'PASS', browserEndingCount: campaign.endings.length, mobileEndingChecked: true, results };
await mkdir('artifacts/v33', { recursive: true });
await writeFile(path.join('artifacts/v33', 'ENDING_BROWSER_SMOKE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
