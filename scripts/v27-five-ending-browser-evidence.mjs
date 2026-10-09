import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.CHANCERY_BASE || 'http://127.0.0.1:4173/';
const out = path.resolve('artifacts/v27-browser');
fs.mkdirSync(out, { recursive: true });
const reachability = JSON.parse(fs.readFileSync('docs/v27/ENDING_REACHABILITY.json', 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));

async function resetAndStart() {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV26Manifest), null, { timeout: 15000 });
  await page.locator('#ledgerObject').click();
  await page.locator('#v27StartJourney').click();
  await page.locator('.v25-pilot-excerpt-head').first().waitFor({ state: 'visible', timeout: 15000 });
}

async function playCase(expected) {
  console.log(`play ${expected.caseId}`);
  const current = await page.evaluate(() => window.__goldRuntime.getState().caseId);
  if (current !== expected.caseId) throw new Error(`expected ${expected.caseId}, runtime is ${current}`);
  const excerpts = page.locator('.v25-pilot-excerpt-head');
  const count = await excerpts.count();
  if (count !== 5) throw new Error(`${expected.caseId} has ${count} excerpt cards, expected 5`);
  for (let index = 0; index < count; index++) await page.locator('.v25-pilot-excerpt-head').nth(index).click({ force: true });
  await page.getByText('다섯 발췌를 읽고 처리 단계로 이동').click({ force: true });
  const procedureIndex = expected.procedure - 1;
  const procedures = page.locator('#choiceArea button');
  if (await procedures.count() !== 3) throw new Error(`${expected.caseId} procedural choices missing`);
  await procedures.nth(procedureIndex).click({ force: true });
  const judgment = page.locator(`#choiceArea button[data-choice-id="${expected.judgmentId}"]`);
  if (await judgment.count() !== 1) throw new Error(`${expected.caseId} judgment ${expected.judgmentId} missing`);
  await judgment.click({ force: true });
  await page.locator('#choiceArea button').first().click({ force: true });
}

const evidence = [];
for (const entry of reachability.reachable) {
  console.log(`ending ${entry.id}`);
  await resetAndStart();
  for (const step of entry.witness.path) await playCase(step);
  await page.locator('#endingOverlay').waitFor({ state: 'visible', timeout: 15000 });
  const result = await page.evaluate(() => {
    const state = window.__goldRuntime.getState();
    return { endingId: state.v26.endingId, path: state.v27.journeyPath, completed: state.v27.completedCaseIds };
  });
  if (result.endingId !== entry.id) throw new Error(`${entry.id} resolved to ${result.endingId}`);
  if (result.path.length < 10 || result.path.length > 12) throw new Error(`${entry.id} path length ${result.path.length}`);
  const filename = `ending-${entry.id.toLowerCase()}.png`;
  await page.screenshot({ path: path.join(out, filename), fullPage: true });
  evidence.push({ endingId: entry.id, screenshot: filename, path: result.path, completedCount: result.completed.length });
}

// Verify that a V27 save can be loaded into the same in-progress case.
await resetAndStart();
await page.locator('.v25-pilot-excerpt-head').first().click({ force: true });
await page.locator('#saveBtn').click({ force: true });
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV26Manifest), null, { timeout: 20000 });
await page.locator('#loadBtn').click({ force: true, timeout: 10000 });
const loaded = await page.evaluate(() => ({ caseId: window.__goldRuntime.getState().caseId, journeyActive: window.__goldRuntime.getState().v26.journeyActive }));
if (loaded.caseId !== 'C01' || !loaded.journeyActive) throw new Error(`V27 save/load failed: ${JSON.stringify(loaded)}`);

const report = {
  schemaVersion: 'V27-BROWSER-ENDING-EVIDENCE-1',
  status: pageErrors.length ? 'FAIL' : 'PASS',
  generatedAt: new Date().toISOString(),
  endingEvidence: evidence,
  saveReload: { status: 'PASS', ...loaded },
  pageErrors,
  note: 'Each ending was reached through the browser UI using the machine-generated witness path; no state was injected for the ending runs.'
};
fs.writeFileSync(path.join(out, 'ENDING_BROWSER_EVIDENCE.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify(report, null, 2));
if (pageErrors.length) process.exitCode = 1;
