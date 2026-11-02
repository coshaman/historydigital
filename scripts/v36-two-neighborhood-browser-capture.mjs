import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const output = path.join(root, 'docs', 'v36', 'current-audit', 'screenshots');
await mkdir(output, { recursive: true });
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const maps = Object.fromEntries(await Promise.all((await readdir(path.join(root, 'rpg/maps'))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const characters = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/characters/${file}`)));
const quests = (await Promise.all((await readdir(path.join(root, 'rpg/quests'))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/quests/${file}`)))).filter(quest => Array.isArray(quest.actions) && quest.historicalOutcome?.id);
const reportRows = [];
const portProbe = createServer();
await new Promise((resolve, reject) => { portProbe.once('error', reject); portProbe.listen(0, '127.0.0.1', resolve); });
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, OPENAI_API_KEY: '', CHANCERY_PORT: String(port) }, stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const base = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, 'local static server must start');
  for (const mapId of ['nevsky', 'market-quay']) {
    let state = game.createInitialState({ maps, hostCards: characters, quests, startMapId: mapId });
    state = game.advanceNpcWorld(state, 120, maps);
    state.world.currentMapId = mapId;
    state.player.position = { ...maps[mapId].metadata.observerStart };
    const save = game.saveGame(state);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v34-tutorial-stage', 'done'); }, save);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#mission-tracker').waitFor({ state: 'visible' });
    await page.waitForTimeout(180);
    const view = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
      mapId: JSON.parse(localStorage.getItem('v33-rpg-save')).state.world.currentMapId,
      mission: document.querySelector('#mission-title')?.textContent,
      opinionBoardVisible: !document.querySelector('#discussion-quest-board')?.hidden,
      scheduledResidentsInMap: Object.values(JSON.parse(localStorage.getItem('v33-rpg-save')).state.hosts).filter(host => host.mapId === JSON.parse(localStorage.getItem('v33-rpg-save')).state.world.currentMapId).length,
      canvas: { width: document.querySelector('#world')?.width, height: document.querySelector('#world')?.height },
    }));
    assert.equal(view.documentWidth, 1440, `${mapId} page should fit desktop viewport`);
    assert.equal(view.opinionBoardVisible, true, `${mapId} should expose the opinion inquiry board`);
    assert.equal(errors.length, 0, `${mapId} page should not raise runtime errors: ${errors.join('; ')}`);
    const screenshot = `${mapId}-12-resident-neighborhood.png`;
    await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
    reportRows.push({ ...view, screenshot, pageErrors: errors });
    await context.close();
  }
  await writeFile(path.join(output, 'NEIGHBORHOOD_CAPTURE_MANIFEST.json'), JSON.stringify({ schemaVersion: 'V36_PHASE2_NEIGHBORHOOD_BROWSER_1',
    status: 'PASS', generatedAt: new Date().toISOString(), elapsedNpcSimulationMinutes: 120, coreResidentCount: 12,
    viewports: reportRows }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ status: 'PASS', screenshots: reportRows.map(row => row.screenshot), pageErrors: 0,
    maps: reportRows.map(row => row.mapId), opinionBoardVisible: reportRows.every(row => row.opinionBoardVisible) }, null, 2));
} finally {
  await browser.close();
  server.kill();
}
