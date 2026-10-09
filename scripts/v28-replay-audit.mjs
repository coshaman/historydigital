import fs from 'node:fs';
import { chromium } from 'playwright';

const out = 'docs/v28/REPLAY_AUDIT.json';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.goto('http://127.0.0.1:4173/#v28-reset', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph), null, { timeout: 30000 });
await page.evaluate(() => {
  for (let guard = 0; guard < 40; guard += 1) {
    const button = [...document.querySelectorAll('.v28-runtime #choiceArea button')].find((item) => /다음 말을 듣는다|고개를 들고 대답한다/.test(item.textContent || ''));
    if (!button) break;
    button.click();
  }
});
await page.locator('.v28-runtime #choiceArea button').first().click({ force: true });
await page.getByText('봉투를 펼쳐 본다', { exact: true }).click({ force: true });
await page.waitForSelector('.v28-excerpt-open');
await page.evaluate(() => document.querySelectorAll('.v28-excerpt-open').forEach((button) => button.click()));
await page.getByText('읽은 내용을 들려준다', { exact: true }).click({ force: true });
await page.getByText('오늘의 기록을 접는다', { exact: true }).click({ force: true });
const result = await page.evaluate(() => {
  const state = window.__goldRuntime.getState();
  const replay = window.__goldRuntime.replayV28Actions(state.actions);
  return {
    live: {
      completedCaseIds: state.v28.completedCaseIds,
      choiceCounts: state.v28.choiceCounts,
      witnessedCharacters: state.v28.witnessedCharacters,
      memoryCallbacks: state.v28.memoryCallbacks,
      access: state.v27.access,
      relationships: state.relationships,
      risk: state.v28.risk,
      routedDocuments: state.actions.filter((action) => action.type === 'V28_ROUTED_DOCUMENT').length,
      readDocuments: state.actions.filter((action) => action.type === 'V28_DOCUMENT_READ').length,
    },
    replay,
  };
});
const normalize = (value) => JSON.stringify(value);
const status = normalize(result.live.completedCaseIds) === normalize(result.replay.completedCaseIds)
  && normalize(result.live.choiceCounts) === normalize(result.replay.choiceCounts)
  && normalize(result.live.witnessedCharacters) === normalize(result.replay.witnessedCharacters)
  && normalize(result.live.memoryCallbacks) === normalize(result.replay.memoryCallbacks)
  && normalize(result.live.access) === normalize(result.replay.access)
  && normalize(result.live.relationships) === normalize(result.replay.relationships)
  && result.live.risk === result.replay.risk
  && result.live.routedDocuments === result.replay.routedDocuments
  && result.live.readDocuments === result.replay.readDocuments
  && errors.length === 0;
const report = { schemaVersion: 'V28-REPLAY-AUDIT-1', status: status ? 'PASS' : 'FAIL', errors, result };
fs.mkdirSync('docs/v28', { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (!status) process.exit(1);
