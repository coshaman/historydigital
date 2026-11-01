import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { _test: api } = require('../api/rpg/[...path].js');

function invoke(path, body, method = 'POST', { origin = 'https://game.example' } = {}) {
  const req = { method, url: path, body, headers: { host: 'game.example', ...(origin ? { origin } : {}), 'x-forwarded-host': 'game.example', 'x-forwarded-proto': 'https' } };
  const res = {
    headers: {}, statusCode: 200, output: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(value = '') { this.output = value; },
  };
  return api.handle(req, res).then(() => ({ status: res.statusCode, headers: res.headers, body: res.output ? JSON.parse(res.output) : {} }));
}

test('Vercel route signs state into the session token so a fresh function invocation can continue', async () => {
  const started = await invoke('/api/rpg/session/start', { hostId: 'printer_ekaterina', actorHostId: 'seamstress_anna' });
  assert.equal(started.status, 201);
  const turned = await invoke('/api/rpg/dialogue', { sessionToken: started.body.sessionToken, requestId: 'vercel-turn-0001', playerInput: '문장에 어떤 문제가 있었나요?', actorRelations: {}, actorActions: [] });
  assert.equal(turned.status, 200);
  assert.equal(turned.body.fallback, true, 'without a key the authored offline dialogue remains available');
  assert.ok(turned.body.sessionToken);
  assert.notEqual(turned.body.sessionToken, started.body.sessionToken);
  assert.equal((await invoke('/api/rpg/dialogue', { sessionToken: `${started.body.sessionToken}x`, requestId: 'vercel-turn-0002', playerInput: '이전 선택지를 다시 물어요.' })).status, 401);
});

test('Vercel routes reject browser origins different from the request host', async () => {
  const req = { method: 'GET', url: '/api/rpg/health', headers: { host: 'game.example', origin: 'https://elsewhere.example', 'x-forwarded-host': 'game.example', 'x-forwarded-proto': 'https' } };
  const res = { headers: {}, statusCode: 200, setHeader(name, value) { this.headers[name] = value; }, end(value = '') { this.output = value; } };
  await api.handle(req, res);
  assert.equal(res.statusCode, 403);
});

test('read-only health probe works from an address bar without weakening game-route origin checks', async () => {
  const health = await invoke('/api/rpg/health', undefined, 'GET', { origin: '' });
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');
  assert.ok(['configured', 'BLOCKED_NO_KEY'].includes(health.body.ai));
  const start = await invoke('/api/rpg/session/start', {}, 'POST', { origin: '' });
  assert.equal(start.status, 403);
});
