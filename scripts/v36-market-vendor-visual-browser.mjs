import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const outputDir = path.join(root, 'docs/v36/current-audit/screenshots');
const screenshotPath = path.join(outputDir, 'market-nadezhda-costume-1440.png');
await mkdir(outputDir, { recursive: true });
const read = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const [registry, mapFiles, characterFiles, questFiles] = await Promise.all([
  read('rpg/data/city-districts-v36.json'),
  import('node:fs/promises').then(fs => fs.readdir(path.join(root, 'rpg/maps'))),
  import('node:fs/promises').then(fs => fs.readdir(path.join(root, 'rpg/characters'))),
  import('node:fs/promises').then(fs => fs.readdir(path.join(root, 'rpg/quests'))),
]);
const [maps, cards, questRecords] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(async file => [
    (await read(`rpg/maps/${file}`)).mapId,
    await read(`rpg/maps/${file}`),
  ])).then(Object.fromEntries),
  Promise.all(characterFiles.filter(file => file.endsWith('.json')).map(file => read(`rpg/characters/${file}`))),
  Promise.all(questFiles.filter(file => file.endsWith('.json')).map(file => read(`rpg/quests/${file}`))),
]);
const quests = questRecords.filter(quest => quest.historicalOutcome?.id && Array.isArray(quest.actions));
const card = cards.find(item => item.id === 'market_nadezhda');
const map = maps['market-quay'];
const district = registry.districts.find(item => item.residentIds?.includes(card.id));
assert.ok(card && map && district, 'market vendor and market district data exist');
assert.equal(card.sprite.style, 'skirt');

const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, OPENAI_API_KEY: '', CHANCERY_PORT: String(port) },
  stdio: 'ignore',
  windowsHide: true,
});
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
let pageErrors = [];
try {
  const base = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, 'local source runtime serves the game');
  let state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'market-quay' });
  state.world.currentMapId = 'market-quay';
  state.world.clockMinutes = 600;
  state.world.date = '1847-06-01';
  state.player.position = { ...map.metadata.observerStart };
  state.player.embodiment = card.id;
  state.hosts[card.id].mapId = 'market-quay';
  state.hosts[card.id].position = { ...map.metadata.observerStart };
  state.learning = { ...state.learning, phase: 'complete', circleLearning: 'attended', examOutcome: 'passed', examCorrectCount: 4, promotionStatus: 'promoted', examAnswers: {}, timelineIndex: 0 };
  const saved = game.saveGame(state);
  const restored = game.loadGame(saved, { maps, hostCards: cards, quests });
  assert.equal(restored.state?.player?.embodiment ?? restored.player?.embodiment, card.id, 'market vendor possession survives a save/load round trip');

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(String(error.stack ?? error)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v34-tutorial-stage', 'done'); }, saved);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#world').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#mapname')?.textContent?.includes('강변 장터'), null, { timeout: 10000 });
  await page.waitForTimeout(180);
  const view = await page.evaluate(() => ({
    mapName: document.querySelector('#mapname')?.textContent,
    embodiment: JSON.parse(localStorage.getItem('v33-rpg-save') ?? '{}').state?.player?.embodiment,
    canvas: { width: document.querySelector('#world')?.width, height: document.querySelector('#world')?.height },
    documentWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(view.embodiment, card.id);
  assert.ok(view.canvas.width > 0 && view.canvas.height > 0, 'market world canvas rendered');
  assert.ok(view.documentWidth <= 1440, `no desktop horizontal overflow: ${view.documentWidth}`);
  assert.equal(pageErrors.length, 0, `no browser errors: ${pageErrors.join('; ')}`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await context.close();
  const report = {
    schemaVersion: 'V36_MARKET_VENDOR_COSTUME_BROWSER_V1',
    status: 'PASS',
    viewport: { width: 1440, height: 900 },
    mapId: 'market-quay',
    possessedResidentId: card.id,
    spriteFile: `rpg/${card.sprite.file}`,
    costumeStyle: card.sprite.style,
    visualReferenceIds: card.sprite.visualReferenceIds,
    saveLoadRestoredPossession: true,
    renderedCanvas: view.canvas,
    documentWidth: view.documentWidth,
    pageErrors,
    screenshot: 'docs/v36/current-audit/screenshots/market-nadezhda-costume-1440.png',
  };
  await writeFile(path.join(root, 'docs/v36/current-audit/RESIDENT_COSTUME_BROWSER_EVIDENCE.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.kill();
}
