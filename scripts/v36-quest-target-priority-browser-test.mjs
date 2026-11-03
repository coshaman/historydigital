import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd(), require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const maps = Object.fromEntries(await Promise.all((await readdir(path.join(root, 'rpg/maps'))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const hostCards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => readJson(`rpg/characters/${file}`)));
const quests = (await Promise.all((await readdir(path.join(root, 'rpg/quests'))).filter(file => file.endsWith('.json')).map(file => readJson(`rpg/quests/${file}`))))
  .filter(quest => Array.isArray(quest.actions) && quest.historicalOutcome?.id);
const bundle = await readJson('rpg/quests/resident-arcs-v36.json');
assert.equal(bundle.quests.length, 108, 'all personal arcs are loaded with one static request');
const quest = quests.find(item => item.id === 'STUDENT_CIRCLE_RISK_1847');
const hostId = quest.entry.requiredHostId;
const state = game.createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' });
state.world.chapterId = quest.chapterId; state.world.date = quest.date;
state.player.embodiment = hostId;
state.hosts[hostId].mapId = 'nevsky';
state.hosts[hostId].position = { x: 24, y: 16 };
state.player.position = { ...state.hosts[hostId].position };
const portProbe = createServer();
await new Promise((resolve, reject) => { portProbe.once('error', reject); portProbe.listen(0, '127.0.0.1', resolve); });
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, OPENAI_API_KEY: '', CHANCERY_PORT: String(port) }, stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const origin = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 125)); }
  assert.ok(ready, 'local Vercel-compatible web app starts');
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
  let arcBundleRequestCount = 0;
  const arcBundleRequestsPerStartup = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/rpg/quests/resident-arcs-v36.json') arcBundleRequestCount += 1;
  });
  await page.goto(origin, { waitUntil: 'networkidle' });
  assert.equal(arcBundleRequestCount, 1, 'initial game startup should request the complete resident arc bundle once');
  arcBundleRequestsPerStartup.push(arcBundleRequestCount);
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v34-tutorial-stage', 'done'); }, game.saveGame(state));
  let previousArcBundleCount = arcBundleRequestCount;
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(arcBundleRequestCount - previousArcBundleCount, 1, 'saved game reload should request the bundle once');
  arcBundleRequestsPerStartup.push(arcBundleRequestCount - previousArcBundleCount);
  await page.locator('#use').click();
  const visible = await page.evaluate(() => ({ title: document.querySelector('#headline')?.textContent, actions: [...document.querySelectorAll('#actions button')].map(button => button.textContent) }));
  assert.match(visible.title, /말할 기회와 감당할 위험/, `the active quest object should beat the adjacent market counter: ${JSON.stringify(visible)}`);
  assert.ok(visible.actions.some(text => text.startsWith('회비와 이름을 내고 공개 토론에서 말한다')),
    `the specific quest choices should open instead of the adjacent stall: ${JSON.stringify(visible)}`);
  const stepanQuest = bundle.quests.find(item => item.entry.requiredHostId === 'print_apprentice_stepan' && item.lifeChain.stage === 1);
  const stepanObject = maps[stepanQuest.entry.mapId].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === stepanQuest.entry.objectId);
  const stepanState = game.createInitialState({ maps, hostCards, quests, startMapId: stepanQuest.entry.mapId });
  stepanState.world.chapterId = stepanQuest.chapterId; stepanState.world.date = stepanQuest.date;
  stepanState.player.embodiment = 'print_apprentice_stepan';
  stepanState.hosts.print_apprentice_stepan.mapId = stepanQuest.entry.mapId;
  stepanState.hosts.print_apprentice_stepan.position = { x: Math.floor(stepanObject.x / 16), y: Math.floor(stepanObject.y / 16) };
  stepanState.player.position = { ...stepanState.hosts.print_apprentice_stepan.position };
  await page.evaluate(value => localStorage.setItem('v33-rpg-save', value), game.saveGame(stepanState));
  previousArcBundleCount = arcBundleRequestCount;
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(arcBundleRequestCount - previousArcBundleCount, 1, 'resident quest scenario should request the bundle once');
  arcBundleRequestsPerStartup.push(arcBundleRequestCount - previousArcBundleCount);
  await page.locator('#use').click();
  const bundledQuest = await page.evaluate(() => ({ title: document.querySelector('#headline')?.textContent, actions: [...document.querySelectorAll('#actions button')].map(button => button.textContent) }));
  assert.match(bundledQuest.title, /고친 글자와 찍은 손/, `the resident quest shipped only in the bundle must be available in-game: ${JSON.stringify(bundledQuest)}`);
  assert.ok(bundledQuest.actions.some(text => text.startsWith('바뀐 활자와 확인 시각만 교정표에 남긴다')),
    `the actual quest choices should load from the bundled resident arc: ${JSON.stringify(bundledQuest)}`);
  assert.equal(bundledQuest.actions.length, 3, 'bundled personal quest presents its three consequential choices');
  assert.equal(errors.length, 0, errors.join('; '));
  const output = path.join(root, 'docs/v36/current-audit'); await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'QUEST_TARGET_PRIORITY_BROWSER_EVIDENCE.json'), `${JSON.stringify({ status: 'PASS', scenarios: [{ scenario: 'Vasily quest object beside Lev market stand', mapId: 'nevsky', questId: quest.id, targetWon: true }, { scenario: 'quest loaded from one-request resident bundle', questId: stepanQuest.id, choicesVisible: bundledQuest.actions.length === 3 }], residentArcBundleRequestsPerStartup: arcBundleRequestsPerStartup, pageErrors: errors }, null, 2)}\n`);
  await page.screenshot({ path: path.join(output, 'quest-target-priority.png'), fullPage: false });
  console.log(JSON.stringify({ status: 'PASS', questTargetWon: true, bundledQuest: stepanQuest.id, bundledQuestChoices: bundledQuest.actions.length, residentArcBundleRequestsPerStartup: arcBundleRequestsPerStartup, pageErrors: errors.length }));
} finally { await browser.close(); server.kill(); }
