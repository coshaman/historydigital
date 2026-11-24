import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { mimeTypeFor } from '../server-mime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(root, 'dist-v33');
const output = path.join(root, 'artifacts/v47/MAIN01_INDEPENDENT_FIRST_PLAY');
const require = createRequire(import.meta.url);
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
require('../rpg/engine/game-state.js');
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const context = await browser.newContext({ viewport: { width: 1365, height: 768 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.port !== '4185') return route.abort('blockedbyclient');
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, body: 'offline during first-play UI check' });
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(staticRoot, relative);
    if (!target.startsWith(`${staticRoot}${path.sep}`) && target !== staticRoot) return route.fulfill({ status: 403, body: 'Forbidden' });
    try { return route.fulfill({ status: 200, body: await readFile(target), headers: { 'content-type': mimeTypeFor(target), 'cache-control': 'no-store' } }); }
    catch { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
  await page.goto('http://127.0.0.1:4185/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true', null, { timeout: 20000 });
  assert.equal(await page.locator('#history-events-open').isVisible(), true);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, '01-fresh-start.png'), fullPage: true });

  await page.locator('#history-events-open').click();
  const menu = await page.locator('#actions').innerText();
  assert.match(menu, /금지된 삽화 연감/);
  assert.match(menu, /구독 장부|인쇄소/);
  await page.screenshot({ path: path.join(output, '02-story-menu.png'), fullPage: true });

  await page.locator('#actions button').filter({ hasText: '금지된 삽화 연감' }).click();
  const objective = await page.locator('#mission-method').innerText();
  const actionText = await page.locator('#mission-action').innerText();
  assert.match(await page.locator('#mission-title').innerText(), /부록은 어디 있습니까/);
  assert.match(objective, /칸 이동한 뒤 E를 누르세요/);
  await page.screenshot({ path: path.join(output, '03-first-objective.png'), fullPage: true });

  const arrowKey = { 왼쪽: 'ArrowLeft', 오른쪽: 'ArrowRight', 위쪽: 'ArrowUp', 아래쪽: 'ArrowDown' };
  const movementLog = [];
  for (let step = 0; step < 24; step += 1) {
    const instruction = await page.locator('#mission-method').innerText();
    const move = instruction.match(/(왼쪽|오른쪽|위쪽?|아래쪽?)\s+(\d+)칸/);
    if (!move) break;
    const before = await page.evaluate(() => `${document.body.dataset.playerX},${document.body.dataset.playerY}`);
    for (let i = 0; i < Number(move[2]); i += 1) {
      const normalized = move[1] === '위' ? '위쪽' : move[1] === '아래' ? '아래쪽' : move[1];
      await page.keyboard.press(arrowKey[normalized]);
      await page.waitForTimeout(140);
    }
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => `${document.body.dataset.playerX},${document.body.dataset.playerY}`);
    movementLog.push({ instruction, before, after });
    if (before === after) throw new Error(`the displayed route did not move the player: ${JSON.stringify(movementLog.at(-1))}`);
  }
  const finalMethod = await page.locator('#mission-method').innerText();
  console.log('GUIDED_ROUTE_STEPS', JSON.stringify(movementLog));
  console.log('AT_FIRST_OBJECTIVE', JSON.stringify({ finalMethod,
    livePosition: await page.evaluate(() => ({ x: document.body.dataset.playerX, y: document.body.dataset.playerY })),
    movementLog }));
  assert.match(finalMethod, /목적지 곁에 있습니다|E를 누르세요/);
  await page.locator('#use').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(output, '04-first-interaction.png'), fullPage: true });
  const firstChoice = page.locator('#actions button').filter({ hasText: '구독 장부에서 이름을 찾는다' });
  await firstChoice.waitFor({ state: 'visible', timeout: 10000 });
  await page.screenshot({ path: path.join(output, '04-first-choice.png'), fullPage: true });
  await firstChoice.click();
  const journalAfterChoice = await page.locator('#journal-text').innerText();
  assert.match(journalAfterChoice, /예약 영수증/);
  const nextBeat = page.locator('#actions button').filter({ hasText: '3월 9일 자료로 이어가기' });
  await nextBeat.waitFor({ state: 'visible', timeout: 10000 });
  await page.screenshot({ path: path.join(output, '05-opening-complete.png'), fullPage: true });
  await nextBeat.click();
  await page.waitForFunction(() => document.body.innerText.includes('1848년 3월 9일'), null, { timeout: 10000 });
  assert.match(await page.locator('#mission-title').innerText(), /허가 도장과 아직 나가지 못한 책/);
  const nextMethod = await page.locator('#mission-method').innerText();
  assert.match(nextMethod, /칸 이동한 뒤 E를 누르세요/);
  assert.equal(errors.length, 0, `page errors: ${errors.join('; ')}`);
  await page.screenshot({ path: path.join(output, '06-march-objective.png'), fullPage: true });
  await page.locator('#roster-open').click();
  const roleEntry = page.locator('.roster-card').filter({ hasText: '예카테리나 벨로바' }).first();
  await roleEntry.waitFor({ state: 'visible', timeout: 5000 });
  await roleEntry.click();
  await page.waitForTimeout(400);
  console.log('AFTER_ROLE_SELECTION', JSON.stringify({ bodyName: await page.locator('#bodyname').innerText(),
    playerId: await page.evaluate(() => document.body.dataset.playerId),
    actions: await page.locator('#actions').innerText() }));
  await page.screenshot({ path: path.join(output, '07-role-selection.png'), fullPage: true });
  await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent.includes('예카테리나 벨로바'), null, { timeout: 5000 });
  const roleGuidance = {
    host: await page.locator('#bodyname').innerText(),
    map: await page.evaluate(() => document.body.dataset.worldMap),
    title: await page.locator('#mission-title').innerText(),
    action: await page.locator('#mission-action').innerText(),
    method: await page.locator('#mission-method').innerText(),
    destinationEnabled: await page.locator('#mission-pin').isEnabled(),
  };
  assert.match(roleGuidance.host, /예카테리나 벨로바/);
  assert.equal(roleGuidance.map, 'printshop');
  assert.match(roleGuidance.action, /인쇄 작업 1\/7/);
  assert.match(roleGuidance.method, /7단계를/);
  assert.equal(roleGuidance.destinationEnabled, true);
  const layoutMetrics = async () => page.evaluate(() => {
    const rect = selector => { const box = document.querySelector(selector)?.getBoundingClientRect(); return box && { top: box.top, bottom: box.bottom, height: box.height }; };
    const journal = document.querySelector('.journal');
    return { viewport: [innerWidth, innerHeight], page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      lower: rect('.lower'), journal: rect('.journal'), mission: rect('#mission-tracker'), method: rect('#mission-method'),
      journalScroll: { client: journal.clientHeight, scroll: journal.scrollHeight, overflow: getComputedStyle(journal).overflowY } };
  });
  const desktopLayout = await layoutMetrics();
  await page.screenshot({ path: path.join(output, '07-role-action-guidance.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await layoutMetrics();
  await page.screenshot({ path: path.join(output, '08-role-action-mobile.png'), fullPage: true });
  assert.ok(mobileLayout.page[0] <= mobileLayout.viewport[0], `mobile width overflow: ${JSON.stringify(mobileLayout)}`);
  const actionVisibleWithoutScroll = await page.locator('#mission-action').evaluate(action => {
    const bounds = action.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return action.contains(hit);
  });
  assert.equal(actionVisibleWithoutScroll, true, 'the focused story shows the next action without scrolling on mobile');
  assert.ok(mobileLayout.method.top >= 0 && mobileLayout.method.bottom <= mobileLayout.viewport[1]
    || mobileLayout.journalScroll.overflow === 'auto', `mobile task guidance is clipped without a scroll path: ${JSON.stringify(mobileLayout)}`);
  console.log(JSON.stringify({ status: 'PASS', actionText, firstObjective: objective, openingChoice: '구독 장부에서 이름을 찾는다', journal: journalAfterChoice,
    nextTitle: await page.locator('#mission-title').innerText(), nextAction: await page.locator('#mission-action').innerText(), nextMethod,
    roleGuidance, desktopLayout, mobileLayout, pageErrors: errors, screenshots: output }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
