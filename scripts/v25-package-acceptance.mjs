import { readFile, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { parse } from 'node:path';
import { spawnSync } from 'node:child_process';

const required = ['README_REVIEWER.md', 'QUALITY_LEDGER.json', 'ENVIRONMENT.md', 'GATE_INVENTORY.csv', 'VALIDATION_SUMMARY.json', 'BUG_ROOT_CAUSES_AND_FIXES.md', 'WORK_LOG.md', 'FINAL_REPORT.md', 'data/FULL_SOURCE_WITNESSES.csv', 'data/FULL_SOURCE_WITNESSES.json', 'tests/independent_replay.json', 'tests/REAL_STATE_PERFORMANCE.json'];
const failures = [];
for (const path of required) { try { await stat(`docs/v25/${path}`); } catch { failures.push(`missing:${path}`); } }
const csv = await readFile('docs/v25/data/FULL_SOURCE_WITNESSES.csv', 'utf8');
if (!csv.endsWith('\r\n')) failures.push('csv:not-rfc4180-final-crlf');
if ((csv.match(/\r\n/g) || []).length < 10) failures.push('csv:too-few-rows');
for (const path of ['docs/v25/data/FULL_SOURCE_WITNESSES.json', 'docs/v25/tests/independent_replay.json', 'docs/v25/tests/REAL_STATE_PERFORMANCE.json']) { try { JSON.parse(await readFile(path, 'utf8')); } catch { failures.push(`json:${path}`); } }
const zipExists = spawnSync('powershell.exe', ['-NoProfile', '-Command', "Test-Path -LiteralPath 'RUSSIAN_LIVES_V25_VERIFIABLE_DELIVERY.zip'"], { encoding: 'utf8' }).stdout.trim() === 'True';
if (!zipExists) failures.push('zip:missing');
const result = { status: failures.length ? 'FAIL' : 'PASS', failures, requiredCount: required.length, csvRows: (csv.match(/\r\n/g) || []).length - 1, zipIndependentlyPresent: zipExists };
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;
