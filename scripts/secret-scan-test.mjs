import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectText, isFrontendFile } from './secret-scan.mjs';

test('detects a key-like token without returning its contents', () => {
  const syntheticToken = 'sk-' + 'live-abcdefghijklmnopqrstuvwxyz123456';
  const result = inspectText(`placeholder ${syntheticToken} and more`);
  assert.equal(result.hasSecret, true);
  assert.equal(JSON.stringify(result).includes('sk-' + 'live'), false);
});

test('does not treat short documentation examples as credentials', () => {
  assert.equal(inspectText('Use sk- in your test string.').hasSecret, false);
});

test('identifies frontend files without treating server environment names as browser code', () => {
  assert.equal(isFrontendFile('main20-runtime.js'), true);
  assert.equal(isFrontendFile('ai/provider/openai-responses.js'), false);
});
