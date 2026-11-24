import assert from 'node:assert/strict';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { mimeTypeFor } from '../server-mime.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { availableDiscussionQuests } from '../rpg/engine/discussion-quests.mjs';

const require = createRequire(import.meta.url);
const game = require('../rpg/engine/game-state.js');
const definitions = require('../rpg/data/discussion-quests.json');
const inquiry = definitions.quests.find(quest => quest.id === 'INQUIRY_MAIN01_TALNIKOV_HOME');
const quests = toV47StoryQuests();
const scene = quests.find(quest => quest.id === inquiry.contextQuestId);
const mapId = scene.entry.mapId;
const loadDirectory = async directory => Promise.all((await readdir(directory))
  .filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(path.join(directory, name), 'utf8'))));
const [mapList, hostCards] = await Promise.all([loadDirectory('rpg/maps'), loadDirectory('rpg/characters')]);
const maps = Object.fromEntries(mapList.map(map => [map.mapId, map]));
attachV47StoryBeatObjects(maps, quests);
const seed = game.createInitialState({ maps, hostCards, quests, startMapId: mapId });
seed.world.date = scene.date;
seed.world.chapterId = scene.chapterId;
seed.world.v47.focusStoryId = scene.storyId;
seed.world.v47.stories[scene.storyId].currentEventId = scene.id;
for (const quest of quests.filter(quest => quest.storyId === scene.storyId && quest.date < scene.date)) {
  seed.quests[quest.id].status = 'resolved';
}
const actorId = 'panaeva_1848';
seed.player.embodiment = actorId;
const reading = game.recordSourceRead(seed, inquiry.sourceIds[0], maps);
assert.equal(reading.ok, true);
const state = reading.state;
const position = { x: 10, y: 10 };
for (const resident of Object.values(state.hosts)) {
  if (resident.mapId === mapId && game.nearTile(resident.position, position, 2)) resident.position = { x: 2, y: 2 };
}
state.player.position = position;
for (const [id, offset] of [[actorId, 0], ['editor_sofia', 2], ['midwife_avdotya', -1]]) {
  Object.assign(state.hosts[id], { mapId, historicalAliveAndPresent: true, position: { x: position.x + offset, y: position.y } });
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
const origin = 'http://127.0.0.1:4198';
const staticRoot = path.resolve('dist-v33');
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(10000);
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'ai_not_configured' } });
    const filename = path.resolve(staticRoot, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
    if (!filename.startsWith(`${staticRoot}${path.sep}`)) return route.abort();
    try { return route.fulfill({ body: await readFile(filename), contentType: mimeTypeFor(filename) }); }
    catch { return route.fulfill({ status: 404 }); }
  });
  await page.addInitScript(save => {
    if (!localStorage.getItem('v33-rpg-save')) localStorage.setItem('v33-rpg-save', save);
    localStorage.setItem('v34-tutorial-stage', 'done');
  }, game.saveGame(state));
  await page.goto(origin);
  await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
  if (await page.locator('#source-reader').isVisible()) await page.locator('#source-reader-close').click();
  const talk = page.locator('#talk');
  assert.match(await talk.innerText(), /아브도티야/);
  await page.locator('#journal-open').click();
  const question = page.locator('#journal-queue-discussion');
  assert.match(await question.innerText(), /소피야.*탈니코프/);
  await question.click();
  assert.match(await question.innerText(), /메인 목표로 돌아가기/);
  await question.click();
  assert.match(await page.locator('#journal-quest-title').innerText(), /작품의 가족을 두고 말하다/);
  await question.click();
  if (await page.locator('#journal-close').isVisible()) await page.locator('#journal-close').click();
  assert.match(await talk.innerText(), /소피야/, 'a queued quest witness takes priority over a closer NPC');
  await talk.click();
  await page.locator('.dialogue-input input').fill('안녕하세요.');
  await page.locator('.dialogue-input button').click();
  await page.waitForFunction(() => document.querySelector('#record').textContent.includes('실패'));
  assert.doesNotMatch(await page.locator('#mission-action').innerText(), /1\/2/);
  const questReply = page.locator('#actions .quest-dialogue-choice');
  await questReply.click();
  await page.waitForFunction(() => document.querySelector('#mission-action').textContent.includes('1/2'));
  assert.match(await page.locator('#journal-text').innerText(), /아이의 눈/);
  await page.getByRole('button', { name: '대화 마치기' }).click();
  assert.match(await talk.innerText(), /아브도티야/);
  await talk.click();
  await questReply.click();
  await page.waitForFunction(() => document.querySelector('#journal-text').textContent.includes('유모'));
  await page.getByRole('button', { name: '대화 마치기' }).click();
  await page.locator('#journal-open').click();
  const stance = page.locator('#journal-discussion-positions').getByRole('button', { name: inquiry.playerPositionChoices[0].labelKo });
  if (process.env.V47_BROWSER_OUTPUT) {
    await mkdir(process.env.V47_BROWSER_OUTPUT, { recursive: true });
    await stance.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(process.env.V47_BROWSER_OUTPUT, 'main01-discussion-stance-390.png') });
  }
  await stance.click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state);
  assert.equal(availableDiscussionQuests(saved, definitions).find(quest => quest.id === inquiry.id).completed, true);
  const notes = saved.player.dialogueGrowth.perspectiveNotes.filter(note => note.discussionId === inquiry.id);
  assert.deepEqual(notes.map(note => note.hostId), ['editor_sofia', 'midwife_avdotya']);
  assert.ok(notes.every(note => note.answerKo));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(browserErrors, []);
  console.log(JSON.stringify({ status: 'PASS', width: 390, api: '503', notes, stance: inquiry.playerPositionChoices[0].id, browserErrors }));
} finally {
  await browser.close();
}
