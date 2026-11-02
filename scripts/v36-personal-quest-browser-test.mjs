import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const maps = Object.fromEntries(await Promise.all((await readdir(path.join(root, 'rpg/maps'))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const hostCards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/characters/${file}`)));
const quests = (await Promise.all((await readdir(path.join(root, 'rpg/quests'))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/quests/${file}`)))).filter(quest => Array.isArray(quest.actions) && quest.historicalOutcome?.id);
const quest = quests.find(item => item.id === 'READER_SOURCE_AND_RUMOR_1847');
const hostId = quest.entry.requiredHostId;
let state = game.createInitialState({ maps, hostCards, quests, startMapId: quest.entry.mapId });
state.world.chapterId = quest.chapterId;
state.world.date = quest.date;
state.player.embodiment = hostId;
state.hosts[hostId].mapId = quest.entry.mapId;
state.hosts[hostId].position = { x: 19, y: 14 };
state.player.position = { ...state.hosts[hostId].position };
const save = game.saveGame(state);
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, OPENAI_API_KEY: '', CHANCERY_PORT: String(port) }, stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const base = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 150)); }
  assert.ok(ready, 'local server starts');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v34-tutorial-stage', 'done'); }, save);
  await page.reload({ waitUntil: 'networkidle' });
  assert.match(await page.locator('#mission-title').textContent(), /읽은 문장과 들은 소문/);
  await page.locator('#use').click();
  await page.waitForTimeout(120);
  const interactionState = await page.evaluate(() => ({ title: document.querySelector('#headline')?.textContent, journal: document.querySelector('#journal-text')?.textContent,
    record: document.querySelector('#record')?.textContent, actions: [...document.querySelectorAll('#actions button')].map(button => button.textContent),
    host: JSON.parse(localStorage.getItem('v33-rpg-save')).state.player.embodiment, map: JSON.parse(localStorage.getItem('v33-rpg-save')).state.world.currentMapId,
    position: JSON.parse(localStorage.getItem('v33-rpg-save')).state.hosts.reader_darya.position }));
  if (!interactionState.actions.some(text => text.startsWith('읽은 문장을 보여 주고 해석은 따로 말한다'))) throw new Error(`quest_object_did_not_open:${JSON.stringify(interactionState)}`);
  const choice = page.getByRole('button', { name: /읽은 문장을 보여 주고 해석은 따로 말한다/ });
  await choice.waitFor({ state: 'visible', timeout: 4000 });
  await choice.click();
  await page.locator('#save').click();
  const result = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
    return { questStatus: state.quests.READER_SOURCE_AND_RUMOR_1847?.status,
      chosenAction: state.ledger.at(-1)?.actionId, response: document.querySelector('#journal-text')?.textContent,
      missionTitle: document.querySelector('#mission-title')?.textContent, errors: [] };
  });
  assert.equal(result.questStatus, 'resolved');
  assert.equal(result.chosenAction, 'READER_SOURCE_AND_RUMOR_1847_QUOTE');
  assert.match(result.response, /문장과.*해석/);
  assert.equal(errors.length, 0, errors.join('; '));
  const output = path.join(root, 'docs', 'v36', 'current-audit');
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'reader-opinion-quest-click.png'), fullPage: true });
  await writeFile(path.join(output, 'PERSONAL_QUEST_BROWSER_EVIDENCE.json'), JSON.stringify({ status: 'PASS', viewport: { width: 1440, height: 900 }, questId: quest.id,
    hostId, choiceCount: quest.actions.length, chosenAction: result.chosenAction, resolved: true, pageErrors: errors }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ status: 'PASS', questId: quest.id, hostId, choiceCount: quest.actions.length,
    chosenAction: result.chosenAction, questResolved: true, pageErrors: errors.length }, null, 2));
  await context.close();
} finally {
  await browser.close();
  server.kill();
}
