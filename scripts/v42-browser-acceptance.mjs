import fs from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = process.env.V42_BASE_URL || 'http://127.0.0.1:4173/?main20=1&v42fresh=1';
const lateGameData = JSON.parse(fs.readFileSync('narrative/LATE_GAME_SCENARIOS.json', 'utf8'));
const activityIds = lateGameData.schedule.activityIds;
const failures = [];
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const aiMockMemories = new Map();
const aiMockRequests = [];

const state = (page) => page.evaluate(() => window.__main20?.getState());
const click = async (page, name) => { const button = page.getByRole('button', { name, exact: true }); if (!(await button.count())) throw new Error(`missing button: ${name}`); await button.first().click(); await page.waitForTimeout(20); };
const advanceButton = async (page) => { const buttons = page.locator('#choiceArea button'); if (!(await buttons.count())) throw new Error('choice area dead end'); await buttons.first().click(); await page.waitForTimeout(20); };
const readScene = async (page) => { const marks = page.locator('.main20-read-mark'); for (let i = 0; i < await marks.count(); i += 1) { const mark = marks.nth(i); await mark.scrollIntoViewIfNeeded(); await page.waitForTimeout(25); if (await mark.isEnabled()) await mark.click(); } const layout = await page.evaluate(() => { const dialogue = document.querySelector('.dialogue-strip'); const paper = document.querySelector('#paper'); const columns = document.querySelector('#paperColumns'); const button = document.querySelector('#choiceArea button'); const stage = document.querySelector('.document-stage'); const desk = document.querySelector('.desk'); const dialogueRect = dialogue?.getBoundingClientRect(); const paperRect = paper?.getBoundingClientRect(); const buttonRect = button?.getBoundingClientRect(); const stageRect = stage?.getBoundingClientRect(); const deskRect = desk?.getBoundingClientRect(); return { viewport: { width: innerWidth, height: innerHeight }, desk: deskRect && { top: deskRect.top, bottom: deskRect.bottom, grid: getComputedStyle(desk).gridTemplateRows }, stage: stageRect && { top: stageRect.top, bottom: stageRect.bottom, paddingBottom: getComputedStyle(stage).paddingBottom }, dialogue: dialogueRect && { top: dialogueRect.top, bottom: dialogueRect.bottom, height: dialogueRect.height, overflowY: getComputedStyle(dialogue).overflowY }, paper: paperRect && { top: paperRect.top, bottom: paperRect.bottom, height: paperRect.height, overflowY: getComputedStyle(paper).overflowY }, columns: columns && { overflowY: getComputedStyle(columns).overflowY, clientHeight: columns.clientHeight, scrollHeight: columns.scrollHeight }, button: buttonRect && { top: buttonRect.top, bottom: buttonRect.bottom, height: buttonRect.height } }; }); if (!layout.dialogue || layout.dialogue.top < 0 || layout.dialogue.bottom > layout.viewport.height || layout.dialogue.height > 180 || !layout.paper || layout.paper.bottom > layout.dialogue.top || !['auto', 'scroll'].includes(layout.paper.overflowY) || !['auto', 'scroll'].includes(layout.columns?.overflowY) || !['auto', 'scroll'].includes(layout.dialogue.overflowY) || !layout.button || layout.button.top < layout.dialogue.top || layout.button.bottom > layout.dialogue.bottom) throw new Error(`reading page overlaps or hides the continuation UI at ${layout.viewport.width}x${layout.viewport.height}: ${JSON.stringify(layout)}`); await click(page, '자료 토론으로 간다'); };
const visibleText = (page) => page.locator('body').innerText();
const assertPlayerFacingChoices = async (page, phase) => {
  const text = (await page.locator('#choiceArea .main20-choice-hint').allInnerTexts()).join('\n');
  const internalCopy = /공개 기록을 읽는 사람과|공적 애도와|공식 성적·인사 기록|공식 자료철에 남음|공식 검토 메모|기록 없음|수첩은 본인만|위험을 감수|아니요 —|예 —|모임 참석자|문서가 사무실 밖으로 나감|문서가 사무실 안에 보관/;
  if (internalCopy.test(text)) throw new Error(`${phase} exposes internal record/audience/risk wording in normal UI: ${text}`);
  if ((await page.locator('#choiceArea .main20-choice-hint').count()) > 0 && !/남|알|퍼질|보관|기록|의심|위험|사람|동료|문서/.test(text)) throw new Error(`${phase} hides all immediate-consequence disclosure`);
  const paperText = await page.locator('#paperColumns').innerText();
  if (/(?:^|\s)(?:V\d{2,}-|EXT-|SRC-|CLAIM_)[A-Z0-9_-]+|verified source context|SECONDARY_HISTORICAL_SYNTHESIS|PRIMARY_PUBLICATION|DIRECT_SECONDARY/.test(paperText)) throw new Error(`${phase} exposes an internal source identifier or technical provenance label: ${paperText}`);
};

