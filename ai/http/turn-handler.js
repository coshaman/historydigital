const { validateTurn } = require('../validate-turn.js');
const { composeContext } = require('../context-composer.js');
const { addMemoryCandidates, restoreMemories } = require('../memory-store.js');
const scenarios = require('../../narrative/LATE_GAME_SCENARIOS.json');
const characterCards = require('../../narrative/LATE_GAME_CHARACTER_CARDS.json');
const loreCards = require('../../narrative/AI_LORE_CARDS.json');
const coreRules = require('../prompts/core-rules.js');
const characterRules = require('../prompts/character-context.js');
const sceneRules = require('../prompts/scene-context.js');
const historyRules = require('../prompts/history-context.js');
const memoryRules = require('../prompts/memory-context.js');

const sceneById = new Map(scenarios.scenes.map(scene => [scene.id, scene]));
const claimById = new Map(loreCards.claims.map(claim => [claim.id, claim]));
const inputKeys = new Set(['sessionId', 'sceneId', 'turnIndex', 'playerInput']);
const sessionTurns = new Map();
const sessionContexts = new Map();

function response(status, body, origin, allowed) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'vary': 'Origin' };
  if (origin && allowed.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'POST, OPTIONS';
    headers['access-control-allow-headers'] = 'content-type';
  }
  return { status, headers, body };
}

function fallbackTurn(scene) {
  const fallback = scenarios.fallbackBeats.find(beat => scene.fallbackBeatIds.includes(beat.id));
  const speaker = scene.cast.includes(fallback.speakerId) ? fallback.speakerId : scene.cast[0];
  const expression = scene.allowedExpressionIds.find(id => id.startsWith(`${speaker}_`)) || (scene.allowedExpressionIds.includes('none') ? 'none' : scene.allowedExpressionIds[0]);
  return {
    schemaVersion: 'AI_SCENE_TURN_V1', sceneId: scene.id, turnType: 'DIALOGUE',
    beats: [{ type: 'DIALOGUE', speakerId: speaker, textKo: fallback.textKo, emotion: 'neutral', expressionId: expression, actionId: 'NONE' }],
    suggestedReplies: [{ id: 'R1', textKo: '그 말의 근거가 된 문장을 같이 볼까요?', tone: 'curious' }, { id: 'R2', textKo: '오늘은 여기까지 듣고 생각해 볼게요.', tone: 'reflective' }],
    semanticSignals: [], relationshipSignals: [], goalSignal: 'HOLD', memoryCandidates: [], historicalClaimIds: [],
    uiCue: { backgroundId: scene.backgroundId, cgId: scene.cgId, sfxId: 'none' },
  };
}

function validateInput(body, maxBytes) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'request body must be an object';
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > maxBytes) return 'request too large';
  if (Object.keys(body).some(key => !inputKeys.has(key))) return 'unsupported request field';
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(body.sessionId ?? '')) return 'invalid session';
  if (typeof body.sceneId !== 'string' || !sceneById.has(body.sceneId)) return 'unsupported scene';
  if (!Number.isInteger(body.turnIndex) || body.turnIndex < 1 || body.turnIndex > 30) return 'invalid turn index';
  if (typeof body.playerInput !== 'string' || body.playerInput.length > 800 || !body.playerInput.trim()) return 'invalid player input';
  return null;
}

