import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const cwd = decodeURIComponent(root.pathname).replace(/^\//, '').replaceAll('/', '\\');
const port = 4183;
const origin = `http://127.0.0.1:${port}`;
const screenshotDir = process.env.MAIN20_QA_SCREENSHOT_DIR;
const server = spawn(process.execPath, ['server.mjs'], { cwd, env: { ...process.env, CHANCERY_PORT: String(port) }, stdio: 'ignore' });
let browser;
const pageErrors = [];

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    await delay(100);
  }
  throw new Error('local test server did not start');
}

async function openWithState(viewport, state) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.addInitScript((value) => { if (!localStorage.getItem('chancery-main20-v35')) localStorage.setItem('chancery-main20-v35', JSON.stringify(value)); }, state);
  await page.goto(`${origin}/?main20=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20?.getState()), null, { timeout: 15000 });
  return page;
}

function baseState(overrides = {}) {
  return {
    schemaVersion: 'MAIN-20MIN-DIALOGUE-V36', phase: 'branch_hub', branchHubIndex: 0,
    routeChoices: [], branchState: {}, history: [], actions: [], flags: [], relationships: { alexei: 0, ekaterina: 0, pavel: 0 },
    ideology: {}, ideologyEvidence: [], beliefs: [], visibleCallbacks: [], ...overrides
  };
}

async function clickExact(page, name) {
  const button = page.getByRole('button', { name, exact: true });
  await button.first().waitFor({ state: 'visible', timeout: 5000 });
  await button.first().click();
}

async function passToBranchHub(page, expectedIndex = 1) {
  for (let guard = 0; guard < 5; guard += 1) {
    const state = await page.evaluate(() => window.__main20.getState());
    if (state.phase === 'branch_hub' && state.branchHubIndex === expectedIndex) return state;
    if (state.phase === 'branch_event') await clickExact(page, '다음 말을 듣는다').catch(async () => clickExact(page, '이 선택의 뒷말을 듣는다'));
    else if (state.phase === 'branch_callback') await clickExact(page, '다음 기록을 펼친다');
    else throw new Error(`Unexpected phase while advancing to hub ${expectedIndex}: ${state.phase}`);
  }
  throw new Error(`Hub ${expectedIndex} was not reached`);
}

try {
  await waitForServer();
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });

  const circle = await openWithState({ width: 1440, height: 900 }, baseState({ schemaVersion: 'MAIN-20MIN-DIALOGUE-V35' }));
  await clickExact(circle, '신문에서 읽고 선택지를 연다');
  await circle.locator('#choiceArea .main20-choice-card').nth(0).click();
  assert.equal((await circle.evaluate(() => window.__main20.getState())).phase, 'circle_learning');
  assert.equal(await circle.locator('body').evaluate((node) => node.classList.contains('main20-circle-warehouse')), true, 'warehouse scene atmosphere is active');
  assert.match(await circle.locator('#paperTitle').innerText(), /창고의 저녁 독서 모임|금요일 저녁/);
  assert.match(await circle.locator('#paperColumns').innerText(), /금요일마다 모여/);
  if (screenshotDir) await circle.screenshot({ path: join(screenshotDir, 'circle-learning-desktop.png'), fullPage: false });
  await clickExact(circle, '다음 쪽을 읽는다');
  await circle.locator('#saveBtn').click(); await circle.reload({ waitUntil: 'domcontentloaded' });
  await circle.waitForFunction(() => Boolean(window.__main20?.getState()));
  assert.equal((await circle.evaluate(() => window.__main20.getState())).circleLearningIndex, 1, 'learning page position survives reload');
  assert.equal((await circle.evaluate(() => window.__main20.getState())).schemaVersion, 'MAIN-20MIN-DIALOGUE-V36', 'legacy v35 save migrates to current schema');
  for (let i = 1; i < 4; i += 1) await clickExact(circle, i === 3 ? '책을 덮고 자리로 돌아간다' : '다음 쪽을 읽는다');
  assert.equal((await circle.evaluate(() => window.__main20.getState())).phase, 'branch_event');
  await passToBranchHub(circle, 1);
  await circle.close();

  const notes = await openWithState({ width: 1440, height: 900 }, baseState());
  await clickExact(notes, '신문에서 읽고 선택지를 연다'); await notes.locator('#choiceArea .main20-choice-card').nth(2).click();
  assert.equal((await notes.evaluate(() => window.__main20.getState())).phase, 'circle_learning', 'notes-only circle attendance still enters the lesson');
  await notes.close();

  const exam = await openWithState({ width: 1440, height: 900 }, baseState({ branchHubIndex: 1, routeChoices: ['CIRCLE-DECLINE'], branchState: { circleContact: 'declined' } }));
  await clickExact(exam, '신문에서 읽고 선택지를 연다');
  await exam.locator('#choiceArea .main20-choice-card').nth(0).click();
  assert.equal((await exam.evaluate(() => window.__main20.getState())).phase, 'exam_prep');
  assert.match(await exam.locator('#paperTitle').innerText(), /공개 교재/);
  assert.match(await exam.locator('#paperColumns').innerText(), /관등표가 나눈 세 갈래/);
  if (screenshotDir) await exam.screenshot({ path: join(screenshotDir, 'public-prep-desktop.png'), fullPage: false });
  await clickExact(exam, '같은 다섯 문제에 답한다');
  if (screenshotDir) await exam.screenshot({ path: join(screenshotDir, 'exam-question-desktop.png'), fullPage: false });
  for (let index = 0; index < 5; index += 1) {
    const options = exam.locator('#choiceArea .main20-exam-option');
    await options.nth(index < 3 ? 0 : 1).click();
    if (index === 1) {
      await exam.locator('#saveBtn').click(); await exam.reload({ waitUntil: 'domcontentloaded' });
      await exam.waitForFunction(() => Boolean(window.__main20?.getState()));
      const restored = await exam.evaluate(() => window.__main20.getState());
      assert.equal(restored.phase, 'exam_questions'); assert.equal(Object.keys(restored.examAnswers).length, 2);
    }
    await clickExact(exam, index === 4 ? '답안을 제출한다' : '다음 문제');
  }
  const passed = await exam.evaluate(() => window.__main20.getState());
  assert.equal(passed.examOutcome, 'passed'); assert.equal(passed.examCorrectCount, 3); assert.equal(passed.promotionStatus, 'promoted');
  assert.equal((await exam.locator('#paperTitle').innerText()).includes('통과했습니다'), true);
  if (screenshotDir) await exam.screenshot({ path: join(screenshotDir, 'exam-result-desktop.png'), fullPage: false });

  const failedExam = await openWithState({ width: 1440, height: 900 }, baseState({ branchHubIndex: 1, routeChoices: ['CIRCLE-DECLINE'], branchState: { circleContact: 'declined' } }));
  await clickExact(failedExam, '신문에서 읽고 선택지를 연다'); await failedExam.locator('#choiceArea .main20-choice-card').nth(0).click(); await clickExact(failedExam, '같은 다섯 문제에 답한다');
  for (let index = 0; index < 5; index += 1) {
    await failedExam.locator('#choiceArea .main20-exam-option').nth(index < 2 ? 0 : 1).click();
    await clickExact(failedExam, index === 4 ? '답안을 제출한다' : '다음 문제');
  }
  const failed = await failedExam.evaluate(() => window.__main20.getState());
  assert.equal(failed.examCorrectCount, 2); assert.equal(failed.examOutcome, 'failed'); assert.equal(failed.promotionStatus, 'not-promoted');
  await failedExam.close();

  for (const [choiceIndex, expected] of [[1, 'deferred'], [2, 'helped-peer']]) {
    const alternative = await openWithState({ width: 1280, height: 800 }, baseState({ branchHubIndex: 1, routeChoices: ['CIRCLE-DECLINE'], branchState: { circleContact: 'declined' } }));
    await clickExact(alternative, '신문에서 읽고 선택지를 연다'); await alternative.locator('#choiceArea .main20-choice-card').nth(choiceIndex).click();
    const alternativeState = await alternative.evaluate(() => window.__main20.getState());
    assert.equal(alternativeState.examOutcome, expected); assert.equal(alternativeState.examCorrectCount, null); assert.equal(alternativeState.promotionStatus, 'pending');
    await alternative.close();
  }

  const mobile = await openWithState({ width: 390, height: 844 }, baseState({ branchHubIndex: 1, routeChoices: ['CIRCLE-DECLINE'], branchState: { circleContact: 'declined' } }));
  await clickExact(mobile, '신문에서 읽고 선택지를 연다'); await mobile.locator('#choiceArea .main20-choice-card').nth(0).click(); await clickExact(mobile, '같은 다섯 문제에 답한다');
  const firstOption = mobile.locator('#choiceArea .main20-exam-option').first();
  const optionRect = await firstOption.boundingBox(); assert.ok(optionRect && optionRect.x >= 0 && optionRect.x + optionRect.width <= 390);
  await mobile.close();

  for (const endingId of ['UVAROV', 'BELINSKY', 'HERZEN', 'KHOMYAKOV', 'DOSTOEVSKY_PETRASHEVSKY']) {
    const endPage = await openWithState({ width: 1280, height: 900 }, baseState());
    await endPage.emulateMedia({ reducedMotion: 'reduce' });
    await endPage.evaluate((id) => { const state = window.__main20.getState(); state.phase = 'ending'; state.endingId = id; state.endingResolution = { endingId: id, beliefLedger: [], actionEvidence: [], supportingActions: [] }; window.__main20.restoreWindowSnapshot({ state }); }, endingId);
    const timeline = endPage.locator('#endingTimeline'); await timeline.waitFor({ state: 'visible', timeout: 8000 });
    if (screenshotDir && endingId === 'UVAROV') await endPage.screenshot({ path: join(screenshotDir, 'ending-timeline-desktop.png'), fullPage: false });
    assert.equal(await endPage.locator('#endingTitle').isVisible(), true);
    assert.equal(await endPage.locator('#endingTimeline .ending-timeline-track span').count(), 7);
    assert.equal(await endPage.locator('.dialogue-strip').evaluate((node) => getComputedStyle(node).display), 'none');
    await clickExact(endPage, '다음 시기'); assert.match(await endPage.locator('#endingTimeline .ending-timeline-progress').innerText(), /2 \/ 7/);
    await clickExact(endPage, '처음부터 다시 보기'); assert.match(await endPage.locator('#endingTimeline .ending-timeline-progress').innerText(), /1 \/ 7/);
    await endPage.close();
  }

  const mobileEnding = await openWithState({ width: 390, height: 844 }, baseState());
  await mobileEnding.evaluate((id) => { const state = window.__main20.getState(); state.phase = 'ending'; state.endingId = id; state.endingResolution = { endingId: id, beliefLedger: [], actionEvidence: [], supportingActions: [] }; window.__main20.restoreWindowSnapshot({ state }); }, 'HERZEN');
  const mobileTimelineButton = mobileEnding.locator('#endingTimelineNext');
  const mobileTimelineRect = await mobileTimelineButton.boundingBox(); assert.ok(mobileTimelineRect && mobileTimelineRect.x >= 0 && mobileTimelineRect.x + mobileTimelineRect.width <= 390);
  if (screenshotDir) await mobileEnding.screenshot({ path: join(screenshotDir, 'ending-timeline-mobile.png'), fullPage: false });
  await mobileEnding.close();

  assert.deepEqual(pageErrors, [], `browser console errors: ${pageErrors.join('; ')}`);
  console.log('main20 learning/exam browser acceptance: PASS (circle progress save/reload, public prep, 3/5 promotion, mobile bounds, 5 ending timelines)');
} finally {
  await browser?.close();
  server.kill();
}