async function installAiRoute(page, plan) {
  await page.route('**/api/ai/turn', async route => {
    const request = route.request().postDataJSON();
    aiMockRequests.push({ routeId: plan.id, ...request, failed: Boolean(plan.failApi), clientFields: Object.keys(request).filter(key => !['sessionId', 'sceneId', 'turnIndex', 'playerInput'].includes(key)) });
    if (plan.failApi) return route.abort();
    const scene = lateGameData.scenes.find(item => item.id === request.sceneId);
    if (!scene) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"unsupported_scene"}' });
    let memory = aiMockMemories.get(request.sessionId);
    if (!memory && request.sceneId === 'CIRCLE_01') {
      memory = { id: `MOCK-${request.sessionId}`, subjectId: 'player', characterId: 'ekaterina', sceneId: 'CIRCLE_01', kind: 'STANCE', summaryKo: `플레이어는 “${String(request.playerInput).slice(0, 100)}”라고 말했다.`, salience: 'HIGH', createdTurn: request.turnIndex, source: 'AI_CLASSIFIED_PLAYER_STATEMENT' };
      aiMockMemories.set(request.sessionId, memory);
    }
    const speakerId = scene.cast.includes('ekaterina') ? 'ekaterina' : scene.cast.includes('pavel') ? 'pavel' : scene.cast[0];
    const textKo = memory && request.sceneId !== 'CIRCLE_01' ? '서클에서 원문부터 함께 읽자고 했던 말, 기억하고 있어요. 여기서도 그 문장부터 볼까요?' : request.sceneId === 'CIRCLE_01' ? '어느 문장을 두고 그렇게 생각했는지, 앞뒤를 같이 읽어 봐요.' : scene.id === 'SUPPER_01' ? '국이 식겠네. 오늘은 그 얘기보다 먼저 좀 먹자.' : scene.id === 'BOOKSHOP_01' ? '표지만 보고 고르지는 말아요. 어느 대목이 궁금한지 들어 볼게요.' : scene.id === 'READING_01' ? '그 문장만 떼어 읽지 말고 바로 앞 문장도 봐요.' : '답안은 정해진 기준으로 확인하겠습니다.';
    const turn = { schemaVersion: 'AI_SCENE_TURN_V1', sceneId: scene.id, turnType: 'DIALOGUE', beats: [{ type: 'DIALOGUE', speakerId, textKo, emotion: 'curious', expressionId: scene.allowedExpressionIds.find(id => id.startsWith(`${speakerId}_`)) || 'none', actionId: 'NONE' }], suggestedReplies: [{ id: 'R1', textKo: '그 문장 앞뒤를 더 읽어 볼게요.', tone: 'curious' }, { id: 'R2', textKo: '오늘은 이 이야기를 여기까지 하죠.', tone: 'reflective' }], semanticSignals: [], relationshipSignals: [], goalSignal: 'HOLD', memoryCandidates: !memory && request.sceneId === 'CIRCLE_01' ? [{ subjectId: 'player', characterId: 'ekaterina', sceneId: 'CIRCLE_01', kind: 'STANCE', summaryKo: String(request.playerInput).slice(0, 160), salience: 'HIGH' }] : [], historicalClaimIds: [], uiCue: { backgroundId: scene.backgroundId, cgId: scene.cgId || 'none', sfxId: 'none' } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fallback: false, memories: memory ? [memory] : [], summary: memory ? '플레이어는 원문부터 읽고 의견을 나누려 했다.' : '', turn }) });
  });
}

