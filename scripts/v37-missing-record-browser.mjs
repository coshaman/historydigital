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
const quest = quests.find(item => item.id === 'V37_MISSING_RECORD_1847');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE'); fs.mkdirSync(output, { recursive: true });
const port = 4212, staticRoot = path.resolve('dist-v33');
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: staticRoot }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = []; server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
let ready = false; const deadline = Date.now() + 10000;
while (Date.now() < deadline && !ready) { try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } }
if (!ready) { server.kill(); throw new Error(`E20 preview failed: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true }), cases = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = []; page.on('pageerror', error => pageErrors.push(error.stack ?? String(error)));
    let initial = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'chancery' });
    initial.world.currentMapId = 'chancery';
    initial = game.advanceNpcWorld(initial, 45, maps);
    if (initial.world.livingEventStates.E20?.status !== 'ACTIVE') throw new Error('E20 did not arise from Alexei’s scheduled intake work');
    initial.player.embodiment = 'clerk_alexei'; initial.player.position = { x: 14, y: 12 };
    initial.hosts.clerk_alexei.mapId = 'chancery'; initial.hosts.clerk_alexei.position = { x: 14, y: 12 };
    if (initial.hosts.senior_clerk_konstantin.mapId !== 'chancery'
      || Math.abs(initial.hosts.senior_clerk_konstantin.position.x - initial.hosts.clerk_alexei.position.x)
        + Math.abs(initial.hosts.senior_clerk_konstantin.position.y - initial.hosts.clerk_alexei.position.y) > 3)
      throw new Error('E20 choices were not unlocked by Konstantin’s autonomous arrival');
    const saved = game.saveGame(initial);
    await context.addInitScript(value => { if (!localStorage.getItem('v33-rpg-save')) localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v34-tutorial-stage', 'done'); }, saved);
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-e20-missing-record-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
    await page.keyboard.press('e');
    const option = page.getByRole('button', { name: '원래 번호를 보존하고 별도 대조표를 만든다' });
    await option.waitFor({ state: 'visible', timeout: 3000 });
    const screen = await page.evaluate(() => ({ title: document.querySelector('#headline')?.textContent,
      choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (screen.choices.length !== 2 || screen.scrollWidth > screen.width + 1) throw new Error(`E20 disclosure/layout failed: ${JSON.stringify(screen)}`);
    await option.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `e20-missing-record-choices-${viewport.width}x${viewport.height}.png`) });
    const before = await page.locator('#record').textContent(); await option.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, before);
    const after = game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests });
    const event = after.world.livingEventStates.E20;
    if (event.stage !== 'CROSS_REFERENCE_CREATED' || event.status !== 'RESOLVED'
      || event.document.status !== 'CROSS_REFERENCED_COPY' || pageErrors.length || serverErrors.length)
      throw new Error(`E20 choice did not persist cleanly: ${JSON.stringify({ event, pageErrors, serverErrors })}`);
    await page.screenshot({ path: path.join(output, `e20-missing-record-resolved-${viewport.width}x${viewport.height}.png`) });
    cases.push({ viewport, choiceCount: screen.choices.length, stage: event.stage, status: event.status,
      document: event.document.status, scrollWidth: screen.scrollWidth, pageErrors });
    await context.close();
  }
} finally { await browser.close(); server.kill(); }
const report = { status: 'PASS', eventId: 'E20', validationStatus: 'DESIGN_SEED_NOT_VERIFIED', cases, serverErrors };
fs.writeFileSync(path.join(output, 'E20_MISSING_RECORD_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
