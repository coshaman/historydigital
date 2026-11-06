import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const maps = Object.fromEntries(fs.readdirSync('rpg/maps').filter(file => file.endsWith('.json'))
  .map(file => { const map = readJson(path.join('rpg/maps', file)); return [map.mapId, map]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => readJson(path.join('rpg/characters', file)));
const quest = readJson('rpg/quests/censored-page-1847.json');
const output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4194, staticRoot = path.resolve('dist-v33');
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: staticRoot }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
const deadline = Date.now() + 10000;
let ready = false;
while (Date.now() < deadline && !ready) {
  try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; }
  catch { await new Promise(resolve => setTimeout(resolve, 100)); }
}
if (!ready) { server.kill(); throw new Error(`Censorship preview did not start: ${serverErrors.join('')}`); }
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    const interaction = maps.printshop.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === quest.entry.objectId);
    const start = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'printshop' });
    start.world.chapterId = 'V33_1847_PRINT';
    start.world.date = '1847-01-01';
    start.hosts.editor_sofia.mapId = 'printshop';
    start.hosts.editor_sofia.position = { x: interaction.x / 16, y: interaction.y / 16 };
    start.player.position = { ...start.hosts.editor_sofia.position };
    const possessed = game.possessHost(start, 'editor_sofia', maps.printshop);
    if (!possessed.ok) throw new Error(`Could not prepare editor view: ${possessed.reason}`);
    const before = possessed.state;
    let triggered = structuredClone(before);
    triggered.player.embodiment = null;
    triggered.player.position = { ...triggered.hosts.editor_sofia.position };
    for (let minute = 0; minute < 1200 && triggered.world.livingEventStates.E06?.status !== 'ACTIVE'; minute += 5) {
      triggered = game.advanceNpcWorld(triggered, 5, maps);
    }
    if (triggered.world.livingEventStates.E06?.status !== 'ACTIVE') throw new Error('Scheduled work did not trigger E06 for browser acceptance');
    triggered.world.currentMapId = 'printshop';
    triggered.hosts.editor_sofia.mapId = 'printshop';
    triggered.hosts.editor_sofia.position = { x: interaction.x / 16, y: interaction.y / 16 };
    triggered.player.position = { ...triggered.hosts.editor_sofia.position };
    const embodied = game.possessHost(triggered, 'editor_sofia', maps.printshop);
    if (!embodied.ok) throw new Error(`Could not possess the editor after event trigger: ${embodied.reason}`);
    await context.addInitScript(saved => {
      if (!localStorage.getItem('v33-rpg-save')) localStorage.setItem('v33-rpg-save', saved);
      localStorage.setItem('v33-rpg-tutorial-stage', 'done');
    }, game.saveGame(before));
    await page.goto(`http://127.0.0.1:${port}/index.html#v37-censorship-${viewport.width}`, { waitUntil: 'domcontentloaded' });
    try { await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('소피야'), { timeout: 10000 }); }
    catch { throw new Error(`Editor game view failed to initialize: ${JSON.stringify(await page.evaluate(() => ({ bodyname: document.querySelector('#bodyname')?.textContent, body: document.body.innerText.slice(0, 900), save: localStorage.getItem('v33-rpg-save')?.slice(0, 80) })))}`); }
    const missionBefore = await page.locator('#mission-title').textContent();
    if (missionBefore.includes(quest.titleKo)) throw new Error('The event objective appeared before the scheduled trigger');
    await page.keyboard.press('e');
    const queryButton = page.getByRole('button', { name: '삭제 근거를 묻는 메모를 편집부 기록에 남긴다' });
    if (await queryButton.count()) throw new Error('The E06 choice appeared before its work trigger');
    await page.evaluate(saved => localStorage.setItem('v33-rpg-save', saved), game.saveGame(embodied.state));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('소피야'));
    await page.waitForFunction(title => document.querySelector('#mission-title')?.textContent?.includes(title), quest.titleKo);
    await page.keyboard.press('e');
    await queryButton.waitFor({ state: 'visible' });
    await queryButton.scrollIntoViewIfNeeded();
    const ui = await page.evaluate(() => ({ choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (!ui.choices.some(text => text.includes('공식 메모가 남습니다')) || ui.scrollWidth > ui.width + 1) {
      throw new Error(`E06 immediate disclosure or viewport failed: ${JSON.stringify(ui)}`);
    }
    await page.screenshot({ path: path.join(output, `censorship-choices-${viewport.width}x${viewport.height}.png`) });
    const previous = await page.locator('#record').textContent();
    await queryButton.click();
    await page.waitForFunction(value => document.querySelector('#record')?.textContent !== value, previous);
    const stored = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const reloaded = game.loadGame(stored, { maps, hostCards: cards, quests: [quest] });
    if (reloaded.world.livingEventStates.E06.stage !== 'QUERY_FILED'
      || reloaded.world.livingEventStates.E06.officeRecord !== 'OFFICIAL_QUERY'
      || pageErrors.length || serverErrors.length) throw new Error(`E06 browser choice failed: ${JSON.stringify({ stage: reloaded.world.livingEventStates.E06.stage, pageErrors, serverErrors })}`);
    results.push({ viewport, choices: ui.choices.length, stage: reloaded.world.livingEventStates.E06.stage,
      officialRecord: reloaded.world.livingEventStates.E06.officeRecord, scrollWidth: ui.scrollWidth, pageErrors });
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const report = { status: 'PASS', cases: results, serverErrors };
fs.writeFileSync(path.join(output, 'CENSORSHIP_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
