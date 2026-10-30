import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4173/';
const out = path.join(root, 'artifacts', 'v33');
const readJson = file => fs.readFile(path.join(root, file), 'utf8').then(JSON.parse);
const [campaign, mapsList, cards, quests, sources, firstSource, firstIssue, learningExam] = await Promise.all([
  readJson('rpg/quests/campaign.json'),
  Promise.all(['nevsky', 'printshop', 'chancery', 'courtyard', 'dead-souls'].map(id => readJson(`rpg/maps/${id}.json`))),
  Promise.all(['clerk_alexei', 'printer_ekaterina', 'courier_pavel', 'seamstress_anna', 'tenant_mikhail', 'bookseller_lev', 'nekrasov_reconstruction', 'literary_chichikov'].map(id => readJson(`rpg/characters/${id}.json`))),
  Promise.all(['printshop-article', 'public-discourse-1848', 'circle-investigation-1849', 'circle-letter-1849-may', 'literary-dead-souls'].map(id => readJson(`rpg/quests/${id}.json`))),
  readJson('rpg/data/historical-source-packets.json'),
  readJson('rpg/data/khor-kalynych-source.json'),
  readJson('rpg/data/sovremennik-1847-issue.json'),
  readJson('rpg/data/learning-exam.json'),
]);
const mapById = Object.fromEntries(mapsList.map(map => [map.mapId, map]));
const cardById = Object.fromEntries(cards.map(card => [card.id, card]));
const questById = Object.fromEntries(quests.map(quest => [quest.id, quest]));
const sourceById = new Map([firstSource, firstIssue, ...sources.records].map(record => [record.sourceId, record]));
const keyByDirection = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const directions = Object.entries({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });
const endingId = process.argv.find(argument => argument.startsWith('--case='))?.slice('--case='.length) ?? 'HERZEN';
const ending = campaign.endings.find(item => item.id === endingId);
assert.ok(ending, `unknown ending case ${endingId}`);

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const recordVideo = process.env.V33_RECORD_VIDEO === '1';
const contextOptions = { viewport: { width: 1440, height: 900 } };
if (recordVideo) contextOptions.recordVideo = { dir: path.join(out, 'videos'), size: { width: 1440, height: 900 } };
const context = await browser.newContext(contextOptions);
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
const report = { schemaVersion: 'V33_CAMPAIGN_BROWSER_SMOKE_V1', base, endingId, status: 'RUNNING', steps: [], errors };

