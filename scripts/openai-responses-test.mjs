import assert from 'node:assert/strict';
import test from 'node:test';
import { createResponsesProvider } from '../ai/provider/openai-responses.js';
import scenarios from '../narrative/LATE_GAME_SCENARIOS.json' with { type: 'json' };

test('Responses adapter sends strict schema and parses structured output without exposing key', async () => {
  let request;
  const provider = createResponsesProvider({ apiKey: 'secret-test-value', fetchImpl: async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(JSON.stringify({ status: 'completed', output_text: '{"ok":true}' }), { status: 200 });
  } });
  const format = { type: 'json_schema', name: 'test', strict: true, schema: { type: 'object' } };
  assert.deepEqual(await provider.generate({ input: { playerInput: '안녕' }, format, model: 'gpt-6.1-terra', maxOutputTokens: 200 }), { ok: true });
  assert.equal(request.text.format.strict, true);
  assert.equal(request.max_output_tokens, 200);
  assert.equal(request.model, 'gpt-6.1-terra');
  assert.equal(JSON.stringify(request).includes('secret-test-value'), false);
});

test('Responses adapter rejects HTTP and incomplete/invalid structured results safely', async () => {
  const fail = createResponsesProvider({ apiKey: 'secret', fetchImpl: async () => new Response('private error detail', { status: 500 }) });
  await assert.rejects(() => fail.generate({ input: {}, format: {}, model: 'gpt-6-luna' }), /provider request failed/);
  const incomplete = createResponsesProvider({ apiKey: 'secret', fetchImpl: async () => new Response(JSON.stringify({ status: 'incomplete', output_text: '{}' }), { status: 200 }) });
  await assert.rejects(() => incomplete.generate({ input: {}, format: {}, model: 'gpt-6-luna' }), /incomplete/);
});

test('memory summarizer uses its separate compact model and strict bounded schema', async () => {
  let request;
  const provider = createResponsesProvider({ apiKey: 'secret-test-value', fetchImpl: async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(JSON.stringify({ status: 'completed', output_text: '{"schemaVersion":"AI_SCENE_MEMORY_SUMMARY_V1","summaryKo":"원문을 확인하고 의견을 나누기로 했다."}' }), { status: 200 });
  } });
  const summary = await provider.summarize({ input: { recentTurns: [{ role: 'user', text: '원문부터 읽자.' }] }, model: 'gpt-6-luna' });
  assert.equal(summary.schemaVersion, 'AI_SCENE_MEMORY_SUMMARY_V1');
  assert.equal(request.model, 'gpt-6-luna');
  assert.equal(request.text.format.strict, true);
  assert.equal(request.text.format.schema.properties.summaryKo.maxLength, 900);
});
