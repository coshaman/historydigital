'use strict';

const { createRpgAiService } = require('../session-runtime.cjs');
const { createResponsesProvider } = require('../openai-provider.cjs');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TURNS = 80;
const SESSION_MINUTE_TURNS = 12;
const GLOBAL_MINUTE_TURNS = 300;
const GLOBAL_DAILY_TURNS = 1200;
const GLOBAL_DAILY_STARTS = 1000;

function json(body, status = 200) { return Response.json(body, { status, headers: { 'cache-control': 'no-store' } }); }
function origins(value) { return String(value ?? '').split(',').map(value => value.trim()).filter(Boolean); }

function makeSessionStore(namespace) {
  const call = async (id, operation, data = {}) => {
    const stub = namespace.get(namespace.idFromName(id));
    const response = await stub.fetch(`https://rpg-session/${operation}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    return response.status === 204 ? null : response.json();
  };
  return {
    create: (id, context) => call(id, 'create', context),
    claim: (id, requestId, inputHash, now) => call(id, 'claim', { requestId, inputHash, now }),
    complete: (id, requestId, responseBody, recentTurns, now) => call(id, 'complete', { requestId, responseBody, recentTurns, now }),
    release: (id, requestId, now) => call(id, 'release', { requestId, now }),
  };
}
function makeBudget(namespace) {
  const stub = namespace.get(namespace.idFromName('v33-rpg-global'));
  const consume = async kind => (await stub.fetch(`https://rpg-budget/${kind}`, { method: 'POST' })).status === 204;
  return { consume: () => consume('consume-turn'), consumeStart: () => consume('consume-start') };
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get('origin') ?? '', allow = origins(env.RPG_ALLOWED_ORIGINS);
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'vary': 'Origin' };
    if (!allow.includes(origin)) return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403, headers });
    headers['access-control-allow-origin'] = origin;
    if (url.pathname === '/api/rpg/health' && request.method === 'GET') return new Response(JSON.stringify({ status: 'ok', ai: env.OPENAI_API_KEY ? 'configured' : 'BLOCKED_NO_KEY', sessionStore: env.RPG_SESSIONS && env.RPG_BUDGETS ? 'durable' : 'unavailable', sessionSigning: Buffer.byteLength(env.RPG_SESSION_SIGNING_KEY || '', 'utf8') >= 32 ? 'configured' : 'unavailable' }), { headers });
    if (request.method === 'OPTIONS') { headers['access-control-allow-methods'] = 'POST, OPTIONS'; headers['access-control-allow-headers'] = 'content-type'; return new Response(null, { status: 204, headers }); }
    if (!['/api/rpg/session/start','/api/rpg/dialogue'].includes(url.pathname)) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });
    if (!env.RPG_SESSION_SIGNING_KEY || Buffer.byteLength(env.RPG_SESSION_SIGNING_KEY, 'utf8') < 32) return new Response(JSON.stringify({ error: 'BLOCKED_SESSION_SECRET' }), { status: 503, headers });
    if (!env.RPG_SESSIONS || !env.RPG_BUDGETS) return new Response(JSON.stringify({ error: 'BLOCKED_SESSION_STORE' }), { status: 503, headers });
    if (Number(request.headers.get('content-length') ?? 0) > 2048) return new Response(JSON.stringify({ error: 'request_too_large' }), { status: 413, headers });
    let raw, body;
    try { raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > 2048) return new Response(JSON.stringify({ error: 'request_too_large' }), { status: 413, headers }); body = JSON.parse(raw); }
    catch { return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers }); }
    const budget = makeBudget(env.RPG_BUDGETS);
    if (url.pathname.endsWith('/start') && !(await budget.consumeStart())) return new Response(JSON.stringify({ error: 'global_start_limit' }), { status: 429, headers });
    const service = createRpgAiService({ secret: env.RPG_SESSION_SIGNING_KEY, store: makeSessionStore(env.RPG_SESSIONS), allowedOrigins: allow, provider: env.OPENAI_API_KEY ? createResponsesProvider({ apiKey: env.OPENAI_API_KEY }) : null, globalLimiter: { consume: () => budget.consume() }, dialogueModel: env.OPENAI_DIALOGUE_MODEL || 'gpt-6.1-terra' });
    const result = await service.handle({ method: request.method, path: url.pathname, origin, body });
    return new Response(result.status === 204 ? null : JSON.stringify(result.body), { status: result.status, headers: { ...headers, ...result.headers } });
  },
};

