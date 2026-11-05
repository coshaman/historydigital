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
const maps = Object.fromEntries(await Promise.all((await readdir(path.join(root, 'rpg/maps'))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const hostCards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/characters/${file}`)));
const quests = (await Promise.all((await readdir(path.join(root, 'rpg/quests'))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/quests/${file}`)))).filter(quest => Array.isArray(quest.actions) && quest.historicalOutcome?.id);
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const state = game.createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' });
// This fixture starts on the last walkable northern corridor tile so the browser must move to the edge itself.
state.player.position = { x: 11, y: 9 };
state.player.facing = 'up';
const initialSave = game.saveGame(state);
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v34-tutorial-stage', 'done'); }, initialSave);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#mission-tracker').waitFor({ state: 'visible' });
  await page.locator('[data-move="up"]').click();
  await page.locator('#save').click();
  const reached = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state.player.position);
  assert.deepEqual(reached, { x: 11, y: 8 }, 'real browser input must move the player to the northern walkable edge');
  await page.locator('[data-move="up"]').click();
  await page.locator('#save').click();
  const blocked = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state.player.position);
  assert.deepEqual(blocked, reached, 'the collision boundary must stop movement beyond the map edge');
  assert.equal(errors.length, 0, `north-edge movement must not raise browser errors: ${errors.join('; ')}`);
  const screenshot = 'nevsky-north-walkable-boundary.png';
  await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
  const report = { schemaVersion: 'V36_NORTH_EDGE_BROWSER_CHECK_1', status: 'PASS', viewport: { width: 1440, height: 900 },
    mapId: 'nevsky', input: 'two real up-button clicks', start: { x: 11, y: 9 }, reached, blockedAt: blocked,
    pageErrors: errors, screenshot, noteKo: '첫 입력으로 북쪽 통행 경계까지 이동하고, 두 번째 입력은 충돌 경계에서 멈춤.' };
  await writeFile(path.join(output, 'NORTH_EDGE_BROWSER_CHECK.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await context.close();
} finally {
  await browser.close();
  server.kill();
}
