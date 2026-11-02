'use strict';

const { createHash, createHmac, timingSafeEqual } = require('node:crypto');
const { deflateRawSync, inflateRawSync } = require('node:zlib');
const { createRpgAiService, MemorySessionStore, readToken } = require('../../ai/v33/session-runtime.cjs');
const { createResponsesProvider } = require('../../ai/v33/openai-provider.cjs');

const MAX_CAPSULE_LENGTH = 24000;

function sessionSecret(apiKey) {
  return createHash('sha256').update('chancery-of-ink:v33:session:v1:').update(apiKey || 'offline-authored-mode').digest('hex');
}

function sealSession(id, state, secret) {
  const payload = deflateRawSync(Buffer.from(JSON.stringify({ id, state }))).toString('base64url');
  const signed = `v1.${payload}`;
  const signature = createHmac('sha256', secret).update(signed).digest('base64url');
  return `${signed}.${signature}`;
}

function openSession(token, secret) {
  if (typeof token !== 'string' || token.length > MAX_CAPSULE_LENGTH) return null;
  const [version, payload, signature, extra] = token.split('.');
  if (version !== 'v1' || !payload || !signature || extra !== undefined) return null;
  const expected = createHmac('sha256', secret).update(`${version}.${payload}`).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const capsule = JSON.parse(inflateRawSync(Buffer.from(payload, 'base64url'), { maxOutputLength: 18000 }).toString('utf8'));
    if (!capsule || !/^[0-9a-f-]{36}$/i.test(capsule.id) || !capsule.state || typeof capsule.state !== 'object') return null;
    return capsule;
  } catch { return null; }
}

function requestOrigin(req) {
  const origin = req.headers.origin || '';
  if (!origin) return '';
  try {
    const parsed = new URL(origin);
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const expectedProtocol = forwardedProto || (host.startsWith('localhost:') || host.startsWith('127.0.0.1:') ? 'http' : 'https');
    return parsed.host === host && parsed.protocol === `${expectedProtocol}:` ? parsed.origin : '';
  } catch { return ''; }
}

function send(res, result, origin) {
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  if (origin) res.setHeader('access-control-allow-origin', origin);
  res.statusCode = result.status;
  if (result.status === 204) return res.end();
  res.end(JSON.stringify(result.body));
}

async function handle(req, res) {
  const route = new URL(req.url, `https://${req.headers.host || 'localhost'}`).pathname;
  // Allow a read-only health probe from the address bar and uptime monitors.
  // Stateful game routes still require a same-origin browser request below.
  if (req.method === 'GET' && route === '/api/rpg/health' && !req.headers.origin) {
    const configured = Boolean(process.env.OPENAI_API_KEY);
    return send(res, { status: 200, headers: { 'cache-control': 'no-store' }, body: { status: 'ok', ai: configured ? 'configured' : 'BLOCKED_NO_KEY' } }, '');
  }
  const origin = requestOrigin(req);
  if (req.method === 'OPTIONS') return send(res, { status: 204, headers: {}, body: {} }, origin);
  if (!origin) return send(res, { status: 403, headers: {}, body: { error: 'same_origin_required' } }, '');
  const key = process.env.OPENAI_API_KEY || '';
  const secret = sessionSecret(key);
  const store = new MemorySessionStore();
  const isDialogue = route === '/api/rpg/dialogue';
  let capsule = null;
  if (isDialogue) {
    capsule = openSession(req.body?.sessionToken, secret);
    if (!capsule) return send(res, { status: 401, headers: {}, body: { error: 'invalid_session' } }, origin);
    if (!readToken(`${capsule.id}.${require('node:crypto').createHmac('sha256', secret).update(capsule.id).digest('base64url')}`, secret)) {
      return send(res, { status: 401, headers: {}, body: { error: 'invalid_session' } }, origin);
    }
    store.sessions.set(capsule.id, capsule.state);
  }
  const provider = key ? createResponsesProvider({ apiKey: key }) : null;
  const service = createRpgAiService({
    secret,
    store,
    allowedOrigins: [origin],
    provider,
    dialogueModel: process.env.OPENAI_DIALOGUE_MODEL || 'gpt-5.4-mini',
  });
  const sessionIdToken = isDialogue ? `${capsule.id}.${createHmac('sha256', secret).update(capsule.id).digest('base64url')}` : null;
  const serviceBody = isDialogue ? { ...req.body, sessionToken: sessionIdToken } : req.body;
  const result = await service.handle({ method: req.method, path: route, origin, body: serviceBody });
  if (provider?.lastFailureCode) {
    if (process.env.VERCEL === '1') console.warn(JSON.stringify({ event: 'rpg_provider_fallback', code: provider.lastFailureCode }));
    else result.headers['x-v33-provider-result'] = provider.lastFailureCode;
  }
  if (result.status === 200 || result.status === 201) {
    const innerToken = isDialogue ? sessionIdToken : result.body.sessionToken;
    const id = readToken(innerToken, secret);
    const state = id && await store.get(id);
    if (id && state) result.body.sessionToken = sealSession(id, state, secret);
  }
  return send(res, result, origin);
}

module.exports = async function handler(req, res) {
  try { await handle(req, res); }
  catch { send(res, { status: 500, headers: { 'cache-control': 'no-store' }, body: { error: 'server_error' } }, ''); }
};

module.exports._test = { handle, openSession, sealSession, requestOrigin };
