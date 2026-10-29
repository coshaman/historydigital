import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const quickMode = process.argv.includes('--quick');
const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4173/';
const out = path.join(root, 'artifacts', 'v33', quickMode ? 'V33_RPG_PHASE1_QUICK' : 'V33_RPG_PHASE1');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const report = { schemaVersion: 'V33_RPG_BROWSER_SMOKE_V1', base, viewports: [], failures: [] };

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
  console.log(`viewport ${viewport.width}x${viewport.height}`);
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#world');
  await page.waitForFunction(() => document.querySelector('#source-drawer-open') && document.querySelector('#world').width > 300);
  const initialCanvas = await page.evaluate(() => {
    const canvas = document.querySelector('#world'), ctx = canvas.getContext('2d'), colors = new Set();
    for (let y = 1; y <= 8; y++) for (let x = 1; x <= 8; x++) {
      const px = Math.floor(canvas.width * x / 9), py = Math.floor(canvas.height * y / 9);
      colors.add([...ctx.getImageData(px, py, 1, 1).data].join(','));
    }
    return { width: canvas.width, height: canvas.height, sampledColors: colors.size };
  });
  if (initialCanvas.sampledColors < 4) throw new Error(`Initial world canvas was not drawn: ${JSON.stringify(initialCanvas)}`);
  const initialClock = await page.locator('#clock').innerText();
  let evidenceHotkey = false;
  if (viewport.width < 500) {
    await page.locator('[data-move="right"]').click();
    await page.keyboard.press('ArrowLeft');
  }
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '몸을 빌린다' }).click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('e');
  await page.getByText('이 소품과 문구는 플레이를 위해 만든 허구 장면입니다. 역사 사료 인용이 아닙니다.').waitFor();
  const clueText = await page.locator('#journal-text').innerText();
  if (!clueText.includes('봉투') || !clueText.includes('배달 표식처럼 보이지만')) throw new Error('Pavel clue copy did not appear');
  await page.locator('#save').click();
  if (await page.locator('#load').isDisabled()) throw new Error(`Load control remained disabled immediately after saving at ${viewport.width}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#journal-text');
  const restoredJournal = await page.locator('#journal-text').innerText();
  if (!restoredJournal.includes('배달 표식처럼 보이지만')) {
    const diagnosis = await page.evaluate(() => ({ headline: document.querySelector('#headline').textContent, text: document.querySelector('#journal-text').textContent, record: document.querySelector('#record').textContent, hasSave: Boolean(localStorage.getItem('v33-rpg-save')), savedLedgerTail: JSON.parse(localStorage.getItem('v33-rpg-save') || 'null')?.state?.ledger?.slice(-3) }));
    throw new Error(`Saved clue did not restore at ${viewport.width}: ${JSON.stringify(diagnosis)}`);
  }
  await page.locator('#host-notebook summary').click();
  await page.getByText('허구 소품 조사 · 돌 틈에 낀 쪽지').waitFor();
  const advancedClock = await page.locator('#clock').innerText();
  if (advancedClock === initialClock || !/^\d{2}:\d{2}$/.test(advancedClock)) throw new Error(`World clock did not visibly advance at ${viewport.width}: ${initialClock} → ${advancedClock}`);
  const metrics = await page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const shell = rect('.game-shell'), field = rect('.playfield'), lower = rect('.lower'), pad = rect('.touch-pad');
    return { viewport: { width: innerWidth, height: innerHeight }, document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }, shell, field, lower, pad, buttons: [...document.querySelectorAll('.touch-pad button')].map(button => { const r = button.getBoundingClientRect(); return { label: button.innerText, x: r.x, y: r.y, right: r.right, bottom: r.bottom, visible: r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; }) };
  });
  await page.screenshot({ path: path.join(out, `clue-${viewport.width}x${viewport.height}.png`) });
  await page.keyboard.press('h');
  await page.getByText('지금까지 열린 자료').waitFor();
  evidenceHotkey = true;
  if (metrics.document.width > viewport.width) throw new Error(`Horizontal overflow at ${viewport.width}: ${metrics.document.width}`);
  if (metrics.buttons.some(button => !button.visible)) throw new Error(`Touch controls clipped at ${viewport.width}`);
  if (errors.length) throw new Error(`Browser errors at ${viewport.width}: ${errors.join('; ')}`);
  report.viewports.push({ ...metrics, clueText, initialClock, advancedClock, savedClueRestored: true, offlineDialogue: false, evidenceHotkey, errors });
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const explorationStartedAt = Date.now();
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.keyboard.press('ArrowDown');
  for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowLeft');
  for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  if (!(await page.getByRole('button', { name: '원문과 번역 펼치기' }).count())) {
    const observed = await page.evaluate(() => ({ place: document.querySelector('#place').textContent, body: document.querySelector('#bodyname').textContent, headline: document.querySelector('#headline').textContent, text: document.querySelector('#journal-text').textContent, record: document.querySelector('#record').textContent }));
    throw new Error(`Reader action unavailable after physical path: ${JSON.stringify(observed)}; console=${errors.join('; ')}`);
  }
  await page.getByRole('button', { name: '원문과 번역 펼치기' }).click();
  await page.getByText('“호리는 누구죠?”').waitFor();
  await page.waitForTimeout(quickMode ? 0 : 32000);
  for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowRight');
  for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '몸을 빌린다' }).click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('e');
  await page.waitForTimeout(quickMode ? 0 : 28000);
  await page.locator('#release').click();
  for (let step = 0; step < 10; step++) await page.keyboard.press('ArrowRight');
  for (let step = 0; step < 8; step++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  await page.getByText('네프스키 인쇄소', { exact: true }).first().waitFor();
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '몸을 빌린다' }).click();
  for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '원문과 번역 펼치기' }).click();
  await page.getByText('“호리는 누구죠?”').waitFor();
  await page.waitForTimeout(quickMode ? 0 : 35000);
  const reader = await page.locator('.journal').evaluate(element => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  if (reader.scrollHeight <= reader.clientHeight) throw new Error('Source reader did not expose an internal scroll area');
  await page.locator('.journal').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.locator('.journal').evaluate(element => { element.scrollTop = 0; });
  for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '인쇄된 원문과 대조한 뒤 결정한다' }).click();
  await page.getByText('인쇄된 원문과 대조하기로 했다. 확인이 끝날 때까지 사본은 작업대에 남는다.').waitFor();
  await page.waitForTimeout(quickMode ? 0 : 30000);
  const explorationDurationMs = Date.now() - explorationStartedAt;
  if (!quickMode && explorationDurationMs < 120000) throw new Error(`Goal-directed route finished too quickly: ${explorationDurationMs}ms`);
  await page.screenshot({ path: path.join(out, 'printshop-source-choice-1440x900.png') });
  if (errors.length) throw new Error(`Full route browser errors: ${errors.join('; ')}`);
  report.fullRoute = { mapTransition: true, hostPerspectives: ['observer', 'courier_pavel', 'printer_ekaterina'], clueInspected: 'PRINTSHOP_ROUTING_NOTE', sourceRead: true, sourceReaderScroll: reader, choiceResolved: true, explorationDurationMs, timedGatePassed: quickMode ? null : explorationDurationMs >= 120000, errors };
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.keyboard.press('ArrowDown');
  for (let step = 0; step < 7; step++) await page.keyboard.press('ArrowLeft');
  for (let step = 0; step < 8; step++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  await page.waitForFunction(() => document.querySelector('#place').textContent === '관청 접수실');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '몸을 빌린다' }).click();
  await page.keyboard.press('ArrowRight');
  for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('e');
  await page.waitForFunction(() => document.querySelector('#place').textContent === '네프스키 거리');
  for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  await page.getByText('이 몸으로는 들어갈 수 없다').waitFor();
  await page.locator('#release').click();
  await page.keyboard.press('e');
  await page.waitForFunction(() => document.querySelector('#place').textContent === '하숙집 안뜰');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '몸을 빌린다' }).click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  await page.getByText('이 소품과 문구는 플레이를 위해 만든 허구 장면입니다. 역사 사료 인용이 아닙니다.').waitFor();
  await page.getByText('내일까지 내야 하는 건 맞아').waitFor();
  await page.screenshot({ path: path.join(out, 'courtyard-rent-1440x900.png') });
  for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowRight');
  for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('e');
  await page.waitForFunction(() => document.querySelector('#place').textContent === '네프스키 거리');
  if (errors.length) throw new Error(`Chancery/courtyard browser errors: ${errors.join('; ')}`);
  report.otherMaps = { chanceryVisit: true, clerkAccess: true, alexeiDeniedCourtyard: true, observerEnteredCourtyard: true, mikhailClueRead: true, mikhailReturnedToStreet: true, errors };
  await context.close();
}
await browser.close();
report.status = report.viewports.length === 4 && report.fullRoute?.choiceResolved && report.otherMaps?.mikhailReturnedToStreet && report.failures.length === 0 ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(out, 'BROWSER_SMOKE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, viewports: report.viewports.map(item => ({ viewport: item.viewport, document: item.document, controlsVisible: item.buttons.every(button => button.visible), savedClueRestored: item.savedClueRestored })) }, null, 2));
