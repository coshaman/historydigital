import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = await import(process.env.V47_PLAYWRIGHT_MODULE ?? 'playwright');
import { mimeTypeFor } from '../server-mime.mjs';
import { attachV47StoryObjects } from '../rpg/data/v47-main-stories.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { availableDiscussionQuests } from '../rpg/engine/discussion-quests.mjs';

const require = createRequire(import.meta.url);
const game = require('../rpg/engine/game-state.js');
const definitions = require('../rpg/data/discussion-quests.json');
const main03 = process.argv.includes('--main03');
const almanacReview = process.argv.includes('--almanac-review');
const sample = main03
  ? { inquiryId: 'INQUIRY_MAIN03_ORDER_AND_CHANGE', actorId: 'student_vasily', firstId: 'minor_noble_andrei',
      secondId: 'student_vasily', nearbyId: 'printer_ekaterina', firstName: '안드레이', secondName: '바실리',
      nearbyName: '예카테리나', question: /안드레이.*지주/, sceneTitle: /자유를 말하는 사람/,
      firstAnswer: '내가 아는 지주들은 소작지가 비게 될까 걱정할 거요. 그렇다고 농노에게 이사를 금할 까닭이 될 수는 없소.',
      secondAnswer: '일할 곳과 살 곳부터 자기가 고를 수 있어야죠. 그걸 내놓으라고 하면 지주가 무얼 잃는지부터 셉디다.',
      typedQuestion: '지주는 농노가 스스로 일을 정하게 해 달라고 하면 혼란이라고 보겠습니까?' }
  : almanacReview
    ? { inquiryId: 'INQUIRY_MAIN01_BOUND_VOLUME', actorId: 'scribal_yuri', firstId: 'clerk_alexei',
      secondId: 'senior_clerk_konstantin', nearbyId: 'senior_clerk_konstantin', firstName: '알렉세이', secondName: '콘스탄틴 바라노프',
      nearbyName: '콘스탄틴', question: /알렉세이.*크릴로프/, sceneTitle: /크릴로프가 겁낸 독자/ }
    : { inquiryId: 'INQUIRY_MAIN01_TALNIKOV_HOME', actorId: 'panaeva_1848', firstId: 'editor_sofia',
      secondId: 'midwife_avdotya', nearbyId: 'midwife_avdotya', firstName: '소피야', secondName: '아브도티야',
      nearbyName: '아브도티야', question: /소피야.*탈니코프/, sceneTitle: /아버지의 집/ };
const inquiry = definitions.quests.find(quest => quest.id === sample.inquiryId);
if (almanacReview) {
  sample.firstAnswer = inquiry.hosts[sample.firstId].answerKo;
  sample.secondAnswer = inquiry.hosts[sample.secondId].answerKo;
}
const quests = toV47StoryQuests();
const scene = quests.find(quest => quest.id === inquiry.contextQuestId);
const mapId = scene.entry.mapId;
const loadDirectory = async directory => Promise.all((await readdir(directory))
  .filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(path.join(directory, name), 'utf8'))));