async function handleTurn(request, { provider, limiter, config = {} } = {}) {
  const origin = request.origin ?? '';
  const allowed = config.allowedOrigins ?? [];
  if (request.method === 'OPTIONS') return response(204, {}, origin, allowed);
  if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' }, origin, allowed);
  if (!allowed.includes(origin)) return response(403, { error: 'origin_not_allowed' }, origin, allowed);
  const body = request.body;
  const issue = validateInput(body, config.maxRequestBytes ?? 8192);
  if (issue === 'request too large') return response(413, { error: 'request_too_large' }, origin, allowed);
  if (issue) return response(400, { error: 'invalid_request', detail: issue }, origin, allowed);
  const scene = sceneById.get(body.sceneId);
  if (body.turnIndex > scene.turnLimit) return response(400, { error: 'turn_limit' }, origin, allowed);
  const cap = config.maxTurnsPerSession ?? 80;
  const savedContext = config.sessionStore ? await config.sessionStore.get() : (sessionContexts.get(body.sessionId) ?? { memories: [], summary: '', recentTurns: [], usedTurns: 0 });
  const current = Number(savedContext.usedTurns ?? sessionTurns.get(body.sessionId) ?? 0);
  if (current >= cap || (limiter && !(await limiter.consume(body.sessionId)))) return response(429, { error: 'turn_limit_reached' }, origin, allowed);
  sessionTurns.set(body.sessionId, current + 1);
  const memoriesBeforeTurn = restoreMemories(savedContext.memories, { scenes: scenarios.scenes });
  const recentBeforeTurn = savedContext.recentTurns.slice(-10);
  const summaryBeforeTurn = savedContext.summary;

  let result;
  try {
    if (!provider || typeof provider.generate !== 'function') throw new Error('provider unavailable');
    const characterId = scene.cast.find(id => ['alexei', 'ekaterina', 'pavel'].includes(id));
    const context = composeContext({ scene, characterId, characterCards, state: body.state, claims: claimById, memories: memoriesBeforeTurn, summary: summaryBeforeTurn, recentTurns: recentBeforeTurn, playerInput: body.playerInput });
    const format = require('../validate-turn.js').responseFormatForScene(scene);
    let turn;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        turn = await provider.generate({ input: context, instructions: [coreRules, characterRules, sceneRules, historyRules, memoryRules].join('\n\n'), format, model: config.dialogueModel ?? 'gpt-6.1-terra', maxOutputTokens: config.maxOutputTokens ?? 900 });
        const checked = validateTurn(turn, scene);
        if (!checked.ok) throw new Error('invalid structured output');
        break;
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
    const memories = addMemoryCandidates(memoriesBeforeTurn, turn.memoryCandidates, { scene, scenes: scenarios.scenes, turnIndex: body.turnIndex, playerInput: body.playerInput });
    let summary = summaryBeforeTurn;
    if (typeof provider.summarize === 'function' && (body.turnIndex % 3 === 0 || body.turnIndex >= scene.turnLimit)) {
      try {
        const candidate = await provider.summarize({ input: { sceneId: scene.id, previousSummary: summary, recentTurns: [...recentBeforeTurn.slice(-8), { role: 'user', text: body.playerInput }, ...turn.beats.map(beat => ({ role: 'assistant', speakerId: beat.speakerId, text: beat.textKo }))].map(entry => ({ role: entry.role, speakerId: entry.speakerId, text: String(entry.text ?? '').slice(0, 500) })) }, model: config.memoryModel ?? 'gpt-6-luna' });
        if (candidate?.schemaVersion === 'AI_SCENE_MEMORY_SUMMARY_V1' && typeof candidate.summaryKo === 'string' && candidate.summaryKo.trim() && candidate.summaryKo.length <= 900) summary = candidate.summaryKo.trim();
      } catch { /* dialogue remains playable; retain the previous bounded summary */ }
    }
    const recentTurns = [...recentBeforeTurn, { role: 'user', text: body.playerInput }, ...turn.beats.map(beat => ({ role: 'assistant', speakerId: beat.speakerId, text: beat.textKo }))].slice(-10);
    const nextContext = { memories, summary, recentTurns, usedTurns: current + 1 };
    if (config.sessionStore) await config.sessionStore.put(nextContext);
    else sessionContexts.set(body.sessionId, nextContext);
    result = { turn, memories, summary, fallback: false };
  } catch {
    const turn = fallbackTurn(scene);
    const recentTurns = [...recentBeforeTurn, { role: 'user', text: body.playerInput }, ...turn.beats.map(beat => ({ role: 'assistant', speakerId: beat.speakerId, text: beat.textKo }))].slice(-10);
    const nextContext = { memories: memoriesBeforeTurn, summary: summaryBeforeTurn, recentTurns, usedTurns: current + 1 };
    if (config.sessionStore) await config.sessionStore.put(nextContext);
    else sessionContexts.set(body.sessionId, nextContext);
    result = { turn, memories: memoriesBeforeTurn, summary: summaryBeforeTurn, fallback: true };
  }
  if (sessionContexts.size > 10000) sessionContexts.delete(sessionContexts.keys().next().value);
  return response(200, result, origin, allowed);
}

exports.handleTurn = handleTurn;
exports.fallbackTurn = fallbackTurn;
