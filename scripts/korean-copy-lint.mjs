import { readFile } from 'node:fs/promises';

const files = ['index.html', 'app.js'];
const text = (await Promise.all(files.map((file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8')))).join('\n');
const forbiddenUi = [
  'The Legal Desk', 'The Drawing Room', 'The Available Limit', 'Beyond the Border', 'The Police Record',
  'ACT III', 'Document to inspect', 'Source drawer', 'DOCUMENTED', 'INFERRED', 'RECONSTRUCTED',
  'issue packet', 'letter packet', 'secret review', 'EVIDENCE LAYERS ON'
];
const failures = forbiddenUi.filter((token) => text.includes(token));
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
if (!index.includes('<html lang="ko">')) failures.push('html lang is not ko');
if (failures.length) { console.error(`korean-copy-lint: ${failures.join(', ')}`); process.exit(1); }
console.log('korean-copy-lint: Korean UI labels and production copy — PASS');
