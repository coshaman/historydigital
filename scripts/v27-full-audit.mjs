import fs from 'node:fs';
const x = JSON.parse(fs.readFileSync('data/v27-case-bundle.json', 'utf8'));
const excerpts = x.cases.flatMap((c) => (c.excerpts ?? []).map((e) => ({ ...e, caseId: c.caseId })));
const judgments = x.cases.flatMap((c) => (c.judgments ?? []).map((j) => ({ ...j, caseId: c.caseId })));
const reuse = [...new Map(excerpts.map((e) => [e.ru, [...(new Set(excerpts.filter((x) => x.ru === e.ru).map((x) => x.caseId)))]])).entries()].filter(([, cases]) => cases.length > 1).map(([ru, cases]) => ({ ru, cases }));
const report = {
  schemaVersion: 'V27-FULL-AUDIT-1',
  cases: x.cases.length,
  normalRunCaseIds: x.normalRunCaseIds,
  ready: x.cases.filter((c) => c.availableInNormalRun).length,
  blocked: x.cases.filter((c) => !c.availableInNormalRun).map((c) => ({ caseId: c.caseId, reason: c.blockReason })),
  excerptRows: excerpts.length,
  uniqueRussianExcerpts: new Set(excerpts.map((e) => e.ru)).size,
  crossCaseExcerptReuse: reuse,
  judgments: judgments.length,
  emptyIssueEffects: judgments.filter((j) => !Object.keys(j.effect?.issue ?? {}).length).length,
  routeSignalsWithoutIssue: judgments.filter((j) => j.routeSignal && !Object.keys(j.effect?.issue ?? {}).length).length,
  futureInWorld: x.cases.flatMap((c) => c.sources.filter((s) => s.sceneRole === 'IN_WORLD' && Number(String(s.date).match(/\d{4}/)?.[0]) > Number([...String(c.date).matchAll(/\d{4}/g)].at(-1)?.[0])).map((s) => ({ caseId: c.caseId, sourceId: s.sourceId }))),
};
fs.mkdirSync('docs/v27', { recursive: true });
fs.writeFileSync('docs/v27/FULL_AUDIT.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
