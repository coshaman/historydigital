import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../ai-worker/src/index.js';

test('Cloudflare Durable Object keeps bounded session context across handler instances', async () => {
  const storage = new Map();
  const durable = new worker.ChancerySession({ storage: { get: async key => storage.get(key), put: async (key, value) => storage.set(key, value) } });
  const empty = await durable.fetch(new Request('https://session/context'));
  assert.equal((await empty.json()).usedTurns, 0);
  const context = { memories: [{ summaryKo: '플레이어는 원문을 먼저 보겠다고 했다.' }], summary: '원문을 확인한다.', recentTurns: [{ role: 'user', text: '원문을 먼저 볼게요.' }], usedTurns: 4 };
  const saved = await durable.fetch(new Request('https://session/context', { method: 'POST', body: JSON.stringify(context) }));
  assert.equal(saved.status, 204);
  const restored = await durable.fetch(new Request('https://session/context'));
  assert.deepEqual(await restored.json(), context);
  const invalid = await durable.fetch(new Request('https://session/context', { method: 'POST', body: '{}' }));
  assert.equal(invalid.status, 400);
});
