import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const bundle = read('data/v26-case-bundle.json').cases;
const corpus = read('data/corpus-manifest.json');
const excerpts = bundle.flatMap((c) => c.excerpts ?? []).map((x) => ({ ...x, caseId: bundle.find((c) => c.excerpts?.some((e) => e.excerptId === x.excerptId))?.caseId }));
const judgments = bundle.flatMap((c) => (c.judgments ?? []).map((j) => ({ ...j, caseId: c.caseId })));
const belinskyGogol = excerpts.filter((x) => /BELINSKY|GOGOL|Белин|Гогол/i.test(JSON.stringify(x)));
const emptyIssue = (j) => !j.effect?.issue || Object.keys(j.effect.issue).length === 0;
const dateYear = (value) => Number(String(value).match(/\d{4}/)?.[0] ?? NaN);
const parseSource = (s) => ({ sourceId: s.sourceId, date: s.date, year: dateYear(s.date), materialStatus: s.materialStatus ?? null, sceneRole: s.sceneRole ?? null });

const sourceEligibility = bundle.map((c) => {
  const sceneYear = dateYear(c.date);
  const sources = (c.sources ?? []).map(parseSource);
  return {
    caseId: c.caseId,
    date: c.date,
    sceneYear,
    sourceStatus: c.sourceStatus ?? null,
    missingSourceStatus: !c.sourceStatus,
    futureInWorld: sources.filter((s) => s.sceneRole === 'IN_WORLD' && Number.isFinite(s.year) && Number.isFinite(sceneYear) && s.year > sceneYear),
    missingSourceClassification: sources.filter((s) => !s.materialStatus || !s.sceneRole),
    sources,
  };
});

const judgmentTemplates = Object.entries(judgments.reduce((acc, j) => {
  const key = JSON.stringify(j.effect ?? {});
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {})).sort((a, b) => b[1] - a[1]).map(([effect, count]) => ({ effect: JSON.parse(effect), count }));

const report = {
  schemaVersion: 'V27-PHASE0-AUDIT-1',
  generatedAt: new Date().toISOString(),
  cases: bundle.length,
  excerptRows: excerpts.length,
  uniqueRussianExcerpts: new Set(excerpts.map((x) => x.ru)).size,
  excerptReuseRatio: Number((new Set(excerpts.map((x) => x.ru)).size / excerpts.length).toFixed(3)),
  belinskyGogolRows: belinskyGogol.length,
  belinskyGogolCases: [...new Set(belinskyGogol.map((x) => x.caseId))].sort(),
  judgments: judgments.length,
  emptyIssueEffects: judgments.filter(emptyIssue).length,
  routeSignals: judgments.filter((j) => j.routeSignal).length,
  routeSignalsWithoutIssueEffect: judgments.filter((j) => j.routeSignal && emptyIssue(j)).length,
  judgmentTemplates,
  missingSourceStatusCases: sourceEligibility.filter((x) => x.missingSourceStatus).map((x) => x.caseId),
  missingSourceClassificationCases: sourceEligibility.filter((x) => x.missingSourceClassification.length).map((x) => x.caseId),
  futureInWorldSources: sourceEligibility.flatMap((x) => x.futureInWorld.map((s) => ({ caseId: x.caseId, sceneDate: x.date, ...s }))),
  sourceEligibility,
  reproduction: {
    belinskyGogolReuseConfirmed: belinskyGogol.length === 59 && new Set(belinskyGogol.map((x) => x.caseId)).size === 12,
    v26ReadyInflationConfirmed: bundle.filter((x) => String(x.sourceStatus ?? '').startsWith('READY')).length === 21 && sourceEligibility.some((x) => x.missingSourceStatus),
    countOnlyRouteRiskConfirmed: judgments.filter((j) => j.routeSignal && emptyIssue(j)).length === judgments.filter((j) => j.routeSignal).length,
  },
};

fs.mkdirSync(path.join(root, 'docs', 'v27'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'v27', 'BASELINE_VERIFIED.json'), JSON.stringify(report, null, 2) + '\n');
const md = [
  '# V27 Phase 0 — Baseline failure ledger',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '| Check | Reproduced value | Status |',
  '|---|---:|---|',
  `| Cases | ${report.cases} | FAIL: V27 requires a 10–12 case normal run |`,
  `| Excerpt rows | ${report.excerptRows} | FAIL |`,
  `| Unique Russian excerpts | ${report.uniqueRussianExcerpts} | FAIL: ${report.excerptRows - report.uniqueRussianExcerpts} duplicate rows |`,
  `| Belinsky/Gogol rows | ${report.belinskyGogolRows} across ${report.belinskyGogolCases.length} cases | FAIL |`,
  `| Judgments | ${report.judgments} | FAIL: generic carry-over structure |`,
  `| Empty issue effects | ${report.emptyIssueEffects} | FAIL |`,
  `| Route signals without issue effect | ${report.routeSignalsWithoutIssueEffect} | FAIL |`,
  `| Missing sourceStatus | ${report.missingSourceStatusCases.length} cases (${report.missingSourceStatusCases.join(', ') || 'none'}) | ${report.missingSourceStatusCases.length ? 'FAIL' : 'PASS'} |`,
  `| Missing material/scene classification | ${report.missingSourceClassificationCases.length} cases (${report.missingSourceClassificationCases.join(', ') || 'none'}) | ${report.missingSourceClassificationCases.length ? 'FAIL' : 'PASS'} |`,
  `| Future IN_WORLD sources | ${report.futureInWorldSources.length} rows | FAIL |`,
  '',
  '## Immediate quarantine decisions',
  '',
  '- V26 READY labels are not accepted as historical proof.',
  '- The V26 five-ending smoke is not an acceptance test because it injects route targets instead of deriving endings from player state.',
  '- Modern archive commentary and later scholarship cannot supply an in-world direct quotation.',
  '- The 24-case forced journey is not the V27 normal run; cases must be selected by authored availability and route progression.',
  '',
  'The JSON file contains the per-case source-date ledger and exact reproduction data used for Phase 1 repairs.',
].join('\n') + '\n';
fs.writeFileSync(path.join(root, 'docs', 'v27', 'FAILURE_LEDGER.md'), md);
console.log(JSON.stringify({ ...report, sourceEligibility: undefined }, null, 2));
