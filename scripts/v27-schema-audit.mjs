import fs from 'node:fs';

const bundle = JSON.parse(fs.readFileSync('data/v27-case-bundle.json', 'utf8'));
const cases = bundle.cases;
const year = (value) => Number(String(value).match(/\d{4}/)?.[0] ?? NaN);
const sceneEnd = (value) => Number([...String(value).matchAll(/\d{4}/g)].at(-1)?.[0] ?? NaN);
const csv = (rows) => rows.map((row) => row.map((value) => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}).join(',')).join('\n') + '\n';

const caseRows = [['caseId', 'date', 'titleKo', 'sourceStatus', 'normalRun', 'sourceCount', 'inWorldSourceCount', 'excerptCount', 'directExcerptCount', 'judgmentCount', 'blockReason']];
const sourceRows = [['caseId', 'sourceId', 'date', 'materialStatus', 'sceneRole', 'sourceRole', 'sourceType', 'authorOrSender', 'recipient', 'sourceCreationDate', 'availableToPlayerDate', 'arrivalBasis', 'displayCapability', 'rights', 'eligibleForInWorld', 'futureInWorld', 'excerptCount', 'url', 'locator']];
const judgmentRows = [['caseId', 'judgmentId', 'historicalQuestion', 'visibleText', 'text', 'issueKeys', 'issueDelta', 'evidenceExcerptIds', 'visibility', 'immediateConsequence', 'laterConsequence', 'hasJustification', 'hasRouteBasis', 'semanticStatus']];

for (const c of cases) {
  const inWorld = c.sources.filter((s) => s.sceneRole === 'IN_WORLD');
  const direct = c.excerpts.filter((e) => e.evidence === 'DIRECT');
  caseRows.push([c.caseId, c.date, c.titleKo, c.sourceStatus, bundle.normalRunCaseIds.includes(c.caseId) ? 'YES' : 'NO', c.sources.length, inWorld.length, c.excerpts.length, direct.length, c.judgments.length, c.blockReason ?? '']);
  for (const s of c.sources) {
    const future = s.sceneRole === 'IN_WORLD' && year(s.date) > sceneEnd(c.date);
    sourceRows.push([c.caseId, s.sourceId, s.date, s.materialStatus, s.sceneRole, s.sourceRole, s.sourceType, s.authorOrSender ?? '', s.recipient ?? '', JSON.stringify(s.sourceCreationDate ?? {}), s.availableToPlayerDate ?? '', s.arrivalBasis ?? '', s.displayCapability ?? '', s.rights ?? '', s.sceneRole === 'IN_WORLD' ? 'YES' : 'NO', future ? 'YES' : 'NO', c.excerpts.filter((e) => e.sourceId === s.sourceId).length, s.url, s.locator]);
  }
  for (const j of c.judgments) {
    const issue = j.effect?.issue ?? {};
    const issueKeys = Object.keys(issue);
    const validEvidence = (j.evidenceExcerptIds ?? []).every((id) => c.excerpts.some((e) => e.excerptId === id));
    const meaningful = issueKeys.length > 0 && Object.values(issue).every((value) => Number.isFinite(value) && value !== 0) && validEvidence && Boolean(j.justification) && Boolean(j.routeBasis);
    const required = ['historicalQuestion', 'visibleText', 'effectJustification', 'visibility', 'immediateConsequence', 'laterConsequence', 'alternateFollowUpIds'];
    const complete = required.every((field) => j[field] != null && j[field] !== '' && (!Array.isArray(j[field]) || j[field].length > 0));
    const specific = j.effectJustification && !/동시기 서신의 발언 주체·장르·시점을 분리해 읽는 판단|이 판단은 \d+개 발췌/.test(j.effectJustification);
    if (!complete) failures.push(`${c.caseId}/${j.id}: missing decision semantics field`);
    if (!specific) failures.push(`${c.caseId}/${j.id}: generic decision justification remains`);
    judgmentRows.push([c.caseId, j.id, j.historicalQuestion ?? '', j.visibleText ?? '', j.text, issueKeys.join('|'), JSON.stringify(issue), (j.evidenceExcerptIds ?? []).join('|'), j.visibility ?? '', j.immediateConsequence ?? '', j.laterConsequence ?? '', j.justification ? 'YES' : 'NO', j.routeBasis ? 'YES' : 'NO', meaningful && complete && specific ? 'MEANINGFUL' : 'REVIEW']);
  }
}

