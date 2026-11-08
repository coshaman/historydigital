import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';

const root = process.cwd();
const base = process.env.V37_APP_URL ?? 'http://127.0.0.1:4173/';
const out = path.join(root, 'artifacts/v37/E41_BROWSER_QA');
const read = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;

const mapFiles = (await readdir(path.join(root, 'rpg/maps'))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const map = await read(`rpg/maps/${file}`); return [map.mapId, map];
})));
const characterFiles = (await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json'));
const [rawCards, registry] = await Promise.all([
  Promise.all(characterFiles.map(file => read(`rpg/characters/${file}`))), read('data/era_character_registry.json'),
]);
const cards = decorateCardsWithEraProfiles(rawCards, registry);
const questFiles = (await readdir(path.join(root, 'rpg/quests')))
  .filter(file => file.endsWith('.json') && !['campaign.json', 'resident-arcs-v36.json'].includes(file));
const [quests, campaign] = await Promise.all([
  Promise.all(questFiles.map(file => read(`rpg/quests/${file}`))), read('rpg/quests/campaign.json'),
]);

let state = game.createInitialState({ maps, hostCards: cards, quests });
state.world.chapterId = 'V33_1849_CIRCLE';
state.world.date = '1849-05-05';
for (const id of ['CIRCLE_INVESTIGATION_1849', 'CIRCLE_LETTER_1849_MAY']) state.quests[id].status = 'resolved';
const quest = quests.find(item => item.id === 'E41_SEMENOVSKY_1849');
const dateAdvance = game.advanceCampaignDate(state, quest.date, campaign, quests);
assert.equal(dateAdvance.ok, true, dateAdvance.reason);
state = game.advanceNpcWorld(dateAdvance.state, 60, maps);
assert.equal(state.world.livingEventStates.E41.status, 'ACTIVE');
state.world.currentMapId = 'nevsky';
state.player.position = { x: 14, y: 15 };
const save = game.saveGame(state);

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport }), page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); }, save);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#calendar-date')?.textContent.includes('1849년 12월 22일')
    && document.querySelector('#clock')?.textContent === '10:00');
  await page.locator('#use').click();
  await page.waitForFunction(() => document.querySelector('#mapname')?.textContent.includes('세묘노프스키 열병장'));
  await page.screenshot({ path: path.join(out, `parade-ground-${viewport.width}x${viewport.height}.png`) });
  await page.locator('#use').click();
  await page.locator('#actions button').filter({ hasText: '도스토옙스키 살펴보기' }).click();
  await page.getByRole('button', { name: '몸을 빌린다' }).click();
  await page.locator('[data-move="left"]').click();
  await page.locator('[data-move="up"]').click();
  await page.locator('#use').click();
  await page.locator('#actions button').filter({ hasText: '자료 읽기 · 세묘노프스키 열병장에서의 사형 선고와 감형' }).click();
  await page.locator('#source-reader').waitFor({ state: 'visible' });
  await page.locator('#source-reader-passages').getByText('사랑하는 형, 모든 것이 결정됐습니다.', { exact: false }).waitFor();
  await page.locator('#source-reader-passages').getByText('마차 창밖으로 엄청난 군중을 보았습니다', { exact: false }).waitFor();
  const layout = await page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector), box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom,
        scrollHeight: element.scrollHeight, clientHeight: element.clientHeight };
    };
    return { viewport: { width: innerWidth, height: innerHeight }, document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      reader: rect('#source-reader'), passages: rect('#source-reader-passages'), complete: rect('#source-reader-complete') };
  });
  assert.ok(layout.document.width <= viewport.width, `horizontal overflow: ${JSON.stringify(layout)}`);
  assert.ok(layout.reader.x >= 0 && layout.reader.right <= viewport.width, `reader clipped horizontally: ${JSON.stringify(layout)}`);
  assert.ok(layout.reader.y >= 0 && layout.reader.bottom <= viewport.height, `reader clipped vertically: ${JSON.stringify(layout)}`);
  await page.screenshot({ path: path.join(out, `source-${viewport.width}x${viewport.height}.png`) });
  await page.locator('#source-reader-complete').click();
  await page.waitForFunction(() => !document.querySelector('#source-reader').open);
  const privateNoteChoice = page.locator('#actions button').filter({ hasText: '본 일을 개인 수첩에 적는다' });
  await privateNoteChoice.waitFor({ state: 'visible' });
  await assert.doesNotReject(async () => page.waitForFunction(() => {
    const button = [...document.querySelectorAll('#actions button')].find(item => item.innerText.includes('본 일을 개인 수첩에 적는다'));
    return button && !button.disabled;
  }, { timeout: 2500 }), 'reading the required source should immediately unlock the choice');
  await privateNoteChoice.click();
  const resultingState = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state);
  assert.equal(resultingState.quests.E41_SEMENOVSKY_1849.status, 'resolved');
  assert.equal(resultingState.world.livingEventStates.E41.status, 'ACTIVE', 'the personal record cannot change the fixed historical event');
  assert.equal(resultingState.world.livingEventStates.E41.playerChoiceActionId, 'KEEP_PRIVATE_NOTE');
  assert.deepEqual(errors, []);
  results.push({ ...layout, sourceLoaded: true, choiceSaved: true, pageErrors: errors });
  await context.close();
}
await browser.close();
await writeFile(path.join(out, 'BROWSER_ACCEPTANCE.json'), `${JSON.stringify({ status: 'PASS', base, results }, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
