import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('data/v25-pilot-cases.json', 'utf8'));
const browser = await chromium.launch({ headless: true });
const cases = [];
for (const data of manifest.cases) {
  const routes = [];
  for (const route of [0, 1]) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto('http://127.0.0.1:4173/');
    await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
    await page.reload();
    await page.waitForFunction(() => window.__goldRuntime?.getPilotManifest);
    await page.locator('#ledgerObject').click();
    await page.locator(`[data-ledger-scene="${data.caseId}"]`).click();
    for (let index = 0; index < data.excerpts.length; index += 1) await page.locator('.v25-pilot-excerpt-head').nth(index).click();
    await page.locator('.pilot-continue').click();
    await page.locator('#choiceArea button').nth(route).click();
    await page.locator('#choiceArea button').nth((route + 1) % 3).click();
    await page.locator('#choiceArea button').nth(route).click();
    const observed = await page.evaluate(() => ({
      state: structuredClone(window.__goldRuntime.getState().pilot),
      issue: structuredClone(window.__goldRuntime.getState().issue),
      phase: window.__goldRuntime.getState().phase,
      log: window.__goldRuntime.getCanonicalActionLog().filter((action) => ['SOURCE_OPEN_READ', 'PROCEDURAL_TREATMENT', 'INTERPRETIVE_JUDGMENT', 'DOWNSTREAM_UNLOCK'].includes(action.actionType)),
      reducer: typeof window.__goldRuntime.replayPilotActions,
    }));
    const actions = observed.log.map((action) => ({
      type: action.actionType,
      excerptId: action.payload?.excerptId,
      choiceId: action.choiceId || action.payload?.choiceId || action.actionId,
      index: action.payload?.index,
      issueEffect: action.payload?.issueEffect || {},
      followupIndex: (action.choiceId || action.actionId)?.match(/-X(\d+)$/)?.[1] ? Number((action.choiceId || action.actionId).match(/-X(\d+)$/)[1]) - 1 : undefined,
    }));
    const replayed = await page.evaluate(({ actions, caseId }) => window.__goldRuntime.replayPilotActions({ caseId, readExcerptIds: [], issue: {}, phase: 'reading', proceduralChoiceId: null, judgmentChoiceId: null, followupIndex: null }, actions), { actions, caseId: data.caseId });
    const finalHash = JSON.stringify({ readExcerptIds: observed.state.readExcerptIds, proceduralChoiceId: observed.state.proceduralChoiceId, judgmentChoiceId: observed.state.judgmentChoiceId, followupIndex: observed.state.followupIndex, issue: observed.issue, phase: observed.phase });
    const replayHash = JSON.stringify({ readExcerptIds: replayed.readExcerptIds, proceduralChoiceId: replayed.proceduralChoiceId, judgmentChoiceId: replayed.judgmentChoiceId, followupIndex: replayed.followupIndex, issue: replayed.issue, phase: replayed.phase });
    routes.push({ route, actionCount: actions.length, reducer: observed.reducer, observed: { state: observed.state, issue: observed.issue, phase: observed.phase }, replayed, finalHash, replayHash, hashMatch: finalHash === replayHash });
    await page.close();
  }
  cases.push({ caseId: data.caseId, routes });
}
const result = { version: 'v25', status: cases.every((item) => item.routes.every((route) => route.reducer === 'function' && route.hashMatch && route.observed.state.readExcerptIds.length === 5 && route.observed.phase === 'complete')) ? 'PASS' : 'FAIL', productionReducer: true, cases };
await writeFile('docs/v25/tests/independent_replay.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: result.status, cases: cases.length, routes: cases.reduce((count, item) => count + item.routes.length, 0) }, null, 2));
await browser.close();
if (result.status !== 'PASS') process.exitCode = 1;
