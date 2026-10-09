import fs from 'node:fs';
const bundle = JSON.parse(fs.readFileSync('data/v27-case-bundle.json', 'utf8'));
const failures = [];
const year = (v) => Number(String(v).match(/\d{4}/)?.[0] ?? NaN);
const sceneEnd = (v) => Number([...String(v).matchAll(/\d{4}/g)].at(-1)?.[0] ?? NaN);
if (bundle.cases.length !== 24) failures.push(`expected 24 cases, got ${bundle.cases.length}`);
if (bundle.normalRunCaseIds.length < 10 || bundle.normalRunCaseIds.length > 12) failures.push(`normal run must be 10–12 cases, got ${bundle.normalRunCaseIds.length}`);
for (const c of bundle.cases) {
  for (const s of c.sources ?? []) {
    if (!s.materialStatus || !s.sceneRole) failures.push(`${c.caseId}: missing source classification ${s.sourceId}`);
    if (s.sceneRole === 'IN_WORLD' && year(s.date) > sceneEnd(c.date)) failures.push(`${c.caseId}: future source remains IN_WORLD ${s.sourceId}`);
  }
  if (c.caseId === 'C23' && c.sources.some((s) => s.materialStatus === 'MODERN_ARCHIVE_COMMENTARY' && s.sceneRole === 'IN_WORLD')) failures.push('C23: archive commentary misclassified as in-world');
  if (c.availableInNormalRun && c.sourceStatus !== 'READY_V27') failures.push(`${c.caseId}: available case not READY_V27`);
  if (!c.availableInNormalRun && !String(c.sourceStatus).startsWith('BLOCKED_') && c.sourceStatus !== 'VERIFIED_V27_NOT_IN_NORMAL_RUN') failures.push(`${c.caseId}: unavailable case lacks explicit verified-or-blocked status`);
  for (const j of c.judgments ?? []) if (!j.effect?.issue || Object.keys(j.effect.issue).length === 0) failures.push(`${c.caseId}/${j.id}: judgment has no semantic state effect`);
}
const ready = bundle.cases.filter((c) => c.availableInNormalRun);
const verifiedOutsideNormal = bundle.cases.filter((c) => c.sourceStatus === 'VERIFIED_V27_NOT_IN_NORMAL_RUN');
const unavailable = bundle.cases.length - ready.length - verifiedOutsideNormal.length;
const readyRussian = ready.flatMap((c) => c.excerpts.filter((x) => x.evidence !== 'LATER_CONTEXT').map((x) => x.ru));
if (new Set(readyRussian).size !== readyRussian.length) failures.push('normal-run excerpt reuse remains');
const out = { schemaVersion: 'V27-CONTENT-ACCEPTANCE-1', status: failures.length ? 'FAIL' : 'PASS', normalRunCaseIds: bundle.normalRunCaseIds, unavailableCount: unavailable, verifiedOutsideNormalCount: verifiedOutsideNormal.length, readyExcerptRows: readyRussian.length, readyUniqueRussianExcerpts: new Set(readyRussian).size, failures };
fs.mkdirSync('docs/v27', { recursive: true });
fs.writeFileSync('docs/v27/CONTENT_ACCEPTANCE.json', JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
if (failures.length) process.exitCode = 1;
