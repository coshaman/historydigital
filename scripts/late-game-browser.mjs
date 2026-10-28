import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const base = 'http://v32.test';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const scenarios = JSON.parse(await readFile(join(root, 'narrative/LATE_GAME_SCENARIOS.json'), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
await mkdir('artifacts/v32/screenshots', { recursive: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
    const page = await browser.newPage({ viewport }); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/ai/turn') {
        const request = JSON.parse(route.request().postData() || '{}'); const scene = scenarios.scenes.find(item => item.id === request.sceneId);
        const fallback = scenarios.fallbackBeats.find(item => scene?.fallbackBeatIds.includes(item.id));
        if (!scene || !fallback) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"unsupported_scene"}' });
        const speakerId = scene.cast.includes(fallback.speakerId) ? fallback.speakerId : scene.cast[0];
        const expressionId = scene.allowedExpressionIds.find(id => id.startsWith(`${speakerId}_`)) || (scene.allowedExpressionIds.includes('none') ? 'none' : scene.allowedExpressionIds[0]);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fallback: true, memories: [], turn: { schemaVersion: 'AI_SCENE_TURN_V1', sceneId: scene.id, turnType: 'DIALOGUE', beats: [{ type: 'DIALOGUE', speakerId, textKo: fallback.textKo, emotion: 'neutral', expressionId, actionId: 'NONE' }], suggestedReplies: [{ id: 'R1', textKo: '그 말의 근거가 된 문장을 같이 볼까요?', tone: 'curious' }, { id: 'R2', textKo: '오늘은 여기까지 듣고 생각해 볼게요.', tone: 'reflective' }], semanticSignals: [], relationshipSignals: [], goalSignal: 'HOLD', memoryCandidates: [], historicalClaimIds: [], uiCue: { backgroundId: scene.backgroundId, cgId: scene.cgId, sfxId: 'none' } } }) });
      }
      if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/three@0.180.0/')) {
        const local = join(root, 'node_modules/three', url.pathname.slice('/npm/three@0.180.0/'.length));
        try { return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: await readFile(local) }); } catch { return route.fulfill({ status: 404, body: '' }); }
      }
      if (url.hostname !== 'v32.test') return route.abort();
      const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const target = resolve(root, `.${pathname}`);
      if (target !== root && !target.startsWith(root + sep)) return route.fulfill({ status: 403, body: '' });
      try { return route.fulfill({ status: 200, contentType: mime[extname(target)] || 'text/plain', body: await readFile(target) }); }
      catch { return route.fulfill({ status: 404, contentType: 'text/plain', body: '' }); }
    });
    await page.goto(`${base}/?main20=1&v42fresh=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__main20?.getState), { timeout: 15000 });
    await page.screenshot({ path: `artifacts/v32/screenshots/desk-${viewport.width}.png`, fullPage: true });
    await page.evaluate(() => { const state=window.__main20.getState(); state.phase='ideology_prologue'; state.ideologyBeatIndex=0; state.ideologyLineIndex=0; localStorage.setItem('chancery-main20-v35',JSON.stringify(state)); history.replaceState({},'','/'); });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__main20?.getState().phase === 'ideology_prologue');
    await page.screenshot({ path: `artifacts/v32/screenshots/ideology-${viewport.width}.png`, fullPage: true });
    await page.evaluate(() => {
      const state = window.__main20.getState();
      const graph = window.__main20.getBranchGraph();
      const first = window.Main20BranchGraph.resolveBranchEvent(graph, 'H1-CIRCLE', 'CIRCLE-ATTEND', { routeChoices: [], branchState: {}, historicalAnchors: graph.anchors });
      Object.assign(state, { phase: 'late_game_scene', branchHubIndex: 0, routeChoices: first.nextState.routeChoices, branchState: first.nextState.branchState, activeBranchEventId: first.eventId, activeBranchLineIndex: 0, activeBranchReadHub: null, lateGameSceneId: 'CIRCLE_01', lateGameSceneTurn: 0, lateGameTurns: [], lateGameMemories: [], lateGameActivities: [], lateGamePendingActivities: [], endingId: null, endingResolution: null });
      localStorage.setItem('chancery-main20-v35', JSON.stringify(state));
      history.replaceState({}, '', '/');
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__main20?.getState().phase === 'late_game_scene');
    assert.equal(await page.locator('#lateGameReply').count(), 1, 'free dialogue input is visible');
    const stage = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyClasses: document.body.className, panel: (() => { const e = document.querySelector('.dialogue-strip'); const r=e.getBoundingClientRect();return { top:r.top,bottom:r.bottom,height:r.height,client:e.clientHeight,scroll:e.scrollHeight,overflow:getComputedStyle(e).overflowY }; })(), choices: (()=>{const r=document.querySelector('#choiceArea').getBoundingClientRect();return {top:r.top,bottom:r.bottom,display:getComputedStyle(document.querySelector('#choiceArea')).display}})(), response:(()=>{const r=document.querySelector('#responseArea').getBoundingClientRect();return {top:r.top,bottom:r.bottom,hidden:document.querySelector('#responseArea').hidden}})(), rails:[...document.querySelectorAll('.left-rail,.right-rail,.incoming-slip')].map(e=>[e.className,getComputedStyle(e).display]), props:[...document.querySelectorAll('.physical-tools,.petersburg-window')].map(e=>[e.className,getComputedStyle(e).display]),buttonCount: document.querySelectorAll('#choiceArea button').length, imageLoaded: document.querySelector('.late-game-event-still')?.complete && document.querySelector('.late-game-event-still')?.naturalWidth > 0 }));
    assert.ok(stage.documentWidth <= stage.viewportWidth + 1, `horizontal overflow ${JSON.stringify(stage)}`);
    assert.ok(stage.buttonCount >= 3, `reply/continue controls missing ${JSON.stringify(stage)}`);
    assert.ok(stage.imageLoaded, 'circle event still failed to load');
    if (viewport.width <= 700) assert.ok(stage.props.every(([, display]) => display === 'none'), `mobile paper overlay props should be hidden: ${JSON.stringify(stage.props)}`);
    if (viewport.width === 390) console.log(`MOBILE_LAYOUT ${JSON.stringify(stage)}`);
    if (viewport.width === 1440 || viewport.width === 390) await page.screenshot({ path: `artifacts/v32/screenshots/circle-${viewport.width}.png`, fullPage: true });

    await page.locator('#lateGameReply').fill('원문을 읽고 나서 제 생각을 말하고 싶어요.');
    await page.getByRole('button', { name: '말을 건넨다', exact: true }).click();
    await page.waitForFunction(() => window.__main20.getState().lateGameSceneTurn === 1, { timeout: 10000 });
    assert.ok(await page.locator('.late-game-transcript').innerText());
    await page.getByRole('button', { name: '기록 저장', exact: true }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chancery-main20-v35')));
    assert.equal(saved.lateGameSceneTurn, 1, 'late-game turn is saved');
    if (viewport.width === 1440) {
      await mkdir('artifacts/v32/transcripts', { recursive: true });
      await writeFile('artifacts/v32/transcripts/offline-fallback-session.json', `${JSON.stringify({ provider: 'schema-valid browser mock; no live OpenAI request', sessionId: saved.lateGameSessionId, sceneId: saved.lateGameSceneId, turns: saved.lateGameTurns, memories: saved.lateGameMemories, summary: saved.lateGameSummary }, null, 2)}\n`);
    }
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__main20.getState().phase === 'late_game_scene' && window.__main20.getState().lateGameSceneTurn === 1);
    await page.getByRole('button', { name: '이 장면을 마친다', exact: true }).click();
    await page.waitForFunction(() => window.__main20.getState().phase === 'late_game_activities');
    const choices = page.locator('.late-game-activity-choice'); assert.equal(await choices.count(), 3);
    await choices.nth(0).click(); await choices.nth(1).click();
    await page.waitForFunction(() => window.__main20.getState().phase === 'late_game_scene' && window.__main20.getState().lateGameSceneId !== 'CIRCLE_01');
    assert.equal(await page.locator('#lateGameReply').count(), 1, 'selected activity is playable');
    const activityScene = await page.evaluate(() => ({ title: document.querySelector('#paperTitle').textContent, overflow: document.documentElement.scrollWidth > innerWidth, sourceScroll: getComputedStyle(document.querySelector('#paperColumns')).overflowY }));
    assert.equal(activityScene.overflow, false, `activity UI overflow ${JSON.stringify(activityScene)}`);
    if (viewport.width === 1440 || viewport.width === 390) await page.screenshot({ path: `artifacts/v32/screenshots/activity-${viewport.width}.png`, fullPage: true });
    await page.getByRole('button', { name: '이 장면을 마친다', exact: true }).click();
    await page.waitForFunction(() => window.__main20.getState().lateGameSceneId !== 'CIRCLE_01' && window.__main20.getState().lateGameSceneTurn === 0);
    await page.getByRole('button', { name: '이 장면을 마친다', exact: true }).click();
    await page.waitForFunction(() => window.__main20.getState().phase === 'branch_event');
    for (let i = 0; i < 12 && (await page.evaluate(() => window.__main20.getState().phase)) === 'branch_event'; i += 1) {
      const next = page.locator('#choiceArea button').first(); await next.click();
    }
    await page.waitForFunction(() => window.__main20.getState().phase === 'branch_callback');
    await page.locator('#choiceArea button').first().click();
    await page.waitForFunction(() => window.__main20.getState().phase === 'branch_hub' && window.__main20.getState().branchHubIndex === 1);
    assert.equal(await page.getByRole('button', { name: '신문에서 읽고 선택지를 연다', exact: true }).count(), 1, 'H2 newspaper unlock exists');
    for (const scene of scenarios.scenes) {
      await page.evaluate((sceneId) => { const storageKey = 'chancery-main20-v35'; const state = JSON.parse(localStorage.getItem(storageKey)); Object.assign(state, { phase: 'late_game_scene', lateGameSceneId: sceneId, lateGameSceneTurn: 0, lateGameTurns: [], lateGameSummary: '', lateGamePendingActivities: [] }); localStorage.setItem(storageKey, JSON.stringify(state)); }, scene.id);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction((sceneId) => window.__main20?.getState().phase === 'late_game_scene' && window.__main20.getState().lateGameSceneId === sceneId, scene.id);
      assert.equal((await page.locator('#paperTitle').innerText()).trim(), scene.locationKo, `${scene.id} title renders`);
      assert.equal(await page.locator('#lateGameReply').count(), 1, `${scene.id} has a usable reply input`);
      assert.ok(await page.locator('#choiceArea button').count() >= 3, `${scene.id} has selectable replies and a continue control`);
      if (scene.cgId && scene.id !== 'EXAM_01') assert.ok(await page.locator('.late-game-event-still').count(), `${scene.id} event still renders`);
      await page.screenshot({ path: `artifacts/v32/screenshots/${scene.id.toLowerCase()}-${viewport.width}.png`, fullPage: true });
    }
    await page.evaluate(() => { const storageKey='chancery-main20-v35'; const state=JSON.parse(localStorage.getItem(storageKey)); state.phase='exam_prep'; state.examQuestionIndex=0; state.examAnswers={}; localStorage.setItem(storageKey,JSON.stringify(state)); });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__main20?.getState().phase === 'exam_prep');
    await page.getByRole('button', { name: '같은 다섯 문제에 답한다', exact: true }).click();
    await page.waitForFunction(() => window.__main20.getState().phase === 'exam_questions');
    await page.screenshot({ path: `artifacts/v32/screenshots/exam-question-${viewport.width}.png`, fullPage: true });
    for (let index = 0; index < 5; index += 1) {
      await page.locator('.main20-exam-option').first().click();
      await page.locator('#choiceArea button').last().click();
      if (index < 4) await page.waitForFunction((expected) => window.__main20.getState().examQuestionIndex === expected, index + 1);
    }
    const examProgress = await page.evaluate(() => ({ phase: window.__main20.getState().phase, index: window.__main20.getState().examQuestionIndex, answers: Object.keys(window.__main20.getState().examAnswers || {}).length }));
    assert.equal(examProgress.phase, 'exam_result', `exam answer submission did not finish: ${JSON.stringify(examProgress)}`);
    await page.screenshot({ path: `artifacts/v32/screenshots/exam-result-${viewport.width}.png`, fullPage: true });
    await page.getByRole('button', { name: '시험 기록을 접는다', exact: true }).click();
    await page.waitForFunction(() => window.__main20.getState().phase === 'late_game_scene' && window.__main20.getState().lateGameSceneId === 'EXAM_01');
    await page.screenshot({ path: `artifacts/v32/screenshots/exam-reaction-${viewport.width}.png`, fullPage: true });
    await page.getByRole('button', { name: '이 장면을 마친다', exact: true }).click();
    await page.waitForFunction(() => window.__main20.getState().phase === 'branch_event');
    await page.evaluate(() => {
      const storageKey='chancery-main20-v35'; const state=JSON.parse(localStorage.getItem(storageKey)); const data=window.__main20.data;
      const ending=data.endings.find(item=>item.id==='UVAROV'); const profile=data.endingIdeologyProfiles.UVAROV; const rule={...ending.rule,...profile};
      const required=[...new Set([...(rule.requiredActions||rule.actionsAll||[]),...(rule.actionGate?.all||[])])]; const history=required.map((action,index)=>({sceneId:['C07','E02','E04','E07','V42-PROLOGUE-CHAADAEV'][index%5],kind:'post_read_choice',choiceKind:'ACTION',action,endingAffinity:{UVAROV:2}}));
      while(history.length<Math.max(5,rule.minScenes||0))history.push({sceneId:'E07',kind:'post_read_choice',choiceKind:'ACTION',action:`review_support_${history.length}`,endingAffinity:{UVAROV:1}});
      const ideology=Object.fromEntries(data.ideologyDimensions.map(key=>[key,0])); for(const [key,amount] of Object.entries(profile.ideologyGate)) ideology[key]=amount;
      const ideologyEvidence=profile.beliefLedgerLabels.map((statement,index)=>({statement,choiceId:`V32-${index}`,callbackKey:`V32_${index}`,sceneId:['V42-PROLOGUE-CHAADAEV','C07','E07'][index]}));
      const source={history,flags:[...(rule.allFlags||[])],relationships:{alexei:8,ekaterina:8,pavel:8,...(rule.relationshipGate||{})},ideology,ideologyEvidence,beliefs:ideologyEvidence,actions:history.map(item=>item.action),visibleCallbacks:ideologyEvidence.map(item=>item.callbackKey)};
      Object.assign(state,source); state.phase='ending'; state.endingResolution=window.__main20.resolveEndingDetailedFor(source); state.endingId=state.endingResolution.endingId; localStorage.setItem(storageKey,JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__main20?.getState().phase === 'ending');
    assert.equal(await page.locator('.dialogue-strip').evaluate(element => getComputedStyle(element).display), 'none', 'ending hides dialogue UI');
    assert.doesNotMatch(await page.locator('#endingActions').innerText(), /[A-Z][A-Z0-9_]{3,}/, 'ending recap does not expose internal action IDs');
    await page.screenshot({ path: `artifacts/v32/screenshots/ending-${viewport.width}.png`, fullPage: true });
    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
    console.log(`PASS late game ${viewport.width}x${viewport.height}: circle reply, save, two-of-three activity selection, responsive bounds`);
    await page.close();
  }
} finally { await browser.close(); }

