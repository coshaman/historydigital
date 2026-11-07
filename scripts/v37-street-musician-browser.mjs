import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';

const root = process.cwd(), base = process.env.V37_APP_URL ?? 'http://127.0.0.1:4175/';
const out = path.join(root, 'artifacts/v37/E38_BROWSER_QA');
const read = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const [mapFiles, cardFiles, quest, registry] = await Promise.all([
  readdir(path.join(root, 'rpg/maps')), readdir(path.join(root, 'rpg/characters')),
  read('rpg/quests/street-music-1847.json'), read('data/era_character_registry.json'),
]);
const [maps, rawCards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`rpg/characters/${file}`))),
]);
const cards = decorateCardsWithEraProfiles(rawCards, registry);
let state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'nevsky' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 599;
state.world.currentMapId = 'nevsky';
const musician = state.hosts.street_musician_ivan;
musician.mapId = 'nevsky'; musician.position = { x: 20, y: 14 }; musician.activeGoal = null;
state = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: [musician.id] });
assert.equal(state.world.livingEventStates.E38?.status, 'ACTIVE');
const listener = state.hosts.street_vendor_matryona;
listener.mapId = 'nevsky'; listener.position = { x: 21, y: 15 };
state.player.embodiment = listener.id; state.player.position = { ...listener.position };
const save = game.saveGame(state);

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport }), page = await context.newPage(), errors = [];
  page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); }, save);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#calendar-date')?.textContent.includes('1847년 6월 1일')
    && document.querySelector('#clock')?.textContent.includes('10:00')
    && document.querySelector('#bodyname')?.textContent.includes('마트료나'));
  await page.locator('#use').click();
  const tip = page.locator('#actions button').filter({ hasText: '동전 한 푼 건넨다' });
  await tip.waitFor({ state: 'visible' });
  assert.ok(await tip.isEnabled(), 'the live-event action is enabled at the physical scene');
  const before = await page.evaluate(() => ({ width: document.documentElement.scrollWidth,
    viewport: innerWidth, button: (() => { const r = document.querySelector('#actions button').getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom }; })() }));
  assert.ok(before.width <= viewport.width, `horizontal overflow: ${JSON.stringify(before)}`);
  assert.ok(before.button.x >= 0 && before.button.right <= viewport.width, `choice is clipped: ${JSON.stringify(before)}`);
  await page.screenshot({ path: path.join(out, `e38-choice-${viewport.width}x${viewport.height}.png`) });
  await tip.click();
  await page.waitForFunction(() => {
    const save = JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null');
    return save?.state?.world?.livingEventStates?.E38?.playerTipAmount === 1;
  });
  const outcome = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
    return { stage: state.world.livingEventStates.E38.stage,
      payer: state.world.livingEventStates.E38.playerTipHostId,
      tipAmount: state.world.livingEventStates.E38.playerTipAmount,
      performerMoney: state.hosts.street_musician_ivan.money.amount,
      pageErrors: [] };
  });
  assert.deepEqual(errors, []); results.push({ viewport, choice: before, outcome, pageErrors: errors });
  await context.close();
}
await browser.close();
await writeFile(path.join(out, 'BROWSER_ACCEPTANCE.json'), `${JSON.stringify({ status: 'PASS', base, results }, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
