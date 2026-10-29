import assert from 'node:assert/strict';
import test from 'node:test';
import { mimeTypeFor } from '../server-mime.mjs';

test('local server assigns browser-loadable MIME types to JavaScript modules', () => {
  assert.equal(mimeTypeFor('/rpg/main.js'), 'text/javascript; charset=utf-8');
  assert.equal(mimeTypeFor('/rpg/engine/learning-life.mjs'), 'text/javascript; charset=utf-8');
  assert.equal(mimeTypeFor('/index.html'), 'text/html; charset=utf-8');
});