const allJudgments = cases.flatMap((c) => c.judgments);
const failures = [];
if (cases.length !== 24) failures.push(`expected 24 cases, got ${cases.length}`);
if (allJudgments.length !== 72) failures.push(`expected 72 judgments, got ${allJudgments.length}`);
if (sourceRows.slice(1).some((row) => row[15] === 'YES')) failures.push('future IN_WORLD source remains');
for (const c of cases) for (const s of c.sources) {
  const required = ['sourceId', 'titleRu', 'titleKo', 'publication', 'url', 'locator', 'sourceType', 'authorOrSender', 'sourceCreationDate', 'sourceRole', 'displayCapability', 'rights', 'arrivalBasis'];
  for (const field of required) if (s[field] == null || s[field] === '' || (field === 'authorOrSender' && s[field] === null)) failures.push(`${c.caseId}/${s.sourceId}: missing source schema field ${field}`);
  if (!['PRIMARY_IN_WORLD', 'CONTEMPORANEOUS_CONTEXT', 'LATER_CONTEXT', 'MODERN_ARCHIVE_COMMENTARY', 'METADATA_ONLY', 'VISUAL_REFERENCE'].includes(s.sourceRole)) failures.push(`${c.caseId}/${s.sourceId}: invalid sourceRole`);
  if (!['PERIOD_PRINT_SCAN', 'ORIGINAL_ARCHIVAL_IMAGE', 'SCHOLARLY_EDITION_PAGE_SCAN', 'MODERN_TRANSCRIPTION', 'CATALOG_LINK_ONLY'].includes(s.displayCapability)) failures.push(`${c.caseId}/${s.sourceId}: invalid displayCapability`);
  if (s.sceneRole === 'IN_WORLD' && !s.availableToPlayerDate) failures.push(`${c.caseId}/${s.sourceId}: in-world source lacks availableToPlayerDate`);
}
if (judgmentRows.slice(1).some((row) => row.at(-1) !== 'MEANINGFUL')) failures.push('one or more judgments lack semantic effect/evidence/justification');
if (cases.some((c) => c.excerpts.length < 5)) failures.push('case has fewer than five excerpts');

fs.mkdirSync('docs/v27', { recursive: true });
fs.writeFileSync('docs/v27/CASE_STATUS_V27.csv', csv(caseRows));
fs.writeFileSync('docs/v27/SOURCE_ELIGIBILITY_AUDIT.csv', csv(sourceRows));
fs.writeFileSync('docs/v27/DECISION_SEMANTICS_V27.csv', csv(judgmentRows));
const report = {
  schemaVersion: 'V27-SCHEMA-AUDIT-1',
  status: failures.length ? 'FAIL' : 'PASS',
  caseCount: cases.length,
  judgmentCount: allJudgments.length,
  normalRunCaseCount: bundle.normalRunCaseIds.length,
  verifiedOutsideNormalCount: cases.filter((c) => c.sourceStatus === 'VERIFIED_V27_NOT_IN_NORMAL_RUN').length,
  blockedCaseCount: cases.filter((c) => String(c.sourceStatus).startsWith('BLOCKED_')).length,
  sourceCount: sourceRows.length - 1,
  directExcerptCount: cases.flatMap((c) => c.excerpts).filter((e) => e.evidence === 'DIRECT').length,
  meaningfulJudgmentCount: judgmentRows.slice(1).filter((row) => row.at(-1) === 'MEANINGFUL').length,
  failures,
};
fs.writeFileSync('docs/v27/SCHEMA_AUDIT.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
