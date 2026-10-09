import fs from 'node:fs';

const graph = JSON.parse(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json', 'utf8'));
const bundle = JSON.parse(fs.readFileSync('data/v27-case-bundle.json', 'utf8'));
const failures = [];
const cases = graph.cases.map((item) => {
  const sourceIds = new Set(item.sourceIds || []);
  const original = bundle.cases.find((candidate) => candidate.caseId === item.caseId);
  const sourceSet = new Set((original?.sources || []).map((source) => source.sourceId));
  const excerptSet = new Set((original?.excerpts || []).map((excerpt) => excerpt.excerptId));
  const claims = item.nodes.flatMap((node) => node.historicalClaims || []);
  const invalidClaims = claims.filter((claim) => !sourceSet.has(claim.sourceId) || (claim.excerptId && !excerptSet.has(claim.excerptId)));
  const result = { caseId: item.caseId, sourceIds: [...sourceIds], historicalExcerptIds: item.historicalExcerptIds || [], claimCount: claims.length, invalidClaims };
  if (!sourceIds.size) failures.push(`${item.caseId}: no sourceIds`);
  if (!(item.historicalExcerptIds || []).length) failures.push(`${item.caseId}: no historicalExcerptIds`);
  if (invalidClaims.length) failures.push(`${item.caseId}: invalid historical claims`);
  return result;
});
const report = { schemaVersion: 'V28-PROVENANCE-AUDIT-1', status: failures.length ? 'FAIL' : 'PASS', caseCount: cases.length, cases, failures };
fs.writeFileSync('docs/v28/PROVENANCE_AUDIT.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, caseCount: report.caseCount, claims: cases.reduce((sum, item) => sum + item.claimCount, 0), failures }, null, 2));
if (report.status !== 'PASS') process.exit(1);
