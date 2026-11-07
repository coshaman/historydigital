import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd(), base = process.env.V37_APP_URL ?? 'http://127.0.0.1:4173/';
const output = path.join(root, 'artifacts/v37/E39_BROWSER_QA');
const read = async url => JSON.parse(await readFile(new URL(url, import.meta.url), 'utf8'));
const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/v37-physiology-reading-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
let state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'bookshop-interior' });
state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 840;
state.world.currentMapId = 'bookshop-interior';
for (const id of ['reader_darya', 'student_vasily', 'bookseller_lev']) {
  state.hosts[id].mapId = 'bookshop-interior'; state.hosts[id].position = { x: 12, y: 12 };
}
state.player.embodiment = 'reader_darya'; state.player.position = { x: 12, y: 12 };
const readResult = game.recordSourceRead(state, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', maps);
assert.equal(readResult.ok, true, readResult.reason);
state = game.advanceNpcWorld(readResult.state, 1, maps, { pausedHostIds: ['reader_darya', 'student_vasily', 'bookseller_lev'] });
assert.equal(state.world.livingEventStates.E39.stage, 'DISCUSSION_READY');
const save = game.saveGame(state);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport }), page = await context.newPage(), errors = [];
  page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); }, save);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent.includes('다리야'));
  await page.locator('#use').click();
  const choice = page.locator('#actions button').filter({ hasText: '호리와 칼리니치가 살아가는 방식을 견줘 본다' });
  await choice.waitFor({ state: 'visible' });
  assert.ok(await choice.isEnabled());
  const geometry = await page.evaluate(() => {
    const button = document.querySelector('#actions button'), rect = button.getBoundingClientRect();
    return { documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
      button: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom } };
  });
  assert.ok(geometry.documentWidth <= viewport.width, `horizontal overflow: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.button.x >= 0 && geometry.button.right <= viewport.width, `choice is clipped: ${JSON.stringify(geometry)}`);
  await page.screenshot({ path: path.join(output, `e39-choice-${viewport.width}x${viewport.height}.png`) });
  await choice.click();
  await page.waitForFunction(() => {
    const stored = JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null');
    return stored?.state?.world?.livingEventStates?.E39?.stage === 'LIVES_COMPARED';
  });
  const result = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
    const event = stored.world.livingEventStates.E39;
    return { stage: event.stage, choice: event.resolutionActionId,
      privateNote: stored.hosts.reader_darya.personalEventNotes?.some(note => note.eventId === 'E39'),
      bookStillInShop: event.copy.location === '책방 선반' };
  });
  assert.deepEqual(errors, []); assert.equal(result.privateNote, true); assert.equal(result.bookStillInShop, true);
  results.push({ viewport, geometry, result, pageErrors: errors });
  await context.close();
}
await browser.close();
await writeFile(path.join(output, 'BROWSER_ACCEPTANCE.json'), `${JSON.stringify({ status: 'PASS', base, results }, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