async function play(page, plan = {}) {
  const routeTranscript = { id: plan.id || 'route-one-bookshop-reading', mode: plan.failApi ? 'API failure with authored browser fallback' : 'schema-valid deterministic offline mock', branchVectorEndingTarget: plan.targetEndingId || null, choices: plan.choiceIds || null, activities: plan.activities || null, scenes: [] };
  await installAiRoute(page, plan);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20?.getState), { timeout: 12000 });
  await page.evaluate(() => history.replaceState(null, '', `${location.pathname}?main20=1`));
  await page.waitForFunction(() => Boolean(document.querySelector('#deskCanvas')?.dataset.threeLoaded), { timeout: 20000 });
  const threeDesk = await page.evaluate(() => { const canvas = document.querySelector('#deskCanvas'); const style = canvas && getComputedStyle(canvas); return { present: Boolean(canvas), display: style?.display, loaded: canvas?.dataset.threeLoaded, fallback: canvas?.dataset.fallback }; });
  if (!threeDesk.present || threeDesk.display === 'none' || threeDesk.loaded !== 'local' || threeDesk.fallback !== 'false') throw new Error(`3D desk was not restored on MAIN20 route: ${JSON.stringify(threeDesk)}`);
  if (!routeTranscript.choices) routeTranscript.choices = await page.evaluate(targetEndingId => {
    const graph = window.__main20.getBranchGraph();
    for (const { choiceIds } of window.__main20.enumerateRouteVectors()) {
      if (choiceIds[0] !== 'CIRCLE-ATTEND') continue;
      const history = choiceIds.map((action, index) => ({ sceneId: graph.hubs[index].id, action, choiceKind: 'ACTION', flags: [], endingAffinity: graph.choiceEndingAffinity[action] }));
      const result = window.__main20.resolveEndingDetailedFor({ history, relationships: { alexei: 0, ekaterina: 0, pavel: 0 }, flags: [], ideology: {}, ideologyEvidence: [], visibleCallbacks: [] });
      if (!targetEndingId || result.endingId === targetEndingId) return choiceIds;
    }
    return null;
  }, plan.targetEndingId || null);
  if (!routeTranscript.choices) throw new Error(`no route vector reaches ${plan.targetEndingId}`);
  routeTranscript.activities ||= ['BOOKSHOP_01', 'READING_01'];
  if ([1996, 1440, 390].includes(await page.evaluate(() => innerWidth))) { const width = await page.evaluate(() => innerWidth); fs.mkdirSync('artifacts/v53-desk', { recursive: true }); await page.screenshot({ path: `artifacts/v53-desk/desk-${width}.png` }); }
  const seen = [];
  const capturedScenes = new Set();
  const trace = [];
  let prologueText = '';
  let guard = 0;
  while (guard++ < 500) {
    const current = await state(page);
    trace.push({ phase: current?.phase, sceneIndex: current?.sceneIndex, sceneId: await page.evaluate(() => window.__main20.data.scenes[window.__main20.getState().sceneIndex]?.id), branchHubIndex: current?.branchHubIndex, routeChoices: current?.routeChoices?.slice() });
    if (!current) throw new Error('MAIN20 state missing');
    if (current.phase === 'ending') break;
    if (current.phase === 'ideology_prologue') prologueText += `\n${await visibleText(page)}`;
    if (current.phase === 'onboarding') {
      const next = page.getByRole('button', { name: '다음 말을 듣는다', exact: true });
      if (await next.count()) await next.click(); else await click(page, await page.evaluate(() => window.__main20.data.onboarding.response.text));
    } else if (current.phase === 'ideology_prologue' || current.phase === 'c07_ideology') {
      const next = page.getByRole('button', { name: '다음 말을 듣는다', exact: true });
      const read = page.getByRole('button', { name: '자료를 읽고 답한다', exact: true });
      const newspaperRead = page.locator('.main20-ideology-read');
      const cards = page.locator('.main20-choice-card');
      if (await next.count()) await next.click(); else if (await read.count()) await read.click(); else if (await cards.count()) await cards.first().click(); else if (await newspaperRead.count()) await newspaperRead.click(); else throw new Error(`${current.phase} dead end`);
      await page.waitForTimeout(20);
    } else if (current.phase === 'intro') {
      await advanceButton(page);
    } else if (current.phase === 'reading') {
      await readScene(page);
    } else if (current.phase === 'source_discussion') {
      await advanceButton(page);
    } else if (current.phase === 'decision' || current.phase === 'post_choice') {
      const cards = page.locator('.main20-choice-card');
      if (!(await cards.count())) throw new Error(`${current.phase} has no visible choice cards`);
      await assertPlayerFacingChoices(page, current.phase);
      for (let i = 0; i < await cards.count(); i += 1) {
        const copy = await cards.nth(i).innerText();
        const hint = (await cards.nth(i).locator('.main20-choice-hint').innerText()).trim();
        if (hint.length < 20) failures.push(`${current.phase}/${i}: immediate direction subcopy is too short: ${JSON.stringify(hint)} (${JSON.stringify(copy)})`);
      }
      await cards.first().click();
    } else if (current.phase === 'reaction' || current.phase === 'final_reaction') {
      await advanceButton(page);
    } else if (current.phase === 'branch_hub') {
      const newspaper = page.getByRole('button', { name: '신문에서 읽고 선택지를 연다', exact: true });
      if (await newspaper.count()) {
        const before = await page.locator('#paperColumns').innerText();
        if (!before.trim()) throw new Error(`branch ${current.branchHubIndex} newspaper is empty before reading`);
        await newspaper.click();
      } else {
        const cards = page.locator('#choiceArea .main20-choice-card');
        if (await cards.count() !== 3) throw new Error(`branch ${current.branchHubIndex} does not show its three options`);
        await assertPlayerFacingChoices(page, `branch ${current.branchHubIndex}`);
        const selectedChoice = routeTranscript.choices[current.branchHubIndex];
        const selectedIndex = await page.evaluate(({ hubIndex, choiceId }) => {
          const graph = window.__main20.getBranchGraph(); const hubId = graph.hubs[hubIndex]?.id;
          return graph.branches.filter(branch => branch.hubId === hubId).findIndex(branch => branch.choiceId === choiceId);
        }, { hubIndex: current.branchHubIndex, choiceId: selectedChoice });
        if (selectedIndex < 0) throw new Error(`branch ${current.branchHubIndex} has no ${selectedChoice} choice`);
        for (let i = 0; i < await cards.count(); i += 1) {
          const hint = (await cards.nth(i).locator('.main20-choice-hint').innerText()).trim();
          if (hint.length < 45 || !/알려집니다|읽을 수 있습니다|전달됩니다|본인만 볼/.test(hint) || !/기록|보관|간직/.test(hint)) failures.push(`branch ${current.branchHubIndex}/${i}: player-facing audience, record and consequence disclosure missing: ${hint}`);
        }
        await cards.nth(selectedIndex).click();
      }
    } else if (current.phase === 'branch_event') {
      await advanceButton(page);
    } else if (current.phase === 'branch_callback') {
      await advanceButton(page);
    } else if (current.phase === 'circle_learning') {
      await advanceButton(page);
    } else if (current.phase === 'late_game_scene') {
      const sceneId = current.lateGameSceneId;
      const scene = lateGameData.scenes.find(item => item.id === sceneId);
      if (!scene) throw new Error(`unknown free dialogue scene ${sceneId}`);
      if (!capturedScenes.has(sceneId) && plan.captureRoute) {
        fs.mkdirSync('artifacts/v32/screenshots/routes', { recursive: true });
        await page.screenshot({ path: `artifacts/v32/screenshots/routes/${plan.id}-${sceneId.toLowerCase()}.png` });
        capturedScenes.add(sceneId);
      }
      const wantedTurns = sceneId === 'CIRCLE_01' ? (plan.circleTurns ?? 1) : 1;
      if (wantedTurns > scene.turnLimit) throw new Error(`${sceneId} configured ${wantedTurns} turns over its limit ${scene.turnLimit}`);
      while ((await state(page)).lateGameSceneTurn < wantedTurns) {
        const before = await state(page);
        const turnNumber = before.lateGameSceneTurn;
        const lines = [
          '원문부터 함께 읽고 서로의 생각을 확인하고 싶어요.',
          '같은 문장도 읽는 사람에 따라 다르게 들리네요.',
          '그 해석이 어떤 기록에 기대는지 살펴볼까요?',
          '사람들이 실제로 감당할 위험도 같이 생각하고 싶어요.',
          '누가 이 말을 듣게 되는지도 중요하겠어요.',
          '그럼에도 서로의 말을 들어야 한다고 봐요.',
          '오늘은 판단을 서두르지 않고 더 읽어 보겠습니다.',
          '이 대목은 다음에 다시 이야기하고 싶어요.'
        ];
        const input = sceneId === 'CIRCLE_01' ? lines[turnNumber] : sceneId === 'SUPPER_01' ? '오늘은 일과 책 이야기를 잠시 접고, 다들 좀 먹어요.' : sceneId === 'BOOKSHOP_01' ? '이 책을 빌려 읽고 싶어요. 어느 대목부터 보면 좋을까요?' : sceneId === 'READING_01' ? '앞 문장과 이어서 읽고 인물의 처지를 생각해 볼게요.' : '답안의 근거가 된 문장을 다시 확인하겠습니다.';
        await page.locator('#lateGameReply').fill(input);
        await page.getByRole('button', { name: '말을 건넨다', exact: true }).click();
        await page.waitForFunction(expected => window.__main20?.getState().lateGameSceneTurn === expected, before.lateGameSceneTurn + 1, { timeout: 12000 });
        let after = await state(page);
        const exchange = after.lateGameTurns.slice(-2).map(item => ({ role: item.role, speakerId: item.speakerId, text: item.text, beats: item.beats }));
        routeTranscript.scenes.push({ sceneId, exchange, fallback: plan.failApi || false });
        if (plan.failApi && sceneId === 'CIRCLE_01' && turnNumber === 0) {
          const expected = lateGameData.fallbackBeats.find(beat => scene.fallbackBeatIds.includes(beat.id))?.textKo;
          if (!after.lateGameTurns.at(-1)?.text?.includes(expected)) throw new Error('API failure did not show the authored in-scene fallback dialogue');
        }
        if (plan.verifyMemory && sceneId === 'CIRCLE_01' && turnNumber === 0) {
          await click(page, '기록 저장');
          const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chancery-main20-v35')));
          if (!saved.lateGameMemories?.length || !saved.lateGameTurns?.length) throw new Error('circle memory/turn was missing from the saved game');
          await page.reload({ waitUntil: 'networkidle' });
          await page.waitForFunction(() => window.__main20?.getState().phase === 'late_game_scene' && window.__main20.getState().lateGameSceneTurn === 1);
          after = await state(page);
          if (!after.lateGameMemories?.length || !after.lateGameTurns?.length) throw new Error('circle memory/turn was not restored after reload');
        }
        if (plan.verifyMemory && sceneId !== 'CIRCLE_01' && turnNumber === 0) {
          const replyText = after.lateGameTurns.at(-1)?.text || '';
          if (!replyText.includes('서클에서 원문부터 함께 읽자고 했던 말')) throw new Error(`later scene did not recall the circle stance: ${replyText}`);
        }
      }
      const postTurns = await state(page);
      if (postTurns.phase === 'late_game_scene') {
        const latestScene = lateGameData.scenes.find(item => item.id === postTurns.lateGameSceneId);
        await click(page, postTurns.lateGameSceneTurn >= latestScene.turnLimit ? '다음 장소로 간다' : '이 장면을 마친다');
      }
    } else if (current.phase === 'late_game_activities') {
      const options = page.locator('.late-game-activity-choice:not(:disabled)');
      if (await options.count() !== 3) throw new Error('late-game activity selection must offer three activities');
      for (const activityId of routeTranscript.activities) {
        const index = activityIds.indexOf(activityId);
        if (index < 0) throw new Error(`unknown activity requested by route: ${activityId}`);
        await page.locator('.late-game-activity-choice').nth(index).click();
      }
      if ((await state(page)).phase !== 'late_game_scene') throw new Error('selecting two evening activities did not open the first activity scene');
    } else if (current.phase === 'exam_prep') {
      await click(page, '같은 다섯 문제에 답한다');
    } else if (current.phase === 'exam_questions') {
      await page.locator('.main20-exam-option').first().click();
      await page.locator('#choiceArea button').last().click();
    } else if (current.phase === 'exam_result') {
      await click(page, '시험 기록을 접는다');
    } else if (current.phase === 'legacy_recovery') {
      throw new Error(`legacy recovery reached during V42 route: ${JSON.stringify({ trace: trace.slice(-12), lastHistory: current.history.slice(-4) })}`);
    } else {
      throw new Error(`unknown phase ${current.phase}`);
    }
    const after = await state(page);
    if (after?.sceneIndex !== undefined && !seen.includes(after.sceneIndex)) seen.push(after.sceneIndex);
    const viewportCheck = await page.evaluate(() => { const rect = (selector) => { const node = document.querySelector(selector); if (!node) return null; const box = node.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right }; }; return { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth, desk: rect('.desk'), dialogue: rect('.dialogue-strip') }; });
    if (viewportCheck.pageWidth > viewportCheck.width || !viewportCheck.desk || viewportCheck.desk.top < 0 || viewportCheck.desk.bottom > viewportCheck.height + 1 || !viewportCheck.dialogue || viewportCheck.dialogue.top < 0 || viewportCheck.dialogue.bottom > viewportCheck.height + 1) throw new Error(`game UI overflows the viewport after ${after?.phase}: ${JSON.stringify(viewportCheck)}`);
  }
  const final = await state(page);
  if (final?.phase !== 'ending') failures.push(`route did not reach a real ending: ${final?.phase}`);
  routeTranscript.actualEndingId = final?.endingId || null;
  routeTranscript.finalPhase = final?.phase || null;
  routeTranscript.circleTurns = routeTranscript.scenes.filter(item => item.sceneId === 'CIRCLE_01').length;
  routeTranscript.memoryPersistedAcrossReload = Boolean(plan.verifyMemory && final?.lateGameMemories?.length);
  routeTranscript.requestCount = aiMockRequests.filter(item => item.routeId === routeTranscript.id).length;
  if (plan.expectedEndingId && routeTranscript.actualEndingId !== plan.expectedEndingId) {
    failures.push(`${routeTranscript.id}: expected actual ending ${plan.expectedEndingId}, got ${routeTranscript.actualEndingId}`);
  }
  fs.mkdirSync('artifacts/v32/transcripts/routes', { recursive: true });
  fs.writeFileSync(`artifacts/v32/transcripts/routes/${routeTranscript.id}.json`, JSON.stringify(routeTranscript, null, 2) + '\n');
  const branchEndingAudit = await page.evaluate(() => {
    const vectors = window.__main20.enumerateRouteVectors();
    const graph = window.__main20.getBranchGraph();
    const outcomes = vectors.map(({ choiceIds }) => {
      const history = choiceIds.map((choiceId, index) => ({ sceneId: graph.hubs[index].id, action: choiceId, choiceKind: 'ACTION', flags: [], endingAffinity: graph.choiceEndingAffinity[choiceId] }));
      const detail = window.__main20.resolveEndingDetailedFor({ history, relationships: { alexei: 0, ekaterina: 0, pavel: 0 }, flags: [], ideology: {}, ideologyEvidence: [], visibleCallbacks: [] });
      return { choiceIds, endingId: detail.endingId, unresolved: detail.unresolvedSemanticTie, scores: detail.scores };
    });
    return { vectorCount: outcomes.length, distinctEndingCount: new Set(outcomes.map(item => item.endingId).filter(Boolean)).size, unresolvedCount: outcomes.filter(item => item.unresolved).length, samples: outcomes.filter(item => item.endingId).slice(0, 12) };
  });
  if (branchEndingAudit.vectorCount !== 81 || branchEndingAudit.distinctEndingCount !== 5 || branchEndingAudit.unresolvedCount) failures.push(`branch-only choices do not materially reach all five endings: ${JSON.stringify(branchEndingAudit)}`);
  const endingLayout = await page.evaluate(() => { const overlay = document.querySelector('#endingOverlay'); const card = document.querySelector('#endingOverlay .ending-card'); const dialogue = document.querySelector('.dialogue-strip'); const rect = card.getBoundingClientRect(); const overlayStyle = getComputedStyle(overlay); return { visible: !overlay.hidden, overflowY: overlayStyle.overflowY, position: overlayStyle.position, zIndex: Number(overlayStyle.zIndex), backgroundColor: overlayStyle.backgroundColor, overlayRect: (() => { const box = overlay.getBoundingClientRect(); return { top: box.top, right: box.right, bottom: box.bottom, left: box.left }; })(), dialogueDisplay: getComputedStyle(dialogue).display, overlayHeight: overlay.clientHeight, overlayScrollHeight: overlay.scrollHeight, cardTop: rect.top, cardBottom: rect.bottom, viewportHeight: innerHeight, viewportWidth: innerWidth, restartVisible: document.querySelector('#endingOverlay #restart')?.getBoundingClientRect().height > 0 }; });
  const rgba = endingLayout.backgroundColor.match(/rgba?\([^)]*[,\s/]\s*([\d.]+)\s*\)$/);
  const overlayAlpha = endingLayout.backgroundColor.startsWith('rgba') && rgba ? Number(rgba[1]) : 1;
  if (endingLayout.dialogueDisplay !== 'none') throw new Error(`ending still shows dialogue rail: ${JSON.stringify(endingLayout)}`);
  if (endingLayout.position !== 'fixed' || endingLayout.zIndex < 100 || endingLayout.overlayRect.top > 0 || endingLayout.overlayRect.left > 0 || endingLayout.overlayRect.right < endingLayout.viewportWidth || endingLayout.overlayRect.bottom < endingLayout.viewportHeight || overlayAlpha < 1) throw new Error(`ending is not a full-screen opaque focus view: ${JSON.stringify(endingLayout)}`);
  if (!endingLayout.visible || !endingLayout.restartVisible || (endingLayout.cardBottom > endingLayout.viewportHeight && endingLayout.overflowY !== 'auto' && endingLayout.overflowY !== 'scroll')) throw new Error(`ending content is clipped or has no reachable restart control: ${JSON.stringify(endingLayout)}`);
  if ([1440, 390].includes(endingLayout.viewportWidth)) { fs.mkdirSync('artifacts/v46-ending', { recursive: true }); await page.screenshot({ path: `artifacts/v46-ending/ending-${endingLayout.viewportWidth}.png` }); }
  const endingActions = await page.locator('#endingActions').innerText();
  if (/MAIN\d+_|V42-|E07_|ACTION_/.test(endingActions)) throw new Error(`ending recap exposes internal action IDs: ${endingActions}`);
  const modalSemantics = await page.locator('#endingOverlay').evaluate((node) => ({ role: node.getAttribute('role'), modal: node.getAttribute('aria-modal'), appInert: document.querySelector('main')?.inert }));
  if (modalSemantics.role !== 'dialog' || modalSemantics.modal !== 'true' || !modalSemantics.appInert) throw new Error(`ending is not isolated as an accessible modal: ${JSON.stringify(modalSemantics)}`);
  await page.getByRole('button', { name: '내 선택 다시 보기', exact: true }).click();
  await page.locator('#endingOverlay .ending-evidence summary').click();
  if (!(await page.locator('#endingOverlay .ending-evidence').evaluate((node) => node.open))) throw new Error('ending evidence disclosure did not open');
  const replay = page.getByRole('button', { name: '처음부터 다시 읽는다', exact: true });
  if (!(await replay.count())) throw new Error('ending has no playable restart action');
  await replay.click();
  if ((await state(page))?.phase !== 'onboarding') throw new Error('ending restart did not return to onboarding');
  if (await page.locator('main').evaluate((node) => node.inert)) throw new Error('ending restart left the main game inert');
  return { final, text: await visibleText(page), prologueText, seen, guard, branchEndingAudit, routeTranscript };
}

