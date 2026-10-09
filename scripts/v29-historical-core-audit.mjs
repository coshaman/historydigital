import fs from 'node:fs/promises';

const bundle = JSON.parse(await fs.readFile('data/v27-case-bundle.json', 'utf8'));
const coreIds = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C14', 'C17', 'C21', 'C19', 'C24'];
const failures = [];
const cases = [];
for (const caseId of coreIds) {
  const item = bundle.cases.find(entry => entry.caseId === caseId);
  if (!item) { failures.push(`${caseId}: missing case`); continue; }
  const sourceMap = new Map((item.sources || []).map(source => [source.sourceId, source]));
  const excerpts = item.excerpts || [];
  const bad = [];
  for (const excerpt of excerpts) {
    const source = sourceMap.get(excerpt.sourceId);
    if (!source) bad.push(`${excerpt.excerptId}: missing source`);
    if (!excerpt.locator || !excerpt.ru || !excerpt.ko) bad.push(`${excerpt.excerptId}: incomplete RU/KO/locator`);
    if (!source?.url) bad.push(`${excerpt.excerptId}: missing source URL`);
    const isDirect = excerpt.quotationStatus === 'DIRECT' || excerpt.evidence === 'DIRECT' || excerpt.evidence === 'DIRECT_PRIMARY_SCAN';
    const isModern = excerpt.quotationStatus === 'NOT_A_DIRECT_QUOTATION' || excerpt.evidence === 'MODERN_COMMENTARY_OR_ARCHIVE_DESCRIPTION';
    if (isDirect && isModern) bad.push(`${excerpt.excerptId}: contradictory direct/modern labels`);
    if (isDirect && caseId === 'C24' && (excerpt.evidence !== 'DIRECT_PRIMARY_SCAN' || !excerpt.scanUrl)) bad.push(`${excerpt.excerptId}: C24 direct record lacks scan provenance`);
  }
  if (excerpts.length < 5) bad.push(`excerpt count ${excerpts.length} < 5`);
  if (bad.length) failures.push(...bad.map(message => `${caseId}: ${message}`));
  cases.push({ caseId, eventDate: item.date, excerptCount: excerpts.length, sourceCount: sourceMap.size, directExcerptCount: excerpts.filter(excerpt => excerpt.evidence === 'DIRECT' || excerpt.evidence === 'DIRECT_PRIMARY_SCAN').length, modernDescriptionCount: excerpts.filter(excerpt => excerpt.evidence === 'MODERN_COMMENTARY_OR_ARCHIVE_DESCRIPTION').length, failures: bad, status: bad.length ? 'FAIL' : 'PASS' });
}
const report = { schemaVersion: 'V29-HISTORICAL-CORE-AUDIT-1', generatedAt: new Date().toISOString(), status: failures.length ? 'FAIL' : 'PASS', coreCaseCount: coreIds.length, distinctExcerptCount: new Set(cases.flatMap(item => (bundle.cases.find(entry => entry.caseId === item.caseId)?.excerpts || []).map(excerpt => excerpt.excerptId))).size, cases, failures, limitation: 'This is a checked-in provenance/schema audit; it does not replace a historian or human playtest.' };
await fs.mkdir('docs/v29', { recursive: true });
await fs.writeFile('docs/v29/HISTORICAL_CORE_AUDIT.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
