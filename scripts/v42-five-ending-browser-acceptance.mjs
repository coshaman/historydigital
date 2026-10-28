import fs from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4173/?main20=1&v42fresh=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20?.data));
  const report = await page.evaluate(() => {
    const data = window.__main20.data;
    return Object.fromEntries(data.endings.map(ending => {
      const profile = data.endingIdeologyProfiles[ending.id];
      const rule = { ...ending.rule, ...profile };
      const requiredActions = [...new Set([...(rule.requiredActions || rule.actionsAll || []), ...(rule.actionGate?.all || [])])];
      const history = requiredActions.map((action, index) => ({ sceneId: ['C07', 'E02', 'E04', 'E07', 'V42-PROLOGUE-CHAADAEV'][index % 5], kind: 'post_read_choice', choiceKind: 'ACTION', action, endingAffinity: { [ending.id]: 2 } }));
      while (history.length < Math.max(5, rule.minScenes || 0)) history.push({ sceneId: 'E07', kind: 'post_read_choice', choiceKind: 'ACTION', action: `review_support_${history.length}`, endingAffinity: { [ending.id]: 1 } });
      const ideology = Object.fromEntries(data.ideologyDimensions.map(key => [key, 0]));
      for (const [key, value] of Object.entries(profile.ideologyGate || {})) ideology[key] = value;
      const ideologyEvidence = profile.beliefLedgerLabels.map((statement, index) => ({ statement, choiceId: `AUDIT-${ending.id}-${index}`, callbackKey: `AUDIT_${ending.id}_${index}`, sceneId: ['V42-PROLOGUE-CHAADAEV', 'C07', 'E07'][index] }));
      const candidate = { history, flags: [...(rule.allFlags || [])], relationships: { alexei: 8, ekaterina: 8, pavel: 8, ...(rule.relationshipGate || {}) }, ideology, ideologyEvidence, beliefs: ideologyEvidence, actions: history.map(item => item.action), visibleCallbacks: ideologyEvidence.map(item => item.callbackKey) };
      const result = window.__main20.resolveEndingDetailedFor(candidate);
      return [ending.id, { resolved: result.endingId, strongGateSatisfied: result.strongGateSatisfied, strongMatches: result.strongMatches, beliefCount: result.beliefLedger.length, actionCount: result.actionEvidence.length, callbackCount: result.callbackEvidence.length }];
    }));
  });
  const failures = Object.entries(report).flatMap(([id, result]) => [result.resolved !== id ? `${id}: resolved ${result.resolved}` : null, !result.strongGateSatisfied ? `${id}: strong gate not satisfied` : null, result.beliefCount < 3 ? `${id}: fewer than three beliefs` : null, result.actionCount < 2 ? `${id}: fewer than two actions` : null, result.callbackCount < 1 ? `${id}: missing callback` : null].filter(Boolean));
  const output = { status: failures.length === 0, mode: 'resolver contract across all five authored endings', report, failures };
  fs.mkdirSync('artifacts/v42-browser', { recursive: true });
  fs.writeFileSync('artifacts/v42-browser/five-endings.json', JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  if (failures.length) process.exitCode = 1;
} finally { await browser.close(); }
