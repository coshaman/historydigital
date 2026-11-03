import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const { createInitialState, saveGame } = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const maps = Object.fromEntries(await Promise.all((await readdir(path.join(root, 'rpg/maps')))
  .filter(file => file.endsWith('.json')).map(async file => {
    const map = await readJson(`rpg/maps/${file}`);
    return [map.mapId, map];
  })));
const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters')))
  .filter(file => file.endsWith('.json')).map(file => readJson(`rpg/characters/${file}`)));
const quests = (await Promise.all((await readdir(path.join(root, 'rpg/quests')))
  .filter(file => file.endsWith('.json')).map(file => readJson(`rpg/quests/${file}`))))
  .filter(quest => Array.isArray(quest.actions) && quest.historicalOutcome?.id);

const portProbe = createServer();
await new Promise((resolve, reject) => { portProbe.once('error', reject); portProbe.listen(0, '127.0.0.1', resolve); });
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root, env: { ...process.env, CHANCERY_PORT: String(port) }, stdio: 'ignore', windowsHide: true,
});
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const origin = `http://127.0.0.1:${port}`;
const question = '검열 뒤에 돌아온 교정쇄라면, 작업자는 고친 글자만 책임지면 될까요?';
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(`${origin}/api/rpg/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, 'local Vercel-compatible server should start');

  const state = createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
  state.player.embodiment = 'clerk_alexei';
  state.hosts.clerk_alexei.mapId = 'nevsky';
  state.hosts.clerk_alexei.position = { x: 10, y: 16 };
  state.hosts.printer_ekaterina.mapId = 'nevsky';
  state.hosts.printer_ekaterina.position = { x: 11, y: 16 };
  for (const host of Object.values(state.hosts)) {
    if (!['clerk_alexei', 'printer_ekaterina'].includes(host.id) && host.mapId === 'nevsky') host.position = { x: 25, y: 18 };
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), pageErrors = [], apiCalls = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('response', response => {
    if (['/api/rpg/session/start', '/api/rpg/dialogue'].includes(new URL(response.url()).pathname)) {
      apiCalls.push({ path: new URL(response.url()).pathname, status: response.status() });
    }
  });
  page.on('request', request => {
    const pathName = new URL(request.url()).pathname;
    if (['/api/rpg/session/start', '/api/rpg/dialogue'].includes(pathName)) {
      const body = request.postDataJSON() ?? {};
      apiCalls.push({ request: pathName, hostId: body.hostId ?? null, actorHostId: body.actorHostId ?? null, sceneContext: body.sceneContext ?? null });
    }
  });
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.evaluate(value => {
    localStorage.clear();
    localStorage.setItem('v33-rpg-save', value);
    localStorage.setItem('v34-tutorial-stage', 'done');
  }, saveGame(state));
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#discussion-quest-items li').filter({ hasText: '인쇄 노동자는 문장의 뜻까지 책임져야 할까' })
    .getByRole('button', { name: '이 질문 담기' }).click();
  await page.locator('#talk').click();
  const reply = page.locator('#actions button').filter({ hasText: question }).first();
  await reply.waitFor({ state: 'visible', timeout: 6000 });
  await reply.click();
  await page.waitForFunction(() => /AI 생성 답변 ·|AI 응답 생성 실패|AI 연결 실패/.test(document.querySelector('#record')?.textContent ?? ''), null, { timeout: 30000 });
  const visibleResult = await page.evaluate(() => ({
    status: document.querySelector('#record')?.textContent ?? '',
    answer: document.querySelector('#journal-text')?.textContent ?? '',
  }));
  await page.locator('#save').click();
  const storedResult = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('v33-rpg-save'))?.state;
    const turn = [...(state?.ledger ?? [])].reverse().find(item => item.discussionId === 'INQUIRY_CENSORSHIP_AND_LABOR');
    return {
      aiGeneratedEvent: turn?.aiGenerated === true,
      recordedHost: turn?.hostId ?? null,
      discussionId: turn?.discussionId ?? null,
    };
  });
  const result = { status: visibleResult.status, generatedAnswerVisible: Boolean(visibleResult.answer.trim()) && !/생성 답변을 받지 못했습니다/.test(visibleResult.answer), answerLength: visibleResult.answer.length, ...storedResult };
  assert.match(result.status, /^AI 생성 답변 ·/, `player question must display the generated model answer: ${JSON.stringify({ status: result.status, apiCalls })}`);
  assert.equal(result.generatedAnswerVisible, true);
  assert.equal(result.aiGeneratedEvent, true, 'the displayed response must be recorded as generated');
  assert.equal(result.recordedHost, 'printer_ekaterina');
  assert.equal(result.discussionId, 'INQUIRY_CENSORSHIP_AND_LABOR');
  assert.ok(apiCalls.some(call => call.path === '/api/rpg/session/start' && call.status === 201), 'UI should open an AI session');
  assert.ok(apiCalls.some(call => call.path === '/api/rpg/dialogue' && call.status === 200), 'UI should request a generated answer');
  assert.deepEqual(pageErrors, []);

  const report = {
    schemaVersion: 'V36_LIVE_AI_GAMEPLAY_1', timestamp: new Date().toISOString(),
    source: 'local .env.local via same-origin Vercel-compatible API', model: process.env.OPENAI_DIALOGUE_MODEL || 'gpt-5.4-mini',
    paidGenerations: 1, viewport: { width: 1440, height: 900 }, ...result, status: 'PASS', dialogueStatus: result.status, apiCalls, pageErrors,
    responseTextStored: false, credentialsStoredOrPrinted: false,
  };
  const reportDir = path.join(root, 'docs/v36/current-audit');
  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, 'REAL_AI_IN_GAME_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status: report.status, paidGenerations: 1, generatedAnswerVisible: result.generatedAnswerVisible,
    aiGeneratedEvent: result.aiGeneratedEvent, apiStatuses: apiCalls.filter(call => Number.isInteger(call.status)).map(call => call.status), pageErrors: 0,
    responseTextStored: false, credentialsStoredOrPrinted: false }, null, 2));
  await context.close();
} finally {
  await browser.close();
  server.kill();
}