class RpgSession {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    let data; try { data = await request.json(); } catch { return json({ error: 'invalid_internal_request' }, 400); }
    if (op === 'create') {
      if (!data || typeof data.hostId !== 'string' || typeof data.sceneId !== 'string' || !Number.isInteger(data.expiresAt)) return json({ error: 'invalid_context' }, 400);
      const created = await this.state.storage.transaction(async tx => { if (await tx.get('context')) return false; await tx.put('context', { ...data, requests: {} }); return true; });
      if (!created) return json({ error: 'session_exists' }, 409);
      await this.state.storage.setAlarm(data.expiresAt);
      return new Response(null, { status: 204 });
    }
    if (op === 'claim') {
      const claim = await this.state.storage.transaction(async tx => {
        const context = await tx.get('context');
        if (!context || context.expiresAt <= data.now) return { kind: 'missing' };
        const prior = context.requests[data.requestId];
        if (prior) return prior.inputHash === data.inputHash && prior.response ? { kind: 'cached', response: prior.response } : { kind: prior.inputHash === data.inputHash ? 'busy' : 'conflict' };
        if (context.usedTurns >= Math.min(SESSION_TURNS, context.turnLimit ?? SESSION_TURNS)) return { kind: 'session_limit' };
        if (data.now - context.windowStart >= 60_000 || data.now < context.windowStart) { context.windowStart = data.now; context.windowCount = 0; }
        if (context.windowCount >= SESSION_MINUTE_TURNS) return { kind: 'rate_limit' };
        context.usedTurns++; context.windowCount++; context.requests[data.requestId] = { inputHash: data.inputHash, response: null };
        await tx.put('context', context);
        return { kind: 'claimed', context };
      });
      return json(claim);
    }
    if (op === 'complete') {
      const complete = await this.state.storage.transaction(async tx => {
        const context = await tx.get('context'), record = context?.requests?.[data.requestId];
        if (!record) return false;
        record.response = data.responseBody; context.recentTurns = data.recentTurns.slice(-8);
        await tx.put('context', context); return true;
      });
      if (!complete) return json({ error: 'claim_missing' }, 409);
      return new Response(null, { status: 204 });
    }
    if (op === 'release') {
      await this.state.storage.transaction(async tx => {
        const context = await tx.get('context'), record = context?.requests?.[data.requestId];
        if (!record || record.response) return;
        delete context.requests[data.requestId]; context.usedTurns = Math.max(0, context.usedTurns - 1);
        if (data.now - context.windowStart < 60_000) context.windowCount = Math.max(0, context.windowCount - 1);
        await tx.put('context', context);
      });
      return new Response(null, { status: 204 });
    }
    return json({ error: 'not_found' }, 404);
  }
  async alarm() { await this.state.storage.deleteAll(); }
}

class RpgGlobalBudget {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const op = new URL(request.url).pathname.slice(1);
    if (request.method !== 'POST' || !['consume-turn','consume-start'].includes(op)) return json({ error: 'not_found' }, 404);
    const now = Date.now(), day = Math.floor(now / 86_400_000), key = op === 'consume-start' ? 'starts' : 'turns';
    const accepted = await this.state.storage.transaction(async tx => {
      const minute = Math.floor(now / 60_000);
      const count = await tx.get(key) ?? { minute, minuteCount: 0, day, dayCount: 0 };
      if (count.minute !== minute) { count.minute = minute; count.minuteCount = 0; }
      if (count.day !== day) { count.day = day; count.dayCount = 0; }
      const perMinute = op === 'consume-start' ? 80 : GLOBAL_MINUTE_TURNS;
      const perDay = op === 'consume-start' ? GLOBAL_DAILY_STARTS : GLOBAL_DAILY_TURNS;
      if (count.minuteCount >= perMinute || count.dayCount >= perDay) return false;
      count.minuteCount++; count.dayCount++; await tx.put(key, count); return true;
    });
    return new Response(null, { status: accepted ? 204 : 429 });
  }
}

module.exports = { ...worker, RpgSession, RpgGlobalBudget };
