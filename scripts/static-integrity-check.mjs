import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const sourceFiles = ['app.js', 'server.mjs', 'three-desk.js', 'three-walk.js', 'gold-runtime.js'];
for (const file of sourceFiles) {
  const text = await readFile(file, 'utf8');
  if (!text.trim()) throw new Error(`${file} is empty`);
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status !== 0) throw new Error(`${file} syntax check failed\n${check.stderr}`);
}
for (const file of ['data/corpus-manifest.json', 'data/v25-pilot-cases.json']) JSON.parse(await readFile(file, 'utf8'));
console.log('static-integrity: source readability, JavaScript syntax, and JSON parsing — PASS (no bundler configured)');
