import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const commands = ['v27-build-case-bundle', 'v27-schema-audit', 'v27-content-acceptance', 'v27-full-audit', 'v27-ending-logic', 'v27-ending-counterexample', 'v27-terminal-coverage', 'v27-ending-reachability', 'v27-branch-test', 'v27-browser-evidence', 'v27-ending-browser-evidence', 'real-build', 'real-build-browser', 'build', 'lint', 'check', 'test', 'mobile'];
const scripts = {
  'v27-build-case-bundle': 'scripts/v27-build-case-bundle.mjs',
  'v27-schema-audit': 'scripts/v27-schema-audit.mjs',
  'v27-content-acceptance': 'scripts/v27-content-acceptance.mjs',
  'v27-full-audit': 'scripts/v27-full-audit.mjs',
  'v27-ending-logic': 'scripts/v27-ending-logic-test.mjs',
  'v27-ending-counterexample': 'scripts/v27-ending-counterexample.mjs',
  'v27-terminal-coverage': 'scripts/v27-terminal-coverage.mjs',
  'v27-ending-reachability': 'scripts/v27-ending-reachability.mjs',
  'v27-branch-test': 'scripts/v27-branch-test.mjs',
  'v27-browser-evidence': 'scripts/v27-browser-evidence.mjs',
  'v27-ending-browser-evidence': 'scripts/v27-five-ending-browser-evidence.mjs',
  'real-build': 'scripts/real-build.mjs',
  'real-build-browser': 'scripts/real-build-browser-smoke.mjs',
  build: 'scripts/static-integrity-check.mjs', lint: 'scripts/ui-lint.mjs', check: 'scripts/historical-lint.mjs', test: 'scripts/route-test.mjs', mobile: 'scripts/mobile-check.mjs',
};
const results = [];
for (const script of commands) {
  const result = spawnSync(process.execPath, [scripts[script]], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  results.push({ script, status: result.status, stdout: result.stdout, stderr: result.stderr });
  if (result.status !== 0) {
    fs.mkdirSync('docs/v27', { recursive: true });
    fs.writeFileSync('docs/v27/VERIFY_LOG.json', JSON.stringify({ schemaVersion: 'V27-VERIFY-1', status: 'FAIL', results }, null, 2) + '\n');
    console.error(`${script}: FAIL`);
    process.exit(1);
  }
}
const reports = ['SCHEMA_AUDIT.json', 'CONTENT_ACCEPTANCE.json', 'ENDING_REACHABILITY.json', 'ENDING_COUNTEREXAMPLE.json', 'TERMINAL_COVERAGE.json', 'BRANCH_TEST.json', 'artifacts/v27-browser/BROWSER_EVIDENCE.json', 'artifacts/v27-browser/ENDING_BROWSER_EVIDENCE.json', 'REAL_BUILD.json', 'REAL_BUILD_BROWSER.json'];
const parsed = Object.fromEntries(reports.map((file) => [file, JSON.parse(fs.readFileSync(file.startsWith('artifacts/') ? file : `docs/v27/${file}`, 'utf8'))]));
const failures = [];
if (parsed['SCHEMA_AUDIT.json'].status !== 'PASS') failures.push('schema audit did not pass');
if (parsed['CONTENT_ACCEPTANCE.json'].status !== 'PASS') failures.push('content acceptance did not pass');
if (parsed['ENDING_REACHABILITY.json'].status !== 'PASS') failures.push('ending reachability did not pass');
if (parsed['ENDING_REACHABILITY.json'].reachable?.some((item) => !item.reachable)) failures.push('one or more endings unreachable');
if (parsed['BRANCH_TEST.json'].status !== 'PASS') failures.push('normal branch test did not pass');
if (parsed['ENDING_COUNTEREXAMPLE.json'].status !== 'PASS') failures.push('ending hard-gate counterexample test did not pass');
if (parsed['TERMINAL_COVERAGE.json'].status !== 'PASS') failures.push('terminal coverage found a path without an ending');
if (!parsed['artifacts/v27-browser/BROWSER_EVIDENCE.json'].overflowFree) failures.push('desktop/mobile browser evidence reports overflow');
if (parsed['artifacts/v27-browser/ENDING_BROWSER_EVIDENCE.json'].status !== 'PASS') failures.push('browser ending evidence did not pass');
if (parsed['artifacts/v27-browser/ENDING_BROWSER_EVIDENCE.json'].endingEvidence?.length !== 5) failures.push('browser evidence does not contain five endings');
if (parsed['artifacts/v27-browser/ENDING_BROWSER_EVIDENCE.json'].saveReload?.status !== 'PASS') failures.push('browser save/reload evidence did not pass');
if (parsed['REAL_BUILD.json'].status !== 'PASS') failures.push('real build artifact did not pass');
if (parsed['REAL_BUILD_BROWSER.json'].status !== 'PASS') failures.push('real build browser smoke did not pass');
const report = { schemaVersion: 'V27-VERIFY-1', status: failures.length ? 'FAIL' : 'PASS', commands: commands.map((script) => ({ script, status: 'PASS' })), reports: parsed, failures, realBuild: 'PASS_STATIC_DEPLOYMENT_ARTIFACT' };
fs.mkdirSync('docs/v27', { recursive: true });
fs.writeFileSync('docs/v27/VERIFY_LOG.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
