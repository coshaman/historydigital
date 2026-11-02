import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const root = process.cwd();
const output = path.join(root, 'docs', 'v36', 'baseline', 'screenshots');
await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const { createInitialState, saveGame } = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const mapNames = await readdir(path.join(root, 'rpg/maps'));
const maps = Object.fromEntries(await Promise.all(mapNames.filter(name => name.endsWith('.json'))
  .map(async name => [name.slice(0, -5), await readJson(`rpg/maps/${name}`)])));
const hostCards = await Promise.all(['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','senior_clerk_konstantin','reader_darya','editor_sofia','police_sergeant_ivan','nekrasov_reconstruction','literary_chichikov','literary_akaky','literary_petrovich'].map(id => readJson(`rpg/characters/${id}.json`)));
const questIds = ['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','literary-dead-souls','literary-overcoat'];
const quests = await Promise.all(questIds.map(id => readJson(`rpg/quests/${id}.json`)));
const state = createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' });
state.player.embodiment = 'clerk_alexei';
state.hosts.clerk_alexei.mapId = 'nevsky';
state.hosts.clerk_alexei.position = { x: 11, y: 16 };
state.world.currentMapId = 'nevsky';
const save = saveGame(state);
const portProbe = createServer();
await new Promise((resolve, reject) => { portProbe.once('error', reject); portProbe.listen(0, '127.0.0.1', resolve); });
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, CHANCERY_PORT: String(port) }, stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const viewports = [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }];
const rows = [];
try {
  const base = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error('local_server_unavailable');
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v34-tutorial-stage', 'done'); }, save);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#world').waitFor();
    await page.waitForTimeout(250);
    const stateView = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      body: document.querySelector('#bodyname')?.textContent,
      mission: document.querySelector('#mission-title')?.textContent,
      opinionMission: document.querySelector('#discussion-quest-progress')?.textContent,
      opinionBoardVisible: !document.querySelector('#discussion-quest-board')?.hidden,
      canvas: { width: document.querySelector('#world')?.width, height: document.querySelector('#world')?.height },
      actionsVisible: [...document.querySelectorAll('.touch-pad button')].every(button => { const r = button.getBoundingClientRect(); return r.width && r.height && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }),
    }));
    const file = `${viewport.width}x${viewport.height}-baseline.png`;
    await page.screenshot({ path: path.join(output, file) });
    rows.push({ ...stateView, screenshot: file, pageErrors: errors });
    await context.close();
  }
  await writeFile(path.join(output, 'CAPTURE_MANIFEST.json'), JSON.stringify({ baselineCommit: '7974392eb6e30a19607ff306972159fe5cd47b2e', generatedAt: new Date().toISOString(), purpose: 'Pre-V36 implementation screenshots of the existing playable build; baseline only, not V36 acceptance evidence.', viewports: rows }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ status: 'PASS', screenshots: rows.length, pageErrors: rows.reduce((count, row) => count + row.pageErrors.length, 0), output: path.relative(root, output) }, null, 2));
} finally {
  await browser.close();
  server.kill();
}
