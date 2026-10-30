import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'dist-v33', 'rpg', 'ai', 'config.js');

function buildWith(env) {
  return spawnSync(process.execPath, ['scripts/v33-static-build.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('static build injects the public Worker URL, rejects unsafe URLs, and preserves offline mode', () => {
  const workerUrl = 'https://russian-lives-v33-rpg-ai.example.workers.dev';
  const result = buildWith({
    RPG_AI_API_BASE_URL: `${workerUrl}/`,
    OPENAI_API_KEY: 'test-secret-must-never-be-built',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const config = fs.readFileSync(configPath, 'utf8');
  assert.ok(config.includes(`window.V33_RPG_AI_API_BASE_URL = ${JSON.stringify(workerUrl)};`));
  assert.equal(config.includes('test-secret-must-never-be-built'), false);

  const previousConfig = config;
  const unsafe = buildWith({ RPG_AI_API_BASE_URL: 'javascript:alert(1)' });
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /RPG_AI_API_BASE_URL/);
  assert.equal(fs.readFileSync(configPath, 'utf8'), previousConfig);

  const offline = buildWith({ RPG_AI_API_BASE_URL: '' });
  assert.equal(offline.status, 0, offline.stderr || offline.stdout);
  assert.ok(fs.readFileSync(configPath, 'utf8').includes('window.V33_RPG_AI_API_BASE_URL = "";'));
});

test('Pages workflow passes only the public Worker URL variable to the static build', () => {
  const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'pages-v33.yml'), 'utf8');
  assert.match(workflow, /RPG_AI_API_BASE_URL:\s*\$\{\{\s*vars\.RPG_AI_API_BASE_URL\s*\}\}/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY/);
});

test('RPG first paint does not wait for a remote font stylesheet', () => {
  const css = ['rpg/rpg.css', 'rpg/choices.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  assert.doesNotMatch(css, /@import\s+url\(["']?https?:\/\//i);
});
