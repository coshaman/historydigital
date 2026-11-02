import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const { createInitialState, saveGame } = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const mapFiles = (await readdir(path.join(root, 'rpg/maps'))).filter(name => name.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async name => [name.slice(0, -5), await readJson(`rpg/maps/${name}`)])));
const hostIds = ['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','senior_clerk_konstantin','reader_darya','editor_sofia','police_sergeant_ivan','yardkeeper_semyon','laundress_mariya','baker_fyodor','market_nadezhda','porter_gavrila','coachman_timofey','housemaid_olga','midwife_avdotya','apothecary_yakov','print_apprentice_stepan','bookbinder_elizaveta','scribal_yuri','innkeeper_irina','student_vasily','teacher_lyubov','minor_noble_andrei','landlady_polina','watercarrier_luka','fishseller_klavdiya','warehouse_pyotr','servant_varvara','junior_guard_sergey','carter_roman','street_vendor_matryona','typesetter_nikita','lodging_tatyana','nekrasov_reconstruction','literary_chichikov','literary_akaky','literary_petrovich'];
const hostCards = await Promise.all(hostIds.map(id => readJson(`rpg/characters/${id}.json`)));
const questIds = ['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','yard-ledger-1847','laundry-wages-1847','bakery-flour-1847','market-prices-1847','porter-load-1847','coach-fare-1847','household-privacy-1847','midwife-care-cost-1847','apothecary-limits-1847','apprentice-authorship-1847','bookbinder-damage-1847','scribal-copy-1847','inn-debt-rumor-1847','student-circle-risk-1847','teacher-access-cost-1847','noble-status-debt-1847','landlady-rent-commons-1847','water-access-queue-1847','fish-storage-time-1847','warehouse-loss-record-1847','servant-private-warning-1847','guard-entry-bribe-1847','carter-delivery-delay-1847','street-vendor-weather-1847','typesetter-speed-censorship-1847','lodging-reading-income-1847','literary-dead-souls','literary-overcoat'];
const quests = await Promise.all(questIds.map(id => readJson(`rpg/quests/${id}.json`)));
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, OPENAI_API_KEY: '', CHANCERY_PORT: String(port) }, stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const checks = [];
try {
  const url = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error('local_server_unavailable');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url, { waitUntil: 'networkidle' });
    const result = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      boardVisible: !document.querySelector('#discussion-quest-board')?.hidden,
      missionVisible: !document.querySelector('#mission-tracker')?.hidden,
      progress: document.querySelector('#discussion-quest-progress')?.textContent,
      guidance: document.querySelector('#discussion-quest-guidance')?.textContent,
      rows: [...document.querySelectorAll('#discussion-quest-items li')].map(item => item.textContent),
      overflowX: document.documentElement.scrollWidth > innerWidth,
    }));
    if (!result.boardVisible || !result.missionVisible || !/E로 몸을 빌리기/.test(result.guidance) || !/다음 인물에게 같은 쟁점/.test(result.guidance) || result.rows.length !== 4 || result.overflowX || errors.length) {
      throw new Error(`opinion_board_not_actionable:${JSON.stringify({ result, errors })}`);
    }
    await page.locator('#discussion-quest-more').click();
    const expandedRows = await page.locator('#discussion-quest-items li').count();
    if (expandedRows < 16 || await page.locator('.discussion-inquiry-select').count() < 16) throw new Error(`opinion_questions_not_expandable:${expandedRows}`);
    await page.locator('.discussion-inquiry-select').first().click();
    if (!/선택한 질문/.test(await page.locator('#discussion-quest-guidance').textContent())) throw new Error('selected_opinion_question_not_guided');
    checks.push({ ...result, expandedRows, selectedQuestionGuided: true, pageErrors: errors });
    await context.close();
  }
  const playState = createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' });
  playState.player.embodiment = 'clerk_alexei';
  playState.hosts.clerk_alexei.mapId = 'nevsky';
  playState.hosts.clerk_alexei.position = { x: 10, y: 16 };
  playState.hosts.printer_ekaterina.mapId = 'nevsky';
  playState.hosts.printer_ekaterina.position = { x: 11, y: 16 };
  for (const id of hostIds.filter(id => !['clerk_alexei','printer_ekaterina'].includes(id))) {
    if (playState.hosts[id].mapId === 'nevsky') playState.hosts[id].position = { x: 25, y: 18 };
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v34-tutorial-stage', 'done'); }, saveGame(playState));
  await page.reload({ waitUntil: 'networkidle' });
  const laborInquiry = page.locator('#discussion-quest-items li').filter({ hasText: '인쇄 노동자는 문장의 뜻까지 책임져야 할까' });
  await laborInquiry.getByRole('button', { name: '이 질문 담기' }).click();
  if (!/예카테리나 벨로바에게/.test(await page.locator('#discussion-quest-guidance').textContent())) throw new Error('selected_question_did_not_name_first_speaker');
  await page.locator('#talk').click();
  await page.waitForTimeout(150);
  const offeredQuestions = await page.locator('#actions button').allTextContents();
  const conversationProbe = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
    const actor = state.hosts[state.player.embodiment];
    return { actor: actor.id, actorMap: actor.mapId, actorPosition: actor.position, nearby: Object.values(state.hosts).filter(person => person.id !== actor.id && person.mapId === state.world.currentMapId && Math.abs(person.position.x - actor.position.x) + Math.abs(person.position.y - actor.position.y) <= 2).map(person => ({ id: person.id, position: person.position })) };
  });
  const questionButton = page.locator('#actions button').filter({ hasText: '검열 뒤에 돌아온 교정쇄라면' }).first();
  if (await questionButton.count() !== 1) throw new Error(`expected_opinion_question_not_offered:${JSON.stringify({ offeredQuestions, conversationProbe })}`);
  await questionButton.click();
  await page.waitForTimeout(1200);
  await page.locator('#save').click();
  await page.waitForTimeout(100);
  const offlineResult = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
    const event = [...state.ledger].reverse().find(item => item.discussionId === 'INQUIRY_CENSORSHIP_AND_LABOR');
    return { aiGenerated: event?.aiGenerated === true, discussionId: event?.discussionId, perspectiveHostIds: state.ledger.filter(item => item.discussionId === event?.discussionId).map(item => item.hostId), lastLedgerEvent: state.ledger.at(-1), perspectiveCount: state.player.dialogueGrowth.perspectiveNotes.filter(note => note.discussionId === event?.discussionId).length, aiReplyCount: state.player.dialogueGrowth.aiReplies, boardRows: [...document.querySelectorAll('#discussion-quest-items li')].map(item => item.textContent), boardGuidance: document.querySelector('#discussion-quest-guidance')?.textContent, recordText: document.querySelector('#record')?.textContent, answerText: document.querySelector('#journal-text')?.textContent, dialogueHistory: document.querySelector('#dialogue-history-lines')?.textContent, remainingButtons: [...document.querySelectorAll('#actions button')].map(button => button.textContent) };
  });
    if (offlineResult.aiGenerated || offlineResult.discussionId !== 'INQUIRY_CENSORSHIP_AND_LABOR' || offlineResult.perspectiveCount !== 1 || offlineResult.aiReplyCount !== 0 || !offlineResult.boardRows.some(row => /1\/2 관점/.test(row)) || !/첫 관점 기록됨.*알렉세이 오를로프에게 같은 쟁점 묻기/.test(offlineResult.boardGuidance) || errors.length) {
    throw new Error(`offline_question_did_not_progress_honestly:${JSON.stringify({ offlineResult, conversationProbe, errors })}`);
  }
  await page.getByRole('button', { name: '대화 마치기' }).click();
  await page.locator('#release').click();
  await page.locator('#use').click();
  await page.getByRole('button', { name: /예카테리나 벨로바 살펴보기/ }).click();
  await page.getByRole('button', { name: '몸을 빌린다' }).click();
  await page.locator('#talk').click();
  const secondQuestion = page.locator('#actions button').filter({ hasText: '문서에 적힌 주장과 확인한 사실을 나누는 일은 누구의 책임이라고 보세요?' }).first();
  await secondQuestion.waitFor({ state: 'visible', timeout: 5000 });
  if (await secondQuestion.count() !== 1) throw new Error(`second_perspective_question_not_offered:${JSON.stringify({ actor: await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state.player.embodiment), ledger: await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state.ledger.filter(item => item.discussionId === 'INQUIRY_CENSORSHIP_AND_LABOR').map(item => ({ hostId: item.hostId, actorHostId: item.actorHostId }))), buttons: await page.locator('#actions button').allTextContents() })}`);
  await secondQuestion.click();
  await page.waitForTimeout(1200);
  await page.locator('#save').click();
  const completedPair = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
    const turns = state.ledger.filter(event => event.discussionId === 'INQUIRY_CENSORSHIP_AND_LABOR');
    const note = state.player.dialogueGrowth.comparisonNotes.find(item => item.discussionId === 'INQUIRY_CENSORSHIP_AND_LABOR');
    return { hostIds: [...new Set(turns.map(turn => turn.hostId))].sort(), aiGeneratedTurns: turns.filter(turn => turn.aiGenerated).length, aiReplies: state.player.dialogueGrowth.aiReplies, comparisonNoteHostIds: note?.hostIds?.sort(), boardProgress: document.querySelector('#discussion-quest-progress')?.textContent };
  });
  if (completedPair.hostIds.join(',') !== 'clerk_alexei,printer_ekaterina' || completedPair.aiGeneratedTurns !== 0 || completedPair.aiReplies !== 0 || completedPair.comparisonNoteHostIds?.join(',') !== 'clerk_alexei,printer_ekaterina' || !completedPair.boardProgress?.includes('1 / 16 완료') || errors.length) {
    throw new Error(`two_person_offline_inquiry_did_not_complete:${JSON.stringify({ completedPair, errors })}`);
  }
  checks.push({ offlineAuthoredAnswer: offlineResult, completedTwoPerspectiveInquiry: completedPair, pageErrors: errors });
  await context.close();
  console.log(JSON.stringify({ status: 'PASS', possessionNotRequiredToSeeOpinionGoals: true, offlineTwoPerspectiveInquiryCompletesWithoutPretendingAi: true, progressPersistsAfterSave: true, checks }, null, 2));
} finally {
  await browser.close();
  server.kill();
}
