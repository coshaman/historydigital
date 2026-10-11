import fs from 'node:fs';
import { chromium } from 'playwright';

const routes = {
  UVAROV: { C03: [0, 0], C06: [0, 0], C07: [0, 0], E02: [1, 1], E07: [1, 1] },
  BELINSKY: { C03: [1, 1], C06: [1, 1], C07: [1, 1], E02: [0, 0], E07: [0, 0] },
  HERZEN: { C03: [2, 2], C06: [2, 2], C07: [2, 2], E02: [2, 2], E07: [2, 2] },
  KHOMYAKOV: { C03: [1, 1], C06: [1, 1], C07: [2, 2], E02: [1, 1], E07: [3, 3] },
  DOSTOEVSKY_PETRASHEVSKY: { C03: [2, 2], C06: [2, 2], C07: [1, 1], E02: [0, 2], E07: [0, 0] }
};
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173/?main20=1&v42fresh=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__main20?.data), { timeout: 12000 });
const report = await page.evaluate((routes) => {
  const data = window.__main20.data;
  const result = {};
  for (const [endingId, route] of Object.entries(routes)) {
    const history = [];
    const flags = [];
    const relationships = { alexei: 8, ekaterina: 8, pavel: 8 };
    for (const scene of data.scenes) {
      const [primaryIndex, postIndex] = route[scene.id];
      for (const choice of [scene.choices[primaryIndex], scene.postChoices[postIndex]]) {
        history.push({ sceneId: scene.id, kind: 'post_read_choice', action: choice.action, flags: choice.flagsAdd || [], endingAffinity: choice.endingAffinity || {}, actor: choice.actor, witnesses: choice.witnesses, visibility: choice.visibility });
        flags.push(...(choice.flagsAdd || []));
        for (const [person, amount] of Object.entries(choice.relationship || {})) relationships[person] += amount;
      }
    }
    const profile = data.endingIdeologyProfiles[endingId];
    const ideology = Object.fromEntries(data.ideologyDimensions.map((key) => [key, 0]));
    for (const [key, amount] of Object.entries(profile.ideologyGate)) ideology[key] = amount;
    const ideologyEvidence = profile.beliefLedgerLabels.map((statement, index) => ({ statement, choiceId: `V42-TEST-${endingId}-${index}`, callbackKey: `TEST_${endingId}_${index}`, sceneId: ['V42-PROLOGUE-CHAADAEV', 'C07', 'E07'][index] }));
    const source = { history, flags: [...new Set(flags)], relationships, ideology, ideologyEvidence, visibleCallbacks: ideologyEvidence.map((item) => item.callbackKey) };
    const detail = window.__main20.resolveEndingDetailedFor(source);
    result[endingId] = { resolved: detail.endingId, beliefCount: detail.beliefLedger.length, actionCount: detail.actionEvidence.length, callbackCount: detail.callbackEvidence.length, strongGateSatisfied: detail.strongGateSatisfied, strongMatches: detail.strongMatches };
  }
  return result;
}, routes);
await browser.close();
const failures = Object.entries(report).flatMap(([id, result]) => [
  result.resolved !== id ? `${id}: resolved ${result.resolved}` : null,
  result.beliefCount < 3 ? `${id}: fewer than three beliefs` : null,
  result.actionCount < 2 ? `${id}: fewer than two actions` : null,
  result.callbackCount < 1 ? `${id}: missing callback` : null,
  !result.strongGateSatisfied ? `${id}: strong gate not satisfied` : null
].filter(Boolean));
const output = { status: failures.length === 0, report, failures };
fs.mkdirSync('artifacts/v42-browser', { recursive: true });
fs.writeFileSync('artifacts/v42-browser/five-endings.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exit(1);
