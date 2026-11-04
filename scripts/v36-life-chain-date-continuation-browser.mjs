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
const engine = globalThis.V33GameState;
const maps = Object.fromEntries(await Promise.all((await readdir(path.join(root, 'rpg/maps'))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));
const hostCards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/characters/${file}`)));
const quests = (await Promise.all((await readdir(path.join(root, 'rpg/quests'))).filter(file => file.endsWith('.json'))
  .map(file => readJson(`rpg/quests/${file}`)))).filter(quest => Array.isArray(quest.actions) && quest.historicalOutcome?.id);
const activeQuest = quests.find(quest => quest.id === 'STUDENT_CIRCLE_RISK_1847');
assert.ok(activeQuest, 'the deployed Vasily discussion quest exists');
const hostId = activeQuest.entry.requiredHostId;
const map = maps[activeQuest.entry.mapId];
const target = map.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === activeQuest.entry.objectId);
assert.ok(target, 'the discussion quest has a physical map object');
const tile = { x: Math.floor(target.x / 16), y: Math.floor(target.y / 16) };
let state = engine.createInitialState({ maps, hostCards, quests, startMapId: activeQuest.entry.mapId });
state.world.chapterId = activeQuest.chapterId;
state.world.date = activeQuest.date;
state.player.embodiment = hostId;
state.hosts[hostId].mapId = activeQuest.entry.mapId;
state.hosts[hostId].position = { ...tile };
state.player.position = { ...tile };
const originalDate = state.world.date;
for (const quest of quests) state.quests[quest.id] = { status: quest.id === activeQuest.id ? 'open' : 'resolved', result: null };
const serialized = engine.saveGame(state);

const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, OPENAI_API_KEY: '', CHANCERY_PORT: String(port) }, stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const base = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 125));
  }
  assert.ok(ready, 'local static build server starts');
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(value => {
    localStorage.clear();
    localStorage.setItem('v33-rpg-save', value);
    localStorage.setItem('v34-tutorial-stage', 'done');
  }, serialized);
  await page.reload({ waitUntil: 'networkidle' });
  assert.match(await page.locator('#mission-title').textContent(), /말할 기회와 감당할 위험/);
  await page.locator('#use').click();
  const choice = page.getByRole('button', { name: /회비와 이름을 내고 공개 토론에서 말한다/ });
  await choice.waitFor({ state: 'visible', timeout: 5000 });
  await choice.click();
  await page.locator('#save').click();
  const stageOneResult = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
    return {
      date: saved.world.date,
      status: saved.quests.STUDENT_CIRCLE_RISK_1847?.status,
      actionId: saved.ledger.at(-1)?.actionId,
      visibleActions: [...document.querySelectorAll('#actions button')].map(button => button.textContent),
      record: document.querySelector('#record')?.textContent,
    };
  });
  assert.equal(stageOneResult.date, originalDate, 'same-day personal stages must not change campaign date');
  assert.equal(stageOneResult.status, 'resolved');
  assert.equal(stageOneResult.actionId, 'STUDENT_VASILY_CHOICE_1');
  assert.ok(stageOneResult.visibleActions.some(text => text.includes('현재 인물의 다음 목표 확인하기')),
    `resolved personal quest must stay on its non-campaign continuation: ${JSON.stringify(stageOneResult.visibleActions)}`);
  assert.doesNotMatch(stageOneResult.record ?? '', /invalid_campaign_date/);

  await page.getByRole('button', { name: /현재 인물의 다음 목표 확인하기/ }).click();
  const continued = await page.evaluate(() => ({
    date: JSON.parse(localStorage.getItem('v33-rpg-save')).state.world.date,
    mission: document.querySelector('#mission-title')?.textContent,
    headline: document.querySelector('#headline')?.textContent,
    journal: document.querySelector('#journal-text')?.textContent,
    record: document.querySelector('#record')?.textContent,
  }));
  assert.equal(continued.date, originalDate, 'continuing a same-day personal arc must leave the historical campaign date unchanged');
  assert.match(continued.mission, /오늘 맡은 일|말할 기회와 감당할 위험/);
  assert.doesNotMatch(`${continued.journal} ${continued.record}`, /invalid_campaign_date|날짜를 진행할 수 없음/);
  assert.equal(errors.length, 0, errors.join('\n'));

  const output = path.join(root, 'docs/v36/current-audit');
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'vassily-personal-quest-date-continuation.png'), fullPage: true });
  await writeFile(path.join(output, 'LIFE_CHAIN_DATE_CONTINUATION_BROWSER_EVIDENCE.json'), `${JSON.stringify({
    status: 'PASS', viewport: { width: 1366, height: 768 }, hostId, questId: activeQuest.id,
    selectedActionId: stageOneResult.actionId, questResolved: true,
    continuationStayedOutsideCampaignTimeline: true, campaignDateBefore: originalDate, campaignDateAfter: continued.date,
    noInvalidCampaignDate: true, pageErrors: errors,
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status: 'PASS', hostId, questId: activeQuest.id,
    questResolved: true, campaignDateUnchanged: true, noInvalidCampaignDate: true, pageErrors: errors.length }, null, 2));
  await page.close();
} finally {
  await browser.close();
  server.kill();
}
