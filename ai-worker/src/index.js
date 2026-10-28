const { handleTurn } = require('../../ai/http/turn-handler.js');
const { createResponsesProvider } = require('../../ai/provider/openai-responses.js');

const buckets = new Map();
const limiter = {
  async consume(sessionId) {
    const now = Date.now();
    let bucket = buckets.get(sessionId);
    if (!bucket || now - bucket.startedAt > 60_000) bucket = { startedAt: now, count: 0 };
    bucket.count += 1;
    buckets.set(sessionId, bucket);
    if (buckets.size > 10000) buckets.delete(buckets.keys().next().value);
    return bucket.count <= 12;
  },
};

module.exports = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/ai/turn') return new Response('Not found', { status: 404 });
    const allowedOrigins = (env.CHANCERY_ALLOWED_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean);
    if (request.method === 'OPTIONS') {
      const result = await handleTurn({ method: 'OPTIONS', origin: request.headers.get('origin') || '' }, { config: { allowedOrigins } });
      return new Response(null, { status: result.status, headers: result.headers });
    }
    if (Number(request.headers.get('content-length') || 0) > 8192) return Response.json({ error: 'request_too_large' }, { status: 413 });
    let body;
    try {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > 8192) return Response.json({ error: 'request_too_large' }, { status: 413 });
      body = JSON.parse(text);
    } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
    const provider = env.OPENAI_API_KEY ? createResponsesProvider({ apiKey: env.OPENAI_API_KEY }) : undefined;
    const durableSession = env.CHANCERY_SESSIONS ? env.CHANCERY_SESSIONS.get(env.CHANCERY_SESSIONS.idFromName(body.sessionId)) : null;
    const sessionStore = durableSession ? {
      async get() { const result = await durableSession.fetch('https://session/context'); return result.json(); },
      async put(value) { await durableSession.fetch('https://session/context', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) }); },
    } : undefined;
    const result = await handleTurn({ method: request.method, origin: request.headers.get('origin') || '', body }, { provider, limiter, config: { allowedOrigins, dialogueModel: env.OPENAI_DIALOGUE_MODEL || 'gpt-6.1-terra', memoryModel: env.OPENAI_MEMORY_MODEL || 'gpt-6-luna', maxRequestBytes: 8192, maxTurnsPerSession: 80, sessionStore } });
    return Response.json(result.body, { status: result.status, headers: result.headers });
  },
};

class ChancerySession {
  constructor(state) { this.state = state; }
  async fetch(request) {
    if (request.method === 'GET') return Response.json(await this.state.storage.get('context') || { memories: [], summary: '', recentTurns: [], usedTurns: 0 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    let context;
    try { context = await request.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
    if (!context || typeof context !== 'object' || !Array.isArray(context.memories) || !Array.isArray(context.recentTurns) || typeof context.summary !== 'string' || !Number.isInteger(context.usedTurns)) return Response.json({ error: 'invalid_context' }, { status: 400 });
    await this.state.storage.put('context', context);
    return new Response(null, { status: 204 });
  }
}

module.exports.ChancerySession = ChancerySession;
