'use strict';

const { createRpgAiService, isSupportedHostId } = require('../session-runtime.cjs');
const { createResponsesProvider } = require('../openai-provider.cjs');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TURNS = 80;
const SESSION_MINUTE_TURNS = 12;
const TURN_LEASE_MS = 60_000;
const GLOBAL_MINUTE_TURNS = 300;
const GLOBAL_DAILY_TURNS = 1200;
const GLOBAL_DAILY_STARTS = 1000;
const CALLER_MINUTE_STARTS = 8;
const CALLER_DAILY_STARTS = 40;
const CALLER_MINUTE_TURNS = 30;
const CALLER_DAILY_TURNS = 200;
const GLOBAL_MAX_INFLIGHT_TURNS = 8;
const GLOBAL_TURN_LEASE_MS = 90_000;

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
function makeBudget(namespace, callerId) {
  const stub = namespace.get(namespace.idFromName('v33-rpg-global'));
  const callerStub = callerId ? namespace.get(namespace.idFromName(`v33-rpg-caller-${callerId}`)) : null;
  const consume = async (target, kind) => (await target.fetch(`https://rpg-budget/${kind}`, { method: 'POST' })).status === 204;
  return {
    consume: () => consume(stub, 'consume-turn'),
    consumeStart: () => consume(stub, 'consume-start'),
    consumeCallerStart: () => callerStub ? consume(callerStub, 'consume-caller-start') : Promise.resolve(false),
    consumeCallerTurn: () => callerStub ? consume(callerStub, 'consume-caller-turn') : Promise.resolve(false),
    acquireTurn: async leaseId => (await stub.fetch('https://rpg-budget/acquire-turn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ leaseId }) })).status === 204,
    releaseTurn: async leaseId => { await stub.fetch('https://rpg-budget/release-turn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ leaseId }) }); },
  };
}
async function callerKey(address, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(address || 'unknown'));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
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
    if (url.pathname.endsWith('/start')) {
      if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(key => !['hostId','actorHostId'].includes(key)) || !Object.hasOwn(body, 'hostId')) return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400, headers });
      if (!isSupportedHostId(body.hostId)) return new Response(JSON.stringify({ error: 'unsupported_host' }), { status: 400, headers });
      if (body.actorHostId !== undefined && (!isSupportedHostId(body.actorHostId) || body.actorHostId === body.hostId)) return new Response(JSON.stringify({ error: 'invalid_actor' }), { status: 400, headers });
    }
    const clientKey = await callerKey(request.headers.get('cf-connecting-ip') ?? '', env.RPG_SESSION_SIGNING_KEY);
    const budget = makeBudget(env.RPG_BUDGETS, clientKey);
    if (url.pathname.endsWith('/start')) {
      if (!(await budget.consumeCallerStart())) return new Response(JSON.stringify({ error: 'caller_start_limit' }), { status: 429, headers });
      if (!(await budget.consumeStart())) return new Response(JSON.stringify({ error: 'global_start_limit' }), { status: 429, headers });
    }
    const service = createRpgAiService({ secret: env.RPG_SESSION_SIGNING_KEY, store: makeSessionStore(env.RPG_SESSIONS), allowedOrigins: allow, provider: env.OPENAI_API_KEY ? createResponsesProvider({ apiKey: env.OPENAI_API_KEY }) : null, globalLimiter: { consume: async () => (await budget.consumeCallerTurn()) && (await budget.consume()) }, dialogueModel: env.OPENAI_DIALOGUE_MODEL || 'gpt-6.1-terra' });
    let result;
    if (url.pathname === '/api/rpg/dialogue') {
      const leaseId = crypto.randomUUID();
      if (!(await budget.acquireTurn(leaseId))) return new Response(JSON.stringify({ error: 'global_concurrency_limit' }), { status: 429, headers });
      try { result = await service.handle({ method: request.method, path: url.pathname, origin, body }); }
      finally { await budget.releaseTurn(leaseId); }
    } else result = await service.handle({ method: request.method, path: url.pathname, origin, body });
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
        for (const [staleId, record] of Object.entries(context.requests)) {
          if (record.response) continue;
          const startedAt = Number.isFinite(record.startedAt) ? record.startedAt : data.now;
          if (data.now - startedAt < TURN_LEASE_MS) continue;
          delete context.requests[staleId];
          context.usedTurns = Math.max(0, context.usedTurns - 1);
          if (data.now - context.windowStart < 60_000) context.windowCount = Math.max(0, context.windowCount - 1);
        }
        const prior = context.requests[data.requestId];
        if (prior) return prior.inputHash === data.inputHash && prior.response ? { kind: 'cached', response: prior.response } : { kind: prior.inputHash === data.inputHash ? 'busy' : 'conflict' };
        if (Object.values(context.requests).some(record => !record.response)) return { kind: 'busy' };
        if (context.usedTurns >= Math.min(SESSION_TURNS, context.turnLimit ?? SESSION_TURNS)) return { kind: 'session_limit' };
        if (data.now - context.windowStart >= 60_000 || data.now < context.windowStart) { context.windowStart = data.now; context.windowCount = 0; }
        if (context.windowCount >= SESSION_MINUTE_TURNS) return { kind: 'rate_limit' };
        context.usedTurns++; context.windowCount++; context.requests[data.requestId] = { inputHash: data.inputHash, response: null, startedAt: data.now };
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
    if (request.method !== 'POST' || !['consume-turn','consume-start','consume-caller-start','consume-caller-turn','acquire-turn','release-turn'].includes(op)) return json({ error: 'not_found' }, 404);
    let data = {};
    if (op === 'acquire-turn' || op === 'release-turn') { try { data = await request.json(); } catch { return json({ error: 'invalid_internal_request' }, 400); } }
    if (op === 'acquire-turn' || op === 'release-turn') {
      const now = Number(data.now) || Date.now();
      if (typeof data.leaseId !== 'string' || !/^[\w-]{1,80}$/.test(data.leaseId)) return json({ error: 'invalid_lease' }, 400);
      if (op === 'release-turn') {
        await this.state.storage.transaction(async tx => { const leases = await tx.get('turnLeases') ?? {}; delete leases[data.leaseId]; await tx.put('turnLeases', leases); });
        return new Response(null, { status: 204 });
      }
      const accepted = await this.state.storage.transaction(async tx => {
        const leases = await tx.get('turnLeases') ?? {};
        for (const [id, expiresAt] of Object.entries(leases)) if (expiresAt <= now) delete leases[id];
        if (Object.hasOwn(leases, data.leaseId) || Object.keys(leases).length >= GLOBAL_MAX_INFLIGHT_TURNS) { await tx.put('turnLeases', leases); return false; }
        leases[data.leaseId] = now + GLOBAL_TURN_LEASE_MS; await tx.put('turnLeases', leases); return true;
      });
      return new Response(null, { status: accepted ? 204 : 429 });
    }
    const caller = op.startsWith('consume-caller-'), start = op.endsWith('-start');
    const now = Date.now(), day = Math.floor(now / 86_400_000), key = caller ? (start ? 'callerStarts' : 'callerTurns') : (start ? 'starts' : 'turns');
    const accepted = await this.state.storage.transaction(async tx => {
      const minute = Math.floor(now / 60_000);
      const count = await tx.get(key) ?? { minute, minuteCount: 0, day, dayCount: 0 };
      if (count.minute !== minute) { count.minute = minute; count.minuteCount = 0; }
      if (count.day !== day) { count.day = day; count.dayCount = 0; }
      const perMinute = caller ? (start ? CALLER_MINUTE_STARTS : CALLER_MINUTE_TURNS) : (start ? 80 : GLOBAL_MINUTE_TURNS);
      const perDay = caller ? (start ? CALLER_DAILY_STARTS : CALLER_DAILY_TURNS) : (start ? GLOBAL_DAILY_STARTS : GLOBAL_DAILY_TURNS);
      if (count.minuteCount >= perMinute || count.dayCount >= perDay) return false;
      count.minuteCount++; count.dayCount++; await tx.put(key, count); return true;
    });
    if (caller && accepted && this.state.storage.setAlarm) await this.state.storage.setAlarm(now + 2 * 86_400_000);
    return new Response(null, { status: accepted ? 204 : 429 });
  }
  async alarm() { await this.state.storage.deleteAll(); }
}

module.exports = { ...worker, RpgSession, RpgGlobalBudget };