function distance(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function objectTile(object) { return { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) }; }
function objectProps(object) { return Object.fromEntries((object.properties ?? []).map(property => [property.name, property.value])); }
function findObject(mapId, predicate) {
  const map = mapById[mapId];
  const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(predicate);
  assert.ok(object, `interaction object missing on ${mapId}`);
  return object;
}
async function snapshot() {
  await page.locator('#save').click();
  const envelope = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save') || 'null'));
  assert.ok(envelope?.state, 'save button should serialize the live campaign state');
  return envelope.state;
}
function actorState(state) { return state.player.embodiment ? state.hosts[state.player.embodiment] : state.player; }
function passable(map, state, x, y, blocked) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  if (map.layers.find(layer => layer.name === 'Collision').data[y * map.width + x] !== 0 || blocked.has(`${x},${y}`)) return false;
  return !Object.values(state.hosts).some(host => host.id !== state.player.embodiment && host.mapId === map.mapId && host.position.x === x && host.position.y === y);
}
function routeTo(state, mapId, target, maxDistance, extraGoal = () => true, blocked = new Set()) {
  const map = mapById[mapId], start = actorState(state).position;
  const queue = [{ ...start }], previous = new Map([[`${start.x},${start.y}`, null]]);
  let end = null;
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    if (distance(cell, target) <= maxDistance && extraGoal(cell)) { end = cell; break; }
    for (const [, [dx, dy]] of directions) {
      const next = { x: cell.x + dx, y: cell.y + dy }, key = `${next.x},${next.y}`;
      if (!previous.has(key) && passable(map, state, next.x, next.y, blocked)) { previous.set(key, `${cell.x},${cell.y}`); queue.push(next); }
    }
  }
  if (!end) return null;
  const steps = [];
  let key = `${end.x},${end.y}`;
  while (previous.get(key) !== null) {
    const [x, y] = key.split(',').map(Number), parent = previous.get(key).split(',').map(Number);
    steps.push(Object.keys(keyByDirection).find(name => directions.find(([candidate]) => candidate === name)[1][0] === x - parent[0] && directions.find(([candidate]) => candidate === name)[1][1] === y - parent[1]));
    key = previous.get(key);
  }
  return steps.reverse();
}
async function moveNear(mapId, target, maxDistance = 1, extraGoal = () => true) {
  const blocked = new Set();
  for (let attempts = 0; attempts < 160; attempts++) {
    const state = await snapshot();
    assert.equal(state.world.currentMapId, mapId, `movement expected on ${mapId}, got ${state.world.currentMapId}`);
    const actor = actorState(state);
    if (distance(actor.position, target) <= maxDistance && extraGoal(actor.position)) return;
    const route = routeTo(state, mapId, target, maxDistance, extraGoal, blocked);
    assert.ok(route?.length, `no walkable path from ${JSON.stringify(actor.position)} to ${JSON.stringify(target)} on ${mapId}`);
    const direction = route[0], [dx, dy] = directions.find(([name]) => name === direction)[1];
    const expected = { x: actor.position.x + dx, y: actor.position.y + dy };
    await page.keyboard.press(keyByDirection[direction]);
    const movedState = await snapshot(), movedActor = actorState(movedState);
    if (movedActor.position.x === expected.x && movedActor.position.y === expected.y) blocked.clear();
    else blocked.add(`${expected.x},${expected.y}`);
  }
  throw new Error(`movement exceeded 160 steps on ${mapId} toward ${JSON.stringify(target)}`);
}
async function interact() { await page.keyboard.press('e'); }
async function possess(hostId) {
  const state = await snapshot(), host = state.hosts[hostId];
  assert.ok(host, `unknown host ${hostId}`);
  assert.equal(host.mapId, state.world.currentMapId, `${hostId} must be physically present before possession`);
  const competingTargets = mapById[state.world.currentMapId].layers.find(layer => layer.name === 'Interactions').objects.filter(object => object.type === 'source' || object.type === 'map-exit').map(objectTile);
  await moveNear(state.world.currentMapId, host.position, 2, tile => competingTargets.every(target => distance(tile, target) > 1));
  await interact();
  const personChoice = page.getByRole('button', { name: `${cardById[hostId].displayNameKo} 살펴보기`, exact: false });
  if (await personChoice.count()) await personChoice.click();
  const borrowAction = page.getByRole('button', { name: '몸을 빌린다' });
  if (!(await borrowAction.count())) {
    const observed = await page.evaluate(() => ({ headline: document.querySelector('#headline').textContent, actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText), body: document.querySelector('#bodyname').textContent }));
    throw new Error(`No possession action for ${hostId}; ${JSON.stringify(observed)}`);
  }
  await borrowAction.click();
  await page.getByText(`몸을 빌림 · ${cardById[hostId].displayNameKo}`).waitFor();
  const after = await snapshot();
  assert.equal(after.player.embodiment, hostId);
  report.steps.push({ type: 'possession', hostId, mapId: after.world.currentMapId, position: after.hosts[hostId].position });
}
async function release() {
  await page.locator('#release').click();
  const state = await snapshot();
  assert.equal(state.player.embodiment, null);
}
async function transitionTo(exitId, targetMapId) {
  const mapId = (await snapshot()).world.currentMapId;
  const exit = findObject(mapId, object => object.type === 'map-exit' && objectProps(object).exitId === exitId);
  await moveNear(mapId, objectTile(exit), 1);
  await interact();
  await page.waitForFunction(expected => document.querySelector('#place').textContent === expected, mapById[targetMapId].metadata.displayNameKo);
  const state = await snapshot();
  assert.equal(state.world.currentMapId, targetMapId);
  report.steps.push({ type: 'map-transition', from: mapId, to: targetMapId, exitId });
}
async function readSource(mapId, sourceId, avoidObjectId = null) {
  const sourceObject = findObject(mapId, object => object.type === 'source' && objectProps(object).sourceId === sourceId);
  const avoidObject = avoidObjectId == null ? null : findObject(mapId, object => object.id === avoidObjectId);
  const avoidTile = avoidObject ? objectTile(avoidObject) : null;
  const interactions = mapById[mapId].layers.find(layer => layer.name === 'Interactions').objects;
  const initialState = await snapshot();
  await moveNear(mapId, objectTile(sourceObject), 1, tile => {
    if (avoidTile && distance(tile, avoidTile) <= 1) return false;
    // E prioritizes quest objects, then exits and NPCs over source documents.
    // Stand on a reachable tile where the source is the unambiguous target.
    return interactions.every(object => {
      if (object.id === sourceObject.id) return true;
      const props = objectProps(object);
      if (object.type === 'quest-object') {
        const quest = questById[props.questId];
        if (!quest || quest.chapterId !== initialState.world.chapterId || initialState.quests[quest.id]?.status === 'resolved') return true;
        return distance(tile, objectTile(object)) > 1;
      }
      if (object.type === 'map-exit') return distance(tile, objectTile(object)) > 1;
      if (object.type === 'npc' && props.hostId !== initialState.player.embodiment) {
        const host = initialState.hosts[props.hostId];
        return !host || distance(tile, host.position) > 2;
      }
      return true;
    });
  });
  await interact();
  const source = sourceById.get(sourceId);
  assert.ok(source, `source record ${sourceId} is registered`);
  await page.getByRole('button', { name: '원문과 번역 펼치기' }).waitFor();
  assert.equal(await page.locator('#headline').innerText(), source.titleKo);
  await page.getByRole('button', { name: '원문과 번역 펼치기' }).click();
  const renderedText = await page.locator('#journal-text').innerText();
  assert.ok(renderedText.includes(source.paragraphs[0].ru), `${sourceId} Russian source paragraph rendered`);
  assert.ok(renderedText.includes(source.paragraphs[0].ko), `${sourceId} aligned Korean translation rendered`);
  const state = await snapshot();
  assert.ok(state.ledger.some(event => event.sourceId === sourceId), `${sourceId} reading is ledgered`);
  report.steps.push({ type: 'source-read', sourceId, hostId: state.player.embodiment, mapId, titleKo: source.titleKo });
}
async function readUnlockedSource(sourceId) {
  const source = sourceById.get(sourceId);
  assert.ok(source, `source record ${sourceId} is registered`);
  await page.locator('#source-drawer-open').click();
  await page.getByRole('button', { name: source.titleKo, exact: false }).click();
  await page.getByRole('button', { name: '원문과 번역 펼치기' }).waitFor();
  await page.getByRole('button', { name: '원문과 번역 펼치기' }).click();
  const renderedText = await page.locator('#journal-text').innerText();
  assert.ok(renderedText.includes(source.paragraphs[0].ru), `${sourceId} Russian source paragraph rendered in the source drawer`);
  assert.ok(renderedText.includes(source.paragraphs[0].ko), `${sourceId} aligned Korean translation rendered in the source drawer`);
  const state = await snapshot();
  assert.ok(state.ledger.some(event => event.sourceId === sourceId && event.hostId === null && event.readingMode === 'PLAYER_ARCHIVE'), `${sourceId} archive reading is recorded as player research, not host knowledge`);
  assert.ok(!state.hosts[state.player.embodiment].knownEvidenceIds.includes(sourceId), `${sourceId} archive reading does not enter the embodied host's memory`);
  report.steps.push({ type: 'archive-source-read', sourceId, hostId: null, embodiedHostId: state.player.embodiment, mapId: state.world.currentMapId, titleKo: source.titleKo });
}
async function completeQuest(questId, actionId, { avoidObjectId = null } = {}) {
  const quest = questById[questId], action = quest.actions.find(item => item.id === actionId);
  assert.ok(action, `${questId}/${actionId} exists`);
  const object = findObject(quest.entry.mapId, item => item.id === quest.entry.objectId);
  const avoidObject = avoidObjectId == null ? null : findObject(quest.entry.mapId, item => item.id === avoidObjectId);
  const avoidTile = avoidObject ? objectTile(avoidObject) : null;
  await moveNear(quest.entry.mapId, objectTile(object), 1, tile => !avoidTile || distance(tile, avoidTile) > 1);
  await interact();
  await page.getByRole('button', { name: action.labelKo, exact: false }).waitFor();
  await page.getByRole('button', { name: action.labelKo, exact: false }).click();
  await page.getByText(action.resultKo.slice(0, Math.min(action.resultKo.length, 24))).waitFor();
  const state = await snapshot();
  assert.equal(state.quests[questId].status, 'resolved', `${questId} resolves through the in-game choice`);
  const event = [...state.ledger].reverse().find(item => item.actionId === actionId);
  assert.ok(event, `${actionId} is recorded in the live browser state`);
  report.steps.push({ type: 'quest-action', questId, actionId, hostId: event.hostId, effectsApplied: event.effectsApplied });
  return { state, action };
}
async function continueCampaign(buttonPattern) {
  const button = page.locator('#actions button').filter({ hasText: buttonPattern }).first();
  await button.waitFor();
  await button.click();
}
async function completeLearningArc() {
  const circleChoice = endingId === 'HERZEN' ? '초대를 사양한다' : endingId === 'KHOMYAKOV' ? '모임에 참석한다' : '참석해 책 제목만 적는다';
  await page.getByRole('button', { name: circleChoice, exact: false }).click();
  for (let index = 0; index < learningExam.learningUnits.length; index++) {
    await page.getByRole('button', { name: /다음 자료|시험 선택으로/ }).click();
  }
  if (endingId === 'HERZEN') await page.getByRole('button', { name: '이번 회차를 미룬다' }).click();
  else if (endingId === 'KHOMYAKOV') await page.getByRole('button', { name: '파벨과 함께 공부한다' }).click();
  else {
    await page.getByRole('button', { name: '시험에 응시한다' }).click();
    for (const [index, question] of learningExam.questions.entries()) {
      const answer = endingId === 'BELINSKY' && index >= 2
        ? question.options.find(option => option.id !== learningExam.answerKey[question.id])
        : question.options.find(option => option.id === learningExam.answerKey[question.id]);
      await page.locator(`input[name="${question.id}"][value="${answer.id}"]`).check();
    }
    await page.getByRole('button', { name: '답안을 제출한다' }).click();
  }
  await page.getByRole('button', { name: '마지막 기록으로 이어간다' }).click();
  await page.locator('#learning-screen').waitFor({ state: 'hidden' });
}

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#world');

  // 1847: read the periodical physically and resolve the proof decision.
  await transitionTo('nevsky-printshop-door', 'printshop');
  await possess('printer_ekaterina');
  await readSource('printshop', 'OBJ-SOV-1847', 20);
  await readSource('printshop', 'LIT-TURGENEV-KHOR-KALYNYCH-1847', 20);
  const printAction = endingId === 'BELINSKY' ? 'ASK_FOR_SOURCE' : endingId === 'UVAROV' ? 'RETURN_MANUSCRIPT' : 'HOLD_FOR_CORRECTION';
  await completeQuest('PRINTSHOP_PROOF_1847', printAction);
  await page.locator('#save').click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('교정쇄에 남긴 결정').waitFor();
  await continueCampaign(/1848년으로 이어가기/);
  await page.waitForFunction(() => document.querySelector('#world-date').textContent.includes('1848'));

  // 1848: visit the reconstructed editor, then carry the notice as the courier.
  await possess('nekrasov_reconstruction');
  await transitionTo('printshop-nevsky-door', 'nevsky');
  await release();
  await page.locator('#save').click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#world');
  const arrivedNekrasov = await snapshot();
  assert.equal(arrivedNekrasov.hosts.nekrasov_reconstruction.mapId, 'nevsky', 'the historical reconstruction remains at the legal exit arrival after save/load');
  await possess('nekrasov_reconstruction');
  report.steps.push({ type: 'repossess-after-map-arrival-and-reload', hostId: 'nekrasov_reconstruction', mapId: 'nevsky' });
  await moveNear('nevsky', { x: 20, y: 9 }, 0);
  report.steps.push({ type: 'move-host-clear-of-exit', hostId: 'nekrasov_reconstruction', position: (await snapshot()).hosts.nekrasov_reconstruction.position });
  await release();
  await possess('courier_pavel');
  await transitionTo('nevsky-printshop-door', 'printshop');
  await readSource('printshop', 'OBJ-WS-NEKRASOV-EDITORIAL-1848', 26);
  if (endingId === 'HERZEN') {
    const beforePostage = (await snapshot()).hosts.courier_pavel.money.amount;
    await completeQuest('PUBLIC_DISCOURSE_1848', 'CARRY_NOTICE_ABROAD');
    const afterPostage = (await snapshot()).hosts.courier_pavel.money.amount;
    assert.equal(beforePostage - afterPostage, 4, 'courier postage is charged to the courier pocket');
  } else {
    await release();
    await possess('printer_ekaterina');
    await readUnlockedSource('OBJ-WS-NEKRASOV-EDITORIAL-1848');
    const publicAction = endingId === 'KHOMYAKOV' ? 'KEEP_LOCAL_READING' : 'HOLD_NOTICE';
    await completeQuest('PUBLIC_DISCOURSE_1848', publicAction);
  }
  await continueCampaign(/1849년으로 이어가기/);
  await page.waitForFunction(() => document.querySelector('#world-date').textContent.includes('1849'));
  await page.waitForFunction(() => document.querySelector('#place').textContent === '관청 접수실');

  // 1849: inspect the report and later letter from the clerk's actual office, preserving history.
  await possess('clerk_alexei');
  await readSource('chancery', 'OBJ-WS-PETRASHEVSKY-REPORT-1849', 32);
  const reportAction = endingId === 'DOSTOEVSKY_PETRASHEVSKY' ? 'REFUSE_NAMING' : 'FILE_OFFICIAL_REPORT';
  await completeQuest('CIRCLE_INVESTIGATION_1849', reportAction, { avoidObjectId: 33 });
  await continueCampaign(/5월 5일 자료로 이어가기/);
  await page.waitForFunction(() => document.querySelector('#calendar-date').textContent.includes('5월 5일'));
  await readSource('chancery', 'OBJ-WS-MIKHAIL-DOSTOEVSKY-LETTER-1849', 33);
  const letterAction = endingId === 'DOSTOEVSKY_PETRASHEVSKY' ? 'REFUSE_NAMING' : 'PRESERVE_LETTER';
  await completeQuest('CIRCLE_LETTER_1849_MAY', letterAction, { avoidObjectId: 32 });
  const final = await snapshot();
  await continueCampaign(/마지막 기록을 정리한다/);
  await completeLearningArc();
  const learned = await snapshot();
  assert.equal(learned.learning.phase, 'complete');
  assert.ok(['passed', 'failed', 'deferred', 'helped-peer'].includes(learned.learning.examOutcome));
  await page.getByRole('button', { name: ending.titleKo, exact: false }).waitFor();
  await page.getByRole('button', { name: ending.titleKo, exact: false }).click();
  await page.locator('#ending-screen:not([hidden])').waitFor();

  const distinctHosts = [...new Set(final.world.possessionHistory.map(event => event.hostId))];
  const resolvedQuests = Object.entries(final.quests).filter(([, quest]) => quest.status === 'resolved').map(([id]) => id);
  const sourceIds = [...new Set(final.ledger.flatMap(event => event.sourceIds ?? (event.sourceId ? [event.sourceId] : [])))];
  assert.deepEqual(resolvedQuests.sort(), campaign.arcs.flatMap(arc => arc.questIds).sort());
  assert.ok(distinctHosts.length >= 4, `four real-world host perspectives required: ${distinctHosts}`);
  assert.ok(sourceIds.length >= 3, `three or more source records required: ${sourceIds}`);
  const expectedOutcomes = Object.fromEntries(quests.filter(quest => quest.chapterId !== 'LITERARY_DEAD_SOULS').map(quest => [quest.historicalOutcome.id, quest.historicalOutcome.value]));
  assert.deepEqual(final.world.immutableOutcomes, expectedOutcomes);
  assert.equal(await page.locator('#ending-title').innerText(), ending.titleKo);
  assert.ok((await page.locator('#ending-comparison-text').innerText()).length > 40);
  assert.match(await page.locator('#ending-life-episode').innerText(), /가상의 서기/);
  assert.equal(await page.locator('#ending-life-next').isVisible(), true);
  await page.locator('#ending-life-next').click();
  assert.match(await page.locator('#ending-life-progress').innerText(), /2 \/ 7/);
  assert.equal(await page.locator('.playfield').isVisible(), false);
  assert.equal(errors.length, 0, errors.join('; '));
  const screenshot = `campaign-full-run-${endingId.toLowerCase()}-1440x900.png`;
  await page.screenshot({ path: path.join(out, screenshot), fullPage: true });
  report.status = 'PASS';
  report.final = { endingId, chapterId: final.world.chapterId, date: final.world.date, mapId: final.world.currentMapId, resolvedQuests, hostIds: distinctHosts, sourceIds, learning: learned.learning, immutableOutcomes: final.world.immutableOutcomes };
  report.screenshot = `artifacts/v33/${screenshot}`;
} catch (error) {
  report.status = 'FAIL';
  report.error = String(error?.stack ?? error);
  try {
    const state = await snapshot();
    report.failureState = { chapterId: state.world.chapterId, date: state.world.date, mapId: state.world.currentMapId, embodiment: state.player.embodiment, quests: state.quests, ledgerTail: state.ledger.slice(-8) };
    await page.screenshot({ path: path.join(out, 'campaign-full-run-failure-1440x900.png'), fullPage: true });
  } catch {}
} finally {
  await context.close();
  if (recordVideo) report.video = path.relative(root, await page.video().path()).replaceAll('\\', '/');
  await browser.close();
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, `CAMPAIGN_BROWSER_SMOKE_${endingId}.json`), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
