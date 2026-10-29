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
    assert.equal(await page.locator('#place').innerText(), '관청 접수실');
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
    const bounds = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, panelScrollHeight: document.querySelector('.ending-document').scrollHeight, panelClientHeight: document.querySelector('.ending-document').clientHeight }));
    assert.equal(bounds.documentWidth, bounds.viewportWidth, 'mobile ending must not overflow horizontally');
    await page.locator('.ending-document').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: 'artifacts/v33/V33_RPG_PHASE1/ending-uvarov-360x800-top.png' });
    await page.locator('#ending-restart').scrollIntoViewIfNeeded();
    const restartBox = await page.locator('#ending-restart').boundingBox();
    assert.ok(restartBox && restartBox.x >= 0 && restartBox.x + restartBox.width <= 360 && restartBox.y + restartBox.height <= 800);
    await page.screenshot({ path: 'artifacts/v33/V33_RPG_PHASE1/ending-uvarov-360x800-bottom.png' });
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
