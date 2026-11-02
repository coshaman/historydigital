import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { summarizeExplorationCoverage } from './v33-exploration-coverage.mjs';

const root = process.cwd();
const quickMode = process.argv.includes('--quick');
const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4173/';
const out = path.join(root, 'artifacts', 'v33', quickMode ? 'V33_RPG_PHASE1_QUICK' : 'V33_RPG_PHASE1');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const report = { schemaVersion: 'V33_RPG_BROWSER_SMOKE_V1', base, viewports: [], failures: [] };
const goExit = async (page, destination) => {
  await page.keyboard.press('e');
  const exitChoice = page.locator('#actions button').filter({ hasText: `문을 지나 ${destination}로` });
  if (await exitChoice.count()) await exitChoice.first().click();
  await page.waitForFunction(expected => document.querySelector('#mapname')?.textContent === expected, destination);
};

for (const viewport of (quickMode ? [{ width: 1440, height: 900 }] : [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1111, height: 720 }, { width: 390, height: 844 }, { width: 360, height: 800 }])) {
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
    const ratio = canvas.width / canvas.clientWidth, row = Math.floor(canvas.height / 2), background = [98, 86, 75];
    let scenePixels = 0;
    for (let x = 0; x < canvas.width; x++) {
      const pixel = ctx.getImageData(x, row, 1, 1).data;
      if (pixel[0] !== background[0] || pixel[1] !== background[1] || pixel[2] !== background[2]) scenePixels++;
    }
    return { width: canvas.width, height: canvas.height, sampledColors: colors.size, mapCoverage: scenePixels / canvas.width, cssTileScale: canvas.clientWidth / (30 * 16) * ratio };
  });
  if (initialCanvas.sampledColors < 4) throw new Error(`Initial world canvas was not drawn: ${JSON.stringify(initialCanvas)}`);
  if (initialCanvas.mapCoverage < 0.7) throw new Error(`World map is still too small within the playfield: ${JSON.stringify(initialCanvas)}`);
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
  await page.getByRole('heading', { name: '돌 틈에 낀 쪽지' }).waitFor();
  const clueText = await page.locator('#journal-text').innerText();
  if (!clueText.includes('등불 둘') || !clueText.includes('뒤문')) throw new Error(`Pavel clue copy did not appear: ${clueText}`);
  await page.locator('#save').click();
  if (await page.locator('#load').isDisabled()) throw new Error(`Load control remained disabled immediately after saving at ${viewport.width}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#journal-text');
  const restoredJournal = await page.locator('#journal-text').innerText();
  if (!restoredJournal.includes('등불 둘') || !restoredJournal.includes('뒤문')) {
    const diagnosis = await page.evaluate(() => ({ headline: document.querySelector('#headline').textContent, text: document.querySelector('#journal-text').textContent, record: document.querySelector('#record').textContent, hasSave: Boolean(localStorage.getItem('v33-rpg-save')), savedLedgerTail: JSON.parse(localStorage.getItem('v33-rpg-save') || 'null')?.state?.ledger?.slice(-3) }));
    throw new Error(`Saved clue did not restore at ${viewport.width}: ${JSON.stringify(diagnosis)}`);
  }
  await page.locator('#journal-open').click();
  await page.locator('[data-journal-tab="sources"]').click();
  await page.locator('#journal-sources').getByText('돌 틈에 낀 쪽지', { exact: true }).waitFor();
  const advancedClock = await page.locator('#clock').innerText();
  if (advancedClock === initialClock || !/^\d{2}:\d{2}$/.test(advancedClock)) throw new Error(`World clock did not visibly advance at ${viewport.width}: ${initialClock} → ${advancedClock}`);
  const metrics = await page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const shell = rect('.game-shell'), field = rect('.playfield'), lower = rect('.lower'), pad = rect('.touch-pad');
    return { viewport: { width: innerWidth, height: innerHeight }, document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }, shell, field, lower, pad, buttons: [...document.querySelectorAll('.touch-pad button')].map(button => { const r = button.getBoundingClientRect(); return { label: button.innerText, x: r.x, y: r.y, right: r.right, bottom: r.bottom, visible: r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; }) };
  });
  await page.screenshot({ path: path.join(out, `clue-${viewport.width}x${viewport.height}.png`) });
  await page.locator('#journal-close').click();
  await page.keyboard.press('h');
  await page.getByText('지금까지 열린 자료').waitFor();
  evidenceHotkey = true;
  if (metrics.document.width > viewport.width) throw new Error(`Horizontal overflow at ${viewport.width}: ${metrics.document.width}`);
  if (metrics.buttons.some(button => !button.visible)) throw new Error(`Touch controls clipped at ${viewport.width}`);
  if (errors.length) throw new Error(`Browser errors at ${viewport.width}: ${errors.join('; ')}`);
  report.viewports.push({ ...metrics, canvas: initialCanvas, clueText, initialClock, advancedClock, savedClueRestored: true, offlineDialogue: false, evidenceHotkey, errors });
  await context.close();
}
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const explorationEvents = [];
  const nevskyMap = JSON.parse(fs.readFileSync(path.join(root, 'rpg', 'maps', 'nevsky.json'), 'utf8'));
  const currentGameMinute = async () => {
    const match = (await page.locator('#clock').innerText()).match(/^(\d{2}):(\d{2})$/);
    if (!match) throw new Error(`Game clock is not readable: ${match?.[0] ?? 'empty'}`);
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const move = async (direction, count = 1) => {
    const before = await currentGameMinute();
    for (let step = 0; step < count; step++) { await page.keyboard.press(direction); await page.locator('#save').click(); }
    const after = await currentGameMinute();
    explorationEvents.push({ type: 'move', count: (after - before + 1440) % 1440 });
  };
  const approachTile = async (targetPosition, targetMapId = 'nevsky', hostId = null) => {
    const collision = nevskyMap.layers.find(layer => layer.name === 'Collision').data;
    const steps = [[0, -1, 'ArrowUp'], [1, 0, 'ArrowRight'], [0, 1, 'ArrowDown'], [-1, 0, 'ArrowLeft']];
    for (let attempt = 0; attempt < 40; attempt++) {
      const current = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state);
      const actor = current.player.embodiment ? current.hosts[current.player.embodiment] : current.player;
      const target = hostId ? current.hosts[hostId].position : targetPosition;
      if (current.world.currentMapId !== targetMapId || (hostId && current.hosts[hostId].mapId !== targetMapId)) throw new Error(`Target left ${targetMapId}`);
      if (Math.max(Math.abs(actor.position.x - target.x), Math.abs(actor.position.y - target.y)) <= 1) return;
      const queue = [{ x: actor.position.x, y: actor.position.y, path: [] }], seen = new Set([`${actor.position.x},${actor.position.y}`]);
      let route = null;
      while (queue.length && !route) {
        const tile = queue.shift();
        for (const [dx, dy, key] of steps) {
          const x = tile.x + dx, y = tile.y + dy, id = `${x},${y}`;
          if (x < 0 || y < 0 || x >= nevskyMap.width || y >= nevskyMap.height || collision[y * nevskyMap.width + x] || seen.has(id)) continue;
          if (Object.entries(current.hosts).some(([otherId, other]) => otherId !== current.player.embodiment && other.historicalAliveAndPresent !== false && other.mapId === targetMapId && other.position.x === x && other.position.y === y)) continue;
          const nextPath = [...tile.path, key];
          if (Math.max(Math.abs(x - target.x), Math.abs(y - target.y)) <= 1) { route = nextPath; break; }
          seen.add(id); queue.push({ x, y, path: nextPath });
        }
      }
      if (!route?.length) throw new Error(`No walkable route to target from ${actor.position.x},${actor.position.y}`);
      await move(route[0]);
    }
    throw new Error(`Could not reach target within 40 player steps`);
  };
  const approachHost = hostId => approachTile(null, 'nevsky', hostId);
  const inspect = async () => {
    await page.locator('#use').click();
  };
  const readSource = async () => {
    await page.locator('#source-reader').waitFor({ state: 'visible' });
    await page.locator('#source-reader-passages').getByText('“호리는 누구죠?”').waitFor();
    await page.locator('#source-reader-complete').click();
    explorationEvents.push({ type: 'read_source' });
  };
  const possess = async hostId => {
    const hostNames = { courier_pavel: '파벨 안토노프', printer_ekaterina: '예카테리나 벨로바', seamstress_anna: '안나', clerk_alexei: '알렉세이 오를로프' };
    const inspectChoice = page.locator('#actions button').filter({ hasText: `${hostNames[hostId]} 살펴보기` });
    if (await inspectChoice.count()) await inspectChoice.first().click();
    await page.getByRole('button', { name: '몸을 빌린다' }).click();
    await page.waitForFunction(() => !document.querySelector('#bodyname').textContent.includes('바깥에서 바라보는 중'));
    await page.locator('#save').click();
    explorationEvents.push({ type: 'possess', hostId });
  };
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await move('ArrowDown');
  await move('ArrowLeft', 5);
  await move('ArrowUp', 4);
  await inspect();
  if (!(await page.locator('#source-reader').isVisible())) {
    const sourceOption = page.locator('#actions button').filter({ hasText: '자료 읽기' });
    if (!(await sourceOption.count())) {
      const observed = await page.evaluate(() => ({ place: document.querySelector('#place').textContent, headline: document.querySelector('#headline').textContent, actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText), record: document.querySelector('#record').textContent }));
      throw new Error(`Expected the source or its readable menu option after the physical path: ${JSON.stringify(observed)}`);
    }
    await sourceOption.first().click();
  }
  await page.locator('#source-reader').waitFor({ state: 'visible' });
  explorationEvents.push({ type: 'inspect' });
  if (!(await page.locator('#source-reader').isVisible())) {
    const observed = await page.evaluate(() => ({ place: document.querySelector('#place').textContent, body: document.querySelector('#bodyname').textContent, headline: document.querySelector('#headline').textContent, text: document.querySelector('#journal-text').textContent, record: document.querySelector('#record').textContent }));
    throw new Error(`Reader action unavailable after physical path: ${JSON.stringify(observed)}; console=${errors.join('; ')}`);
  }
  await readSource();
  await approachHost('courier_pavel');
  await inspect();
  const pavelChoice = page.locator('#actions button').filter({ hasText: '파벨 안토노프 살펴보기' });
  if (await pavelChoice.count()) await pavelChoice.first().click();
  if (!(await page.getByRole('button', { name: '몸을 빌린다' }).count())) {
    const observed = await page.evaluate(() => ({ place: document.querySelector('#place').textContent, body: document.querySelector('#bodyname').textContent, headline: document.querySelector('#headline').textContent, actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText), record: document.querySelector('#record').textContent }));
    throw new Error(`Pavel was not in the interaction range after the planned route: ${JSON.stringify(observed)}`);
  }
  await page.getByRole('button', { name: '몸을 빌린다' }).waitFor();
  explorationEvents.push({ type: 'inspect' });
  await possess('courier_pavel');
  await approachTile({ x: 12, y: 16 });
  await inspect();
  await page.getByRole('heading', { name: '돌 틈에 낀 쪽지' }).waitFor();
  explorationEvents.push({ type: 'inspect' });
  await page.locator('#release').click();
  await move('ArrowRight', 10);
  await move('ArrowUp', 8);
  await inspect();
  await page.getByText('네프스키 인쇄소', { exact: true }).first().waitFor();
  explorationEvents.push({ type: 'inspect' }, { type: 'map_transition' });
  await inspect();
  const ekaterinaChoice = page.locator('#actions button').filter({ hasText: '예카테리나 벨로바 살펴보기' });
  if (await ekaterinaChoice.count()) await ekaterinaChoice.first().click();
  await page.getByRole('button', { name: '몸을 빌린다' }).waitFor();
  explorationEvents.push({ type: 'inspect' });
  await possess('printer_ekaterina');
  await move('ArrowLeft', 3);
  await move('ArrowUp');
  await inspect();
  await page.locator('#source-reader').waitFor({ state: 'visible' });
  explorationEvents.push({ type: 'inspect' });
  await readSource();
  const reader = await page.locator('.journal').evaluate(element => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  if (reader.scrollHeight <= reader.clientHeight) throw new Error('Source reader did not expose an internal scroll area');
  await page.locator('.journal').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.locator('.journal').evaluate(element => { element.scrollTop = 0; });
  await move('ArrowRight', 3);
  await inspect();
  await page.getByRole('button', { name: '인쇄된 원문과 대조한 뒤 결정한다' }).waitFor();
  explorationEvents.push({ type: 'inspect' });
  await page.getByRole('button', { name: '인쇄된 원문과 대조한 뒤 결정한다' }).click();
  await page.getByText('인쇄된 원문과 대조하기로 했다. 확인이 끝날 때까지 사본은 작업대에 남는다.').waitFor();
  explorationEvents.push({ type: 'quest_choice' });
  const routeCoverage = summarizeExplorationCoverage(explorationEvents);
  if (!routeCoverage.goalDirected) throw new Error(`Physical exploration coverage was incomplete: ${JSON.stringify(routeCoverage)}`);
  await page.screenshot({ path: path.join(out, 'printshop-source-choice-1440x900.png') });
  if (errors.length) throw new Error(`Full route browser errors: ${errors.join('; ')}`);
  report.fullRoute = { mapTransition: true, hostPerspectives: ['observer', 'courier_pavel', 'printer_ekaterina'], clueInspected: 'PRINTSHOP_ROUTING_NOTE', sourceRead: true, sourceReaderScroll: reader, choiceResolved: true, routeCoverage, elapsedWallTimeIsNotUsedAsEngagementEvidence: true, errors };
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
  await goExit(page, '관청 접수실');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '몸을 빌린다' }).click();
  await page.keyboard.press('ArrowRight');
  for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowDown');
  await goExit(page, '네프스키 거리');
  for (let step = 0; step < 12; step++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  await page.getByText('이 몸으로는 들어갈 수 없다').waitFor();
  await page.locator('#release').click();
  await goExit(page, '하숙집 안뜰');
  await page.keyboard.press('e');
  await page.getByRole('button', { name: '몸을 빌린다' }).click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  await page.getByRole('heading', { name: '방세 쪽지' }).waitFor();
  await page.getByText(/내일까지라… 오늘은 꼭 일거리를 구해야 하는데/).waitFor();
  await page.screenshot({ path: path.join(out, 'courtyard-rent-1440x900.png') });
  for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowRight');
  for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowDown');
  await goExit(page, '네프스키 거리');
  if (errors.length) throw new Error(`Chancery/courtyard browser errors: ${errors.join('; ')}`);
  report.otherMaps = { chanceryVisit: true, clerkAccess: true, alexeiDeniedCourtyard: true, observerEnteredCourtyard: true, mikhailClueRead: true, mikhailReturnedToStreet: true, errors };
  await context.close();
}
await browser.close();
report.status = report.viewports.length === (quickMode ? 1 : 5) && report.fullRoute?.choiceResolved && report.otherMaps?.mikhailReturnedToStreet && report.failures.length === 0 ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(out, 'BROWSER_SMOKE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, viewports: report.viewports.map(item => ({ viewport: item.viewport, document: item.document, controlsVisible: item.buttons.every(button => button.visible), savedClueRestored: item.savedClueRestored })) }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
