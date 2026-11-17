import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { mimeTypeFor } from '../server-mime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.join(root, 'dist');
const output = path.join(root, 'artifacts/v47/MAIN01_BETA_TEST');
const require = createRequire(import.meta.url);
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || url.port !== '4185') return route.abort('blockedbyclient');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(staticRoot, relative);
    if (!target.startsWith(`${staticRoot}${path.sep}`) && target !== staticRoot) return route.fulfill({ status: 403, body: 'Forbidden' });
    try { return route.fulfill({ status: 200, body: await readFile(target), headers: { 'content-type': mimeTypeFor(target), 'cache-control': 'no-store' } }); }
    catch { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
  await page.goto('http://127.0.0.1:4185/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
  if (await page.locator('#tutorial-skip').isVisible()) await page.locator('#tutorial-skip').click();
  await page.locator('#history-events-open').click();
  await page.locator('#actions button').filter({ hasText: '금지된 삽화 연감' }).click();
  assert.match(await page.locator('#headline').textContent(), /^금지된 삽화 연감 ·/);
  assert.match(await page.locator('#mission-title').textContent(), /부록은 어디 있습니까/);

  for (let i = 0; i < 10; i += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('e');
  await page.locator('#actions button').filter({ hasText: '구독 장부에서 이름을 찾는다' }).waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#actions button').filter({ hasText: '구독 장부에서 이름을 찾는다' }).click();
  assert.match(await page.locator('#journal-text').textContent(), /부록 예약 영수증/);
  await page.locator('#actions button').filter({ hasText: '3월 9일 자료로 이어가기' }).click();
  await page.waitForTimeout(300);
  if (!String(await page.locator('#headline').textContent()).includes('허가 도장')) {
    console.log('PROGRESSION_DIAGNOSTIC', JSON.stringify({ headline: await page.locator('#headline').textContent(),
      body: (await page.locator('body').innerText()).slice(-1200), journal: await page.locator('#journal-text').textContent(),
      buttons: await page.locator('#actions button').allTextContents(),
      saved: await page.evaluate(() => { const raw = localStorage.getItem('v33-rpg-save'); try { const envelope = JSON.parse(raw); const s = envelope.state; return { date: s.world?.date, chapter: s.world?.chapterId,
        focus: s.world?.v47?.focusStoryId, quests: Object.fromEntries(Object.entries(s.quests ?? {}).filter(([id]) => id.includes('V47_MAIN01')).map(([id, q]) => [id, q.status])) }; } catch { return raw?.slice(0,100); } }) }));
    throw new Error('The MAIN01 continuation action did not open the March 9 scene');
  }
  assert.match(await page.locator('body').innerText(), /1848년 3월 9일/);
  assert.match(await page.locator('#mission-title').textContent(), /허가 도장과 아직 나가지 못한 책/);
  assert.equal(errors.length, 0, `browser page errors: ${errors.join('; ')}`);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'MAIN01-PROGRESSION-1365x768.png'), fullPage: true });
  for (let i = 0; i < 10; i += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('e');
  await page.waitForTimeout(700);
  const nextScene = { map: await page.locator('#map-name').textContent().catch(() => null),
    title: await page.locator('#headline').textContent(), mission: await page.locator('#mission-action').textContent(),
    buttons: await page.locator('#actions button').allTextContents() };
  await page.screenshot({ path: path.join(output, 'MAIN01-PERMISSION-INTERACTION-1365x768.png'), fullPage: true });
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  const printshopArrival = { title: await page.locator('#headline').textContent(),
    mission: await page.locator('#mission-action').textContent(), body: (await page.locator('body').innerText()).slice(-900) };
  await page.screenshot({ path: path.join(output, 'MAIN01-PRINTSHOP-ARRIVAL-1365x768.png'), fullPage: true });
  await page.getByRole('button', { name: '놓아주기' }).click();
  await page.getByRole('button', { name: '인물 목록' }).click();
  await page.locator('.roster-card').filter({ hasText: '알렉세이 오를로프' }).click({ force: true });
  await page.waitForTimeout(300);
  const possessedHost = { mission: await page.locator('#mission-action').textContent(),
    host: await page.locator('#host-status').textContent().catch(() => null), title: await page.locator('#headline').textContent() };
  assert.match(possessedHost.title, /알렉세이 오를로프/);
  assert.match(possessedHost.mission, /네프스키 인쇄소/);
  assert.equal(errors.length, 0, `browser page errors after character switch: ${errors.join('; ')}`);
  await page.screenshot({ path: path.join(output, 'MAIN01-ALEXEI-ROUTE-1365x768.png'), fullPage: true });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  const alexeiExit = { title: await page.locator('#headline').textContent(),
    mission: await page.locator('#mission-action').textContent(), body: (await page.locator('body').innerText()).slice(-650) };
  await page.screenshot({ path: path.join(output, 'MAIN01-ALEXEI-EXIT-1365x768.png'), fullPage: true });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 17; i += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  const printshopAction = { title: await page.locator('#headline').textContent(),
    mission: await page.locator('#mission-action').textContent(), body: (await page.locator('body').innerText()).slice(-900) };
  await page.screenshot({ path: path.join(output, 'MAIN01-PRINTSHOP-ACTION-1365x768.png'), fullPage: true });
  await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 7; i += 1) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const printChoiceButtons = await page.locator('#actions button').allTextContents();
  assert.ok(printChoiceButtons.length > 0, 'the print ledger opens a consequential field choice');
  const printChoiceOutcome = { title: await page.locator('#headline').textContent(),
    mission: await page.locator('#mission-action').textContent(), body: (await page.locator('body').innerText()).slice(-1000) };
  const modelTitle = await page.locator('.type-setter-model strong').textContent();
  assert.equal(modelTitle, 'Семейство Тальниковых', 'the typesetting interaction shows the exact title to reproduce');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePuzzle = await page.evaluate(() => {
    const model = document.querySelector('.type-setter-model').getBoundingClientRect();
    const firstTile = document.querySelector('.type-tile').getBoundingClientRect();
    const actions = document.querySelector('#actions').getBoundingClientRect();
    return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
      model: { left: model.left, right: model.right, top: model.top, bottom: model.bottom },
      firstTile: { left: firstTile.left, right: firstTile.right, top: firstTile.top, bottom: firstTile.bottom },
      actions: { left: actions.left, right: actions.right, top: actions.top, bottom: actions.bottom } };
  });
  assert.ok(mobilePuzzle.model.left >= 0 && mobilePuzzle.model.right <= mobilePuzzle.viewport,
    `the print target stays inside the mobile viewport: ${JSON.stringify(mobilePuzzle)}`);
  assert.ok(mobilePuzzle.actions.left >= 0 && mobilePuzzle.actions.right <= mobilePuzzle.viewport,
    `the action panel stays inside the mobile viewport: ${JSON.stringify(mobilePuzzle)}`);
  assert.ok(mobilePuzzle.firstTile.top < 844 && mobilePuzzle.firstTile.bottom > 0,
    `at least the first type tile is visible without scrolling: ${JSON.stringify(mobilePuzzle)}`);
  await page.screenshot({ path: path.join(output, 'MAIN01-PRINT-MOBILE-390x844.png'), fullPage: true });
  for (const glyph of [...modelTitle]) {
    const label = glyph === ' ' ? '간격' : glyph;
    const tiles = page.locator('.type-tile');
    const labels = await tiles.allTextContents();
    const tileIndex = labels.indexOf(label);
    assert.ok(tileIndex >= 0, `the next glyph ${JSON.stringify(label)} is available`);
    await tiles.nth(tileIndex).scrollIntoViewIfNeeded();
    await tiles.nth(tileIndex).click();
  }
  await page.getByRole('button', { name: '교정 인쇄' }).click();
  await page.waitForTimeout(200);
  const afterTypesetting = { title: await page.locator('#headline').textContent(),
    body: (await page.locator('body').innerText()).slice(-900), choices: await page.locator('#actions button').allTextContents() };
  assert.match(afterTypesetting.title, /교정쇄와 납기/);
  assert.ok(afterTypesetting.choices.some(label => label.includes('교정쇄를 다시 대조')));
  assert.equal(errors.length, 0, `browser page errors after field choice: ${errors.join('; ')}`);
  await page.screenshot({ path: path.join(output, 'MAIN01-PRINT-CHOICE-1365x768.png'), fullPage: true });
  console.log(JSON.stringify({ status: 'PASS', startTask: '부록은 어디 있습니까?', firstChoice: '구독 장부에서 이름을 찾는다',
    nextTask: await page.locator('#mission-title').textContent(), date: '1848-03-09', pageErrors: errors,
    followup: nextScene, printshopArrival, possessedHost, alexeiExit, printshopAction, printChoiceButtons, printChoiceOutcome,
    afterTypesetting, mobilePuzzle, screenshots: [path.join(output, 'MAIN01-PROGRESSION-1365x768.png'),
      path.join(output, 'MAIN01-PERMISSION-INTERACTION-1365x768.png'), path.join(output, 'MAIN01-PRINTSHOP-ARRIVAL-1365x768.png'),
      path.join(output, 'MAIN01-ALEXEI-ROUTE-1365x768.png'), path.join(output, 'MAIN01-ALEXEI-EXIT-1365x768.png'),
      path.join(output, 'MAIN01-PRINTSHOP-ACTION-1365x768.png'), path.join(output, 'MAIN01-PRINT-CHOICE-1365x768.png'),
      path.join(output, 'MAIN01-PRINT-MOBILE-390x844.png')] }, null, 2));
} finally { await browser.close(); }