const [mapList, hostCards] = await Promise.all([loadDirectory('rpg/maps'), loadDirectory('rpg/characters')]);
const maps = Object.fromEntries(mapList.map(map => [map.mapId, map]));
attachV47StoryObjects(maps);
attachV47StoryBeatObjects(maps, quests);
const seed = game.createInitialState({ maps, hostCards, quests, startMapId: mapId });
seed.world.date = scene.date;
seed.world.chapterId = scene.chapterId;
seed.world.v47.focusStoryId = scene.storyId;
seed.world.v47.stories[scene.storyId].currentEventId = scene.id;
for (const quest of quests.filter(quest => quest.storyId === scene.storyId && quest.date < scene.date)) {
  seed.quests[quest.id].status = 'resolved';
}
seed.player.embodiment = sample.actorId;
let state = seed;
for (const sourceId of inquiry.sourceIds) {
  state.world.currentMapId = Object.values(maps).find(map => map.layers.some(layer =>
    layer.objects?.some(object => object.properties?.some(prop => prop.name === 'sourceId' && prop.value === sourceId)))).mapId;
  const reading = game.recordSourceRead(state, sourceId, maps);
  assert.equal(reading.ok, true, sourceId);
  state = reading.state;
}
state.world.currentMapId = mapId;
const position = { x: 10, y: 10 };
for (const resident of Object.values(state.hosts)) {
  if (resident.mapId === mapId && game.nearTile(resident.position, position, 2)) resident.position = { x: 2, y: 2 };
}
state.player.position = position;
for (const [id, offset] of [[sample.actorId, 0], [sample.firstId, 2], [sample.nearbyId, -1]]) {
  Object.assign(state.hosts[id], { mapId, historicalAliveAndPresent: true, position: { x: position.x + offset, y: position.y } });
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
const origin = 'http://127.0.0.1:4198';
const staticRoot = path.resolve('dist-v33');
const modelQuestions = [];
const { createRpgAiService, MemorySessionStore } = require('../ai/v33/session-runtime.cjs');
const service = main03 ? createRpgAiService({ secret: 'local-browser-test-signing-secret-only', store: new MemorySessionStore(),
  allowedOrigins: [origin], provider: { generate: async ({ input }) => {
    const discussion = input.conversation.sceneContext.discussionContext;
    if (discussion) modelQuestions.push({
      speaker: input.character.id, question: input.playerInput,
      sourceIds: discussion.sourceIds, view: discussion.speakerViewKo,
    });
    const textKo = !discussion ? '반갑소. 자리는 이쪽이오.'
      : input.character.id === sample.firstId ? sample.firstAnswer : sample.secondAnswer;
    return { schemaVersion: 'V33_RPG_DIALOGUE_V2', sceneId: input.scene.id,
      beats: [{ speakerId: input.character.id, textKo, emotion: 'neutral', claimIds: [] }],
      suggestedReplies: [{ id: 'R1', textKo: '그 이야기를 더 듣고 싶습니다.', tone: 'curious' },
        { id: 'R2', textKo: '그렇게 생각하시는군요.', tone: 'empathetic' }] };
  } } }) : null;
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(10000);
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      if (!service) return route.fulfill({ status: 503, json: { error: 'ai_not_configured' } });
      const result = await service.handle({ path: url.pathname, method: route.request().method(),
        origin, body: route.request().postDataJSON() });
      return route.fulfill({ status: result.status, json: result.body });
    }
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
  assert.ok((await talk.innerText()).includes(sample.nearbyName));
  await page.locator('#journal-open').click();
  const question = page.locator('#journal-queue-discussion');
  assert.match(await question.innerText(), sample.question);
  await question.click();
  assert.match(await question.innerText(), /메인 목표로 돌아가기/);
  await question.click();
  assert.match(await page.locator('#journal-quest-title').innerText(), sample.sceneTitle);
  await question.click();
  if (await page.locator('#journal-close').isVisible()) await page.locator('#journal-close').click();
  assert.ok((await talk.innerText()).includes(sample.firstName), 'a queued quest witness takes priority over a closer NPC');
  await talk.click();
  await page.locator('.dialogue-input input').fill('안녕하세요.');
  await page.locator('.dialogue-input button').click();
  await page.waitForFunction(status => document.querySelector('#record').textContent.includes(status), main03 ? 'AI 생성 답변' : '실패');
  assert.doesNotMatch(await page.locator('#mission-action').innerText(), /1\/2/);
  const questReply = page.locator('#actions .quest-dialogue-choice');
  if (sample.typedQuestion) {
    await page.locator('.dialogue-input input').fill(sample.typedQuestion);
    await page.locator('.dialogue-input button').click();
  } else await questReply.click();
  await page.waitForFunction(() => document.querySelector('#mission-action').textContent.includes('1/2'));
  assert.ok((await page.locator('#journal-text').innerText()).includes(sample.firstAnswer ?? '아이의 눈'));
  if (!main03) assert.doesNotMatch(await page.locator('#record').innerText(), /AI 생성 답변/);
  await page.getByRole('button', { name: '대화 마치기' }).click();
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
  if (await page.locator('#source-reader').isVisible()) await page.locator('#source-reader-close').click();
  assert.ok((await page.locator('#mission-action').innerText()).includes(`${sample.secondName}에게 물어보기 · 1/2`));
  if (main03) {
    assert.match(await page.locator('#mission-method').innerText(), /다른 주민에게 빙의/);
    assert.equal(await page.locator('#mission-pin').isDisabled(), true, 'the player cannot pin their own character as a destination');
    await page.locator('#roster-open').click();
    await page.locator('.roster-card').filter({ hasText: sample.nearbyName }).first().click();
    assert.match(await page.locator('#bodyname').innerText(), /예카테리나/);
  }
  assert.ok((await talk.innerText()).includes(sample.secondName));
  await talk.click();
  await questReply.click();
  await page.waitForFunction(answer => document.querySelector('#journal-text').textContent.includes(answer), sample.secondAnswer ?? '유모');
  await page.getByRole('button', { name: '대화 마치기' }).click();
  await page.locator('#journal-open').click();
  const stanceButtons = page.locator('#journal-discussion-positions button');
  assert.equal(await page.locator('#journal-goal-place').isVisible(), false);
  assert.equal(await stanceButtons.count(), 2);
  assert.ok(await stanceButtons.evaluateAll(buttons => buttons.every(button => {
    const { left, top, width, height } = button.getBoundingClientRect();
    return button.contains(document.elementFromPoint(left + width / 2, top + height / 2));
  })), 'both available positions are visible and clickable in the notebook without scrolling');
  const stance = page.locator('#journal-discussion-positions').getByRole('button', { name: inquiry.playerPositionChoices[0].labelKo });
  if (process.env.V47_BROWSER_OUTPUT) {
    await mkdir(process.env.V47_BROWSER_OUTPUT, { recursive: true });
    await stance.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(process.env.V47_BROWSER_OUTPUT, `${almanacReview ? 'main01-review' : scene.storyId.toLowerCase()}-discussion-stance-390.png`) });
  }
  await stance.click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state);
  assert.equal(availableDiscussionQuests(saved, definitions).find(quest => quest.id === inquiry.id).completed, true);
  const notes = saved.player.dialogueGrowth.perspectiveNotes.filter(note => note.discussionId === inquiry.id);
  assert.deepEqual(notes.map(note => note.hostId), [sample.firstId, sample.secondId]);
  assert.ok(notes.every(note => note.answerKo));
  assert.equal(saved.player.dialogueGrowth.trackedDiscussion, undefined);
  if (main03) {
    assert.deepEqual(notes.map(note => note.answerKo), [sample.firstAnswer, sample.secondAnswer]);
    assert.deepEqual(modelQuestions.map(item => item.speaker), [sample.firstId, sample.secondId]);
    assert.equal(modelQuestions[0].question, sample.typedQuestion);
    assert.ok(modelQuestions.every(item => item.view && inquiry.sourceIds.every(id => item.sourceIds.includes(id))));
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(browserErrors, []);
  const report = { status: 'PASS', storyId: scene.storyId, width: 390, api: service ? 'mock-model' : '503',
    targetRestoredAfterReload: true, notes, stance: inquiry.playerPositionChoices[0].id, modelQuestions, browserErrors };
  if (process.env.V47_BROWSER_OUTPUT) {
    await writeFile(path.join(process.env.V47_BROWSER_OUTPUT, `${almanacReview ? 'main01-review' : scene.storyId.toLowerCase()}-discussion.json`), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
