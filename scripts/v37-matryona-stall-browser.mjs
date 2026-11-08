import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState, readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const maps = Object.fromEntries(fs.readdirSync('rpg/maps').filter(file => file.endsWith('.json'))
  .map(file => { const map = readJson(path.join('rpg/maps', file)); return [map.mapId, map]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => readJson(path.join('rpg/characters', file)));
let quests = [];
for (const file of fs.readdirSync('rpg/quests').filter(file => file.endsWith('.json'))) {
  const data = readJson(path.join('rpg/quests', file));
  if (Array.isArray(data.quests)) quests.push(...data.quests);
  else if (data.historicalOutcome?.id) quests.push(data);
}
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE'); fs.mkdirSync(output, { recursive: true });
const port = 4211, staticRoot = path.resolve('dist-v33');
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: staticRoot }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = []; server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
let ready = false; const deadline = Date.now() + 10000;
while (Date.now() < deadline && !ready) { try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
if (!ready) { server.kill(); throw new Error(`Matryona production preview failed: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true }), cases = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = []; page.on('pageerror', error => pageErrors.push(error.stack ?? String(error)));
    const initial = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
    await context.addInitScript(saved => { if (!localStorage.getItem('v33-rpg-save')) localStorage.setItem('v33-rpg-save', saved); localStorage.setItem('v34-tutorial-stage', 'done'); }, game.saveGame(initial));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-matryona-roster-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
    await page.locator('#roster-open').click();
    await page.waitForFunction(() => document.querySelectorAll('#actions button').length > 0);
    await page.getByRole('button', { name: /마트료나/ }).click();
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('마트료나'));
    await page.locator('#save').click();
    const possessed = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')));
    const decoded = game.loadGame(JSON.stringify(possessed), { maps, hostCards: cards, quests });
    if (decoded.player.embodiment !== 'street_vendor_matryona' || decoded.world.currentMapId !== 'nevsky')
      throw new Error(`Roster possession did not switch to Matryona: ${decoded.player.embodiment}/${decoded.world.currentMapId}`);
    await page.screenshot({ path: path.join(output, `matryona-roster-${viewport.width}x${viewport.height}.png`) });

    const marker = decoded.quests.STREET_VENDOR_WEATHER_1847;
    decoded.quests.STREET_VENDOR_WEATHER_1847 = { ...(marker ?? {}), status: 'resolved' };
    decoded.hosts.street_vendor_matryona.position = { x: 24, y: 16 };
    decoded.player.position = { x: 24, y: 16 };
    const scenarioSave = game.saveGame(decoded);
    const scenarioRoundTrip = game.loadGame(scenarioSave, { maps, hostCards: cards, quests });
    if (scenarioRoundTrip.player.embodiment !== 'street_vendor_matryona') throw new Error('Matryona browser fixture failed its local save/load round trip');
    await page.evaluate(saved => localStorage.setItem('v33-rpg-save', saved), scenarioSave);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
    const reloadView = await page.evaluate(() => ({ body: document.querySelector('#bodyname')?.textContent, save: localStorage.getItem('v33-rpg-save') }));
    const reloadState = game.loadGame(reloadView.save, { maps, hostCards: cards, quests });
    if (reloadState.player.embodiment !== 'street_vendor_matryona')
      throw new Error(`Matryona save did not reload: ${JSON.stringify({ body: reloadView.body, host: reloadState.player.embodiment, pageErrors })}`);
    await page.keyboard.press('e');
    const stageOne = quests.find(quest => quest.id === 'MATRYONA_STREET_STALL_1847_STAGE_1');
    await page.getByRole('button', { name: stageOne.actions[0].labelKo }).click();
    let afterStageOne = game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests });
    if (afterStageOne.quests[stageOne.id]?.status !== 'resolved') throw new Error('Matryona stage one did not resolve through the real stall object');
    await page.keyboard.press('e');
    const stageTwo = quests.find(quest => quest.id === 'MATRYONA_STREET_STALL_1847_STAGE_2');
    await page.getByRole('button', { name: stageTwo.actions[0].labelKo }).waitFor({ state: 'visible' });
    const screen = await page.evaluate(() => ({ title: document.querySelector('#headline')?.textContent,
      choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!screen.title?.includes('2/3') || /비 그친 뒤의 좌판 자리.*비 그친 뒤의 좌판 자리/.test(screen.title)
      || screen.scrollWidth > screen.width + 1 || pageErrors.length || serverErrors.length)
      throw new Error(`Matryona stall did not advance cleanly: ${JSON.stringify({ screen, pageErrors, serverErrors })}`);
    await page.screenshot({ path: path.join(output, `matryona-stall-stage-2-${viewport.width}x${viewport.height}.png`) });
    cases.push({ viewport, rosterOneClick: true, resolvedOldMarker: true, stageOneResolved: true,
      stageTwoVisible: true, stageTwoTitle: screen.title, scrollWidth: screen.scrollWidth, pageErrors });
    await context.close();
  }
} finally { await browser.close(); server.kill(); }
const report = { status: 'PASS', cases, serverErrors };
fs.writeFileSync(path.join(output, 'MATRYONA_STALL_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
