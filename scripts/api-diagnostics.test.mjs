import test from 'node:test';
import assert from 'node:assert/strict';
import { API_DIAGNOSTICS_KEY, API_DIAGNOSTICS_LIMIT, appendApiDiagnostic, clearApiDiagnostics, readApiDiagnostics } from '../rpg/engine/api-diagnostics.mjs';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

test('API diagnostics persist only bounded, redacted endpoint error metadata', () => {
  const storage = memoryStorage();
  const entries = appendApiDiagnostic(storage, { endpoint: '/api/rpg/dialogue', kind: 'provider_fallback', status: 200, code: 'response_schema_invalid', at: '2026-11-02T00:00:00Z' });
  assert.equal(entries[0].code, 'response_schema_invalid');
  assert.equal(Object.hasOwn(entries[0], 'playerInput'), false);
  appendApiDiagnostic(storage, { endpoint: '/api/rpg/dialogue', kind: 'http_error', status: 401, code: 'invalid_session' });
  appendApiDiagnostic(storage, { endpoint: '/api/rpg/dialogue', kind: 'client_error', code: 'client_response_invalid' });
  const raw = storage.getItem(API_DIAGNOSTICS_KEY);
  assert.doesNotMatch(raw, /token|playerInput|secret|prompt/);
  assert.equal(readApiDiagnostics(storage).length, 3);
  assert.equal(readApiDiagnostics(storage)[0].kind, 'client_error');
  for (let i = 0; i < API_DIAGNOSTICS_LIMIT + 7; i += 1) appendApiDiagnostic(storage, { endpoint: '/api/rpg/health', kind: 'health_error', status: 503, code: 'health_unavailable' });
  assert.equal(readApiDiagnostics(storage).length, API_DIAGNOSTICS_LIMIT);
});

test('diagnostics reject arbitrary paths and clear from local storage', () => {
  const storage = memoryStorage();
  appendApiDiagnostic(storage, { endpoint: '/api/rpg/dialogue?sessionToken=secret', kind: 'http_error', code: 'bad' });
  assert.deepEqual(readApiDiagnostics(storage), []);
  appendApiDiagnostic(storage, { endpoint: '/api/rpg/health', kind: 'health_error', code: 'offline' });
  assert.deepEqual(clearApiDiagnostics(storage), []);
  assert.equal(storage.getItem(API_DIAGNOSTICS_KEY), null);
});
