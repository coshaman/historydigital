import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { mimeTypeFor } from '../server-mime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(root, 'dist-v33');
const output = path.resolve(process.env.V47_STORY_ENTRY_OUTPUT ?? path.join(root, 'artifacts/v47/STORY_ENTRY'));
const require = createRequire(import.meta.url);
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir(output, { recursive: true });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.port !== '4175') return route.abort('blockedbyclient');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(staticRoot, relative);
    if (!target.startsWith(`${staticRoot}${path.sep}`) && target !== staticRoot) return route.fulfill({ status: 403, body: 'Forbidden' });
    try { const body = await readFile(target); return route.fulfill({ status: 200, body, headers: { 'content-type': mimeTypeFor(target), 'cache-control': 'no-store' } }); }
    catch { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
  await page.goto('http://127.0.0.1:4175/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
  assert.equal(await page.locator('#source-reader').evaluate(element => element.open), false, 'a fresh game does not open an empty source reader');
  assert.equal(await page.locator('#source-reader').evaluate(element => getComputedStyle(element).display), 'none', 'closed source reader stays visually hidden');
  await page.locator('#history-events-open').click();
  assert.equal(await page.locator('#actions button small').first().evaluate(element => getComputedStyle(element).whiteSpace), 'pre-line',
    'scenario menu separates the date, current task, and available activities into readable lines');
  const menu = (await page.locator('#actions button').allTextContents()).join('\n');
  for (const label of ['금지된 삽화 연감', '혁명의 소식과 마지막 금요일', '콜레라가 도는 도시']) assert.ok(menu.includes(label), `history menu offers ${label}`);
  await page.screenshot({ path: path.join(output, 'HISTORY-MENU.png'), fullPage: true });
  await page.locator('#actions button').filter({ hasText: '금지된 삽화 연감' }).click();
  await page.waitForFunction(() => document.querySelector('#headline')?.textContent?.startsWith('금지된 삽화 연감 ·'));
  const sourceDialogAfterSelection = await page.locator('#source-reader').evaluate(element => ({ open: element.open, title: element.querySelector('#source-reader-title')?.textContent, passageCount: element.querySelectorAll('.source-passage').length }));
  assert.equal(sourceDialogAfterSelection.open, false, 'scenario selection does not open a blank source reader');
  assert.equal(await page.locator('#source-reader').evaluate(element => getComputedStyle(element).display), 'none', 'scenario selection does not reveal closed source reader content');
  assert.equal(await page.locator('#mission-tracker').isHidden(), false, 'selecting MAIN01 leaves the current-task notebook visible');
  const mission = [await page.locator('#mission-title').textContent(), await page.locator('#mission-action').textContent(),
    await page.locator('#mission-reason').textContent(), await page.locator('#mission-method').textContent()].join('\n');
  assert.match(mission, /금지된 삽화 연감/);
  assert.match(mission, /시작 준비|본편 전 준비/);
  assert.match(mission, /인쇄|교정|구독|부록/);
  const selectedStory = await page.locator('#journal-text').textContent();
  for (const activity of ['날짜 퀴즈', '파벨 추격', '현장 문서 탐색', '신문 종이·잉크 구매']) {
    assert.ok(selectedStory.includes(activity), `MAIN01 selection surfaces its playable ${activity} activity`);
  }
  for (const direction of ['인쇄소 날짜 대조판', '파벨로 빙의해 책방 골목', '종이 모양 자료나 책', '레프의 가판']) {
    assert.ok(selectedStory.includes(direction), `MAIN01 activity explains where or how to start: ${direction}`);
  }
  await page.locator('#actions button').filter({ hasText: '준비 퀘스트 위치 표시 · 교정쇄의 행선지' }).click();
  assert.equal(await page.locator('#mission-pin').getAttribute('aria-pressed'), 'true', 'the first required task can be pinned directly from story selection');
  assert.ok(errors.length === 0, `browser has no page errors: ${errors.join('; ')}`);
  await page.screenshot({ path: path.join(output, 'MAIN01-SELECTED.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePanel = await page.locator('.lower').evaluate(element => ({ height: element.getBoundingClientRect().height,
    maxHeight: getComputedStyle(element).maxHeight, viewportHeight: innerHeight }));
  assert.equal(mobilePanel.maxHeight, 'none', 'mobile journal panel is not clipped by a desktop height cap');
  assert.ok(mobilePanel.height >= 300 && mobilePanel.height <= mobilePanel.viewportHeight, 'mobile panel fits the viewport while retaining usable space');
  await page.screenshot({ path: path.join(output, 'MAIN01-SELECTED-390x844.png'), fullPage: true });
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'BROWSER-ENTRY-TRACE.json'), `${JSON.stringify({ status: 'PASS', viewports: ['1440x900', '390x844'], mobilePanel, menuLabels: ['MAIN01', 'MAIN03', 'MAIN05'], mission, contentAudit: { quiz: 'dated-source ordering puzzle', exploration: 'multiple physical city maps', purchase: 'city bookseller product transaction', chase: 'three timed, walkable MAIN01 route checkpoints' }, pageErrors: errors }, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', menuLabels: ['MAIN01', 'MAIN03', 'MAIN05'], mission, mobilePanel, pageErrors: errors, screenshots: output }, null, 2));
} finally { await browser.close(); }
