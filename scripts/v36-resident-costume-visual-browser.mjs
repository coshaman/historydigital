import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const outputDir = path.join(root, 'docs/v36/current-audit/screenshots');
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
const targets = [
  { residentId: 'market_nadezhda', mapId: 'market-quay', expectedStyle: 'skirt' },
  { residentId: 'junior_guard_sergey', mapId: 'chancery', expectedStyle: 'gatekeeper' },
  { residentId: 'fishseller_klavdiya', mapId: 'market-quay', expectedStyle: 'fishvendor' },
  { residentId: 'carter_roman', mapId: 'market-quay', expectedStyle: 'cartdriver' },
  { residentId: 'coachman_timofey', mapId: 'market-quay', expectedStyle: 'cabman' },
  { residentId: 'street_vendor_matryona', mapId: 'nevsky', expectedStyle: 'scarf' },
  { residentId: 'baker_fyodor', mapId: 'bakery-interior', expectedStyle: 'cap' },
].map(target => ({ ...target, card: cards.find(item => item.id === target.residentId), map: maps[target.mapId] }));
for (const target of targets) {
  assert.ok(target.card && target.map && registry.districts.some(item => item.residentIds?.includes(target.card.id)), `${target.residentId} and map data exist`);
  assert.equal(target.card.sprite.style, target.expectedStyle);
  assert.ok(target.card.sprite.visualReferenceIds?.length, `${target.residentId} identifies its inspected visual source`);
}

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
const pageErrors = [];
try {
  const base = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, 'local source runtime serves the game');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(String(error.stack ?? error)));
  await page.goto(base, { waitUntil: 'networkidle' });
  const caseReports = [];
  for (const target of targets) {
    const { card, map } = target;
    const state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: target.mapId });
    state.world.currentMapId = target.mapId;
    state.world.clockMinutes = 600;
    state.world.date = '1847-06-01';
    state.player.position = { ...map.metadata.observerStart };
    state.player.embodiment = card.id;
    state.hosts[card.id].mapId = target.mapId;
    state.hosts[card.id].position = { ...map.metadata.observerStart };
    state.learning = { ...state.learning, phase: 'complete', circleLearning: 'attended', examOutcome: 'passed', examCorrectCount: 4, promotionStatus: 'promoted', examAnswers: {}, timelineIndex: 0 };
    const saved = game.saveGame(state);
    const restored = game.loadGame(saved, { maps, hostCards: cards, quests });
    assert.equal(restored.state?.player?.embodiment ?? restored.player?.embodiment, card.id, `${card.id} possession survives save/load`);
    await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v34-tutorial-stage', 'done'); }, saved);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#world').waitFor({ state: 'visible' });
    await page.waitForFunction(name => document.querySelector('#mapname')?.textContent?.includes(name), map.metadata.displayNameKo, { timeout: 10000 });
    await page.waitForTimeout(180);
    const view = await page.evaluate(() => ({
      mapName: document.querySelector('#mapname')?.textContent,
      embodiment: JSON.parse(localStorage.getItem('v33-rpg-save') ?? '{}').state?.player?.embodiment,
      canvas: { width: document.querySelector('#world')?.width, height: document.querySelector('#world')?.height },
      documentWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(view.embodiment, card.id);
    assert.ok(view.canvas.width > 0 && view.canvas.height > 0, `${card.id} canvas rendered on ${target.mapId}`);
    assert.ok(view.documentWidth <= 1440, `no desktop overflow for ${card.id}: ${view.documentWidth}`);
    assert.equal(pageErrors.length, 0, `${card.id} has no browser errors: ${pageErrors.join('; ')}`);
    const screenshot = `docs/v36/current-audit/screenshots/${card.id.replaceAll('_', '-')}-costume-1440.png`;
    await page.screenshot({ path: path.join(root, screenshot), fullPage: true });
    caseReports.push({
      mapId: target.mapId,
      possessedResidentId: card.id,
      spriteFile: `rpg/${card.sprite.file}`,
      costumeStyle: card.sprite.style,
      visualReferenceIds: card.sprite.visualReferenceIds,
      saveLoadRestoredPossession: true,
      renderedCanvas: view.canvas,
      documentWidth: view.documentWidth,
      pageErrors: [],
      screenshot,
    });
  }
  await context.close();
  const report = {
    schemaVersion: 'V36_RESIDENT_COSTUME_VISUAL_BROWSER_V1',
    status: 'PASS',
    viewport: { width: 1440, height: 900 },
    pageErrors,
    reviewedResidents: caseReports,
  };
  await writeFile(path.join(root, 'docs/v36/current-audit/RESIDENT_COSTUME_BROWSER_EVIDENCE.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.kill();
}