const report = { status: false, viewports: {}, routes: {} };
const viewports = [{ name: 'screenshot-size', width: 1996, height: 1248 }, { name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }, { name: 'compact-mobile', width: 360, height: 640 }];
for (const viewport of process.env.V42_QUICK === '1' ? [viewports[0]] : viewports) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    const result = await play(page, { id: `viewport-${viewport.name}`, targetEndingId: 'UVAROV', activities: ['BOOKSHOP_01', 'READING_01'], circleTurns: viewport.name === 'desktop' ? 7 : 1, verifyMemory: viewport.name === 'desktop', captureRoute: true });
    const bodyWidth = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth, walk: document.querySelector('#walkBtn')?.hidden }));
    if (bodyWidth.body > bodyWidth.viewport + 1) failures.push(`${viewport.name}: horizontal overflow ${bodyWidth.body}/${bodyWidth.viewport}`);
    if (bodyWidth.walk === false) failures.push(`${viewport.name}: legacy walk button visible`);
    for (const phrase of ['표트르 대제 이후', '관등표', '10등관', '정교회', '전제정', '민족성', '차다예프', '유럽']) if (!result.prologueText.includes(phrase)) failures.push(`${viewport.name}: missing prologue comprehension phrase ${phrase}`);
    report.viewports[viewport.name] = { phase: result.final.phase, endingId: result.final.endingId, sceneIndex: result.final.sceneIndex, guard: result.guard, bodyWidth };
    report.routes[result.routeTranscript.id] = result.routeTranscript;
  } catch (error) { failures.push(`${viewport.name}: ${error.message}`); }
  await page.close();
}
if (process.env.V42_QUICK !== '1') {
  const routes = [
    { id: 'route-two-supper-bookshop', targetEndingId: 'DOSTOEVSKY_PETRASHEVSKY', activities: ['SUPPER_01', 'BOOKSHOP_01'], circleTurns: 2, verifyMemory: true, captureRoute: true },
    { id: 'route-three-api-fallback', targetEndingId: 'UVAROV', activities: ['BOOKSHOP_01', 'READING_01'], circleTurns: 1, failApi: true, captureRoute: true }
  ];
  for (const plan of routes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      const result = await play(page, plan);
      report.routes[result.routeTranscript.id] = result.routeTranscript;
    } catch (error) { failures.push(`${plan.id}: ${error.message}`); }
    await page.close();
  }
  const primary = report.routes['viewport-desktop'];
  const alternate = report.routes['route-two-supper-bookshop'];
  const fallback = report.routes['route-three-api-fallback'];
  if (!primary || primary.finalPhase !== 'ending' || primary.circleTurns < 7 || !primary.memoryPersistedAcrossReload) failures.push('primary route did not prove seven Circle turns, memory save/reload, and ending');
  if (!alternate || alternate.finalPhase !== 'ending' || !alternate.memoryPersistedAcrossReload) failures.push('alternate Supper/Bookshop route did not prove memory restoration and ending');
  if (primary?.actualEndingId && alternate?.actualEndingId && primary.actualEndingId === alternate.actualEndingId) failures.push(`alternate activity path did not reach a different actual ending: ${primary.actualEndingId}`);
  if (!fallback || fallback.finalPhase !== 'ending' || !fallback.requestCount || !fallback.scenes.length || fallback.scenes.some(scene => !scene.fallback)) failures.push('provider failure route did not prove attempted requests, authored fallback dialogue, and ending');
}
report.mockRequestAudit = { count: aiMockRequests.length, unexpectedClientFields: aiMockRequests.filter(request => request.clientFields.length).map(request => ({ routeId: request.routeId, fields: request.clientFields })) };
if (report.mockRequestAudit.unexpectedClientFields.length) failures.push(`browser client supplied forbidden AI context fields: ${JSON.stringify(report.mockRequestAudit.unexpectedClientFields)}`);
await browser.close();
report.status = failures.length === 0;
report.failures = failures;
fs.mkdirSync('artifacts/v42-browser', { recursive: true });
fs.writeFileSync('artifacts/v42-browser/report.json', JSON.stringify(report, null, 2) + '\n');
const summary = { status: report.status, failures, viewports: report.viewports, routes: Object.fromEntries(Object.entries(report.routes).map(([id, route]) => [id, { phase: route.finalPhase, endingId: route.actualEndingId, circleTurns: route.circleTurns, memoryPersistedAcrossReload: route.memoryPersistedAcrossReload, requestCount: route.requestCount, mode: route.mode }])), mockRequestAudit: report.mockRequestAudit };
process.stdout.write(JSON.stringify(summary, null, 2) + '\n', () => process.exit(report.status ? 0 : 1));
