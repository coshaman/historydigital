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

test('static build keeps provider credentials and endpoint configuration out of browser artifacts', () => {
  const result = buildWith({
    OPENAI_API_KEY: 'test-secret-must-never-be-built',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const config = fs.readFileSync(configPath, 'utf8');
  assert.match(config, /same-origin Vercel Function/);
  const builtFiles = fs.readdirSync(path.join(root, 'dist-v33'), { recursive: true }).filter(file => typeof file === 'string');
  for (const file of builtFiles) {
    if (!/\.(?:js|html|json)$/.test(file)) continue;
    assert.equal(fs.readFileSync(path.join(root, 'dist-v33', file), 'utf8').includes('test-secret-must-never-be-built'), false, `secret absent from ${file}`);
  }
});

test('Vercel API is a root-level Node Function and uses the environment key only server-side', () => {
  const api = fs.readFileSync(path.join(root, 'api', 'rpg', '[...path].js'), 'utf8');
  assert.match(api, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(api, /NEXT_PUBLIC_OPENAI_API_KEY|window\.[A-Z_]*OPENAI/);
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.equal(vercel.outputDirectory, 'dist-v33');
  assert.equal(vercel.functions['api/rpg/[...path].js'].maxDuration, 30);
  for (const route of ['api/rpg/health.js', 'api/rpg/session/start.js', 'api/rpg/dialogue.js']) {
    assert.equal(vercel.functions[route].maxDuration, 30, `${route} has a bounded Vercel runtime`);
    assert.ok(fs.existsSync(path.join(root, route)), `${route} is an explicit deployable function route`);
  }
  assert.ok(fs.existsSync(path.join(root, 'api', 'rpg', '[...path].js')));
});

test('RPG first paint does not wait for a remote font stylesheet', () => {
  const css = ['rpg/rpg.css', 'rpg/choices.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  assert.doesNotMatch(css, /@import\s+url\(["']?https?:\/\//i);
});

test('static HTML may link to the Vercel dashboard without loading remote assets', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /href="https:\/\/vercel\.com\/dashboard"/);
  assert.doesNotMatch(html, /<(?:script|img|link)\b[^>]*\b(?:src|href)="https?:\/\//i);
});
