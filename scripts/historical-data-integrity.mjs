import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../data/v6-gold-cases.json', import.meta.url)));
const failures = [];
const ids = new Set();
const sourceIds = new Set();
const caseIds = new Set();
const allowedRoles = new Set(['PRIMARY_IN_WORLD','PRIMARY_CONTEXT','LATER_CONTEXT','VISUAL_REFERENCE','SECONDARY_SCHOLARSHIP','SCAN_ONLY_PRIMARY']);
const allowedCapabilities = new Set(['LOCAL_ORIGINAL_IMAGE','REMOTE_ARCHIVE_VIEWER','MODERN_TRANSCRIPTION','METADATA_ONLY']);
const parseDate = value => /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value ?? '') ? new Date(`${value}-01-01`.replace(/-01-01-01$/, '-01-01')) : null;
for (const item of data.cases ?? []) {
  if (caseIds.has(item.caseId)) failures.push(`${item.caseId}: duplicate caseId`);
  caseIds.add(item.caseId);
  if (!item.sceneDate || !item.titleKo || item.sources?.length !== 3) failures.push(`${item.caseId}: requires title, sceneDate, and exactly 3 sources`);
  const localSources = new Set();
  for (const source of item.sources ?? []) {
    if (sourceIds.has(source.sourceId)) failures.push(`${source.sourceId}: duplicate sourceId`);
    sourceIds.add(source.sourceId);
    localSources.add(source.sourceId);
    for (const field of ['sourceId','titleRu','titleKo','sourceDate','authorOrIssuer','publication','page','archive','catalogId','stableUrl','locator','role','rights']) if (!source[field]) failures.push(`${source.sourceId}: missing ${field}`);
    if (!/^https:\/\//.test(source.stableUrl) || /https?:\/\/[^/]+\/?$/.test(source.stableUrl)) failures.push(`${source.sourceId}: stable URL is missing a record path`);
    if (!allowedRoles.has(source.role)) failures.push(`${source.sourceId}: invalid role ${source.role}`);
    if (!allowedCapabilities.has(source.displayCapability)) failures.push(`${source.sourceId}: invalid or missing displayCapability`);
    if (source.scanUrl && (!source.scanAccess || !source.catalogId || !source.locator)) failures.push(`${source.sourceId}: incomplete scan metadata`);
    const sourceYear = Number(source.sourceDate.slice(0,4));
    const sceneYear = Number(item.sceneDate.slice(0,4));
    if (sourceYear > sceneYear && source.role !== 'LATER_CONTEXT') failures.push(`${source.sourceId}: future source attached to runtime case`);
  }
  if (localSources.size !== 3) failures.push(`${item.caseId}: non-distinct source relation`);
  const localExcerpts = (item.excerpts ?? []).filter(excerpt => excerpt.caseId === item.caseId);
  if (localExcerpts.length !== 5) failures.push(`${item.caseId}: requires exactly 5 atomic excerpts`);
  const excerptIds = new Set();
  for (const excerpt of localExcerpts) {
    if (excerptIds.has(excerpt.excerptId) || ids.has(excerpt.excerptId)) failures.push(`${excerpt.excerptId}: duplicate excerptId`);
    ids.add(excerpt.excerptId); excerptIds.add(excerpt.excerptId);
    for (const field of ['excerptId','caseId','sourceId','translationId','sourceDate','sceneDate','ru','ko','locator','evidenceKind','displayMode']) if (!excerpt[field]) failures.push(`${excerpt.excerptId}: missing ${field}`);
    if (!localSources.has(excerpt.sourceId)) failures.push(`${excerpt.excerptId}: source relation is not atomic`);
    if (excerpt.caseId !== item.caseId) failures.push(`${excerpt.excerptId}: case relation mismatch`);
    if (excerpt.evidenceKind === 'PRIMARY_TEXT') {
      const source = item.sources.find(candidate => candidate.sourceId === excerpt.sourceId);
      if (!source || !['PRIMARY_IN_WORLD','PRIMARY_CONTEXT'].includes(source.role)) failures.push(`${excerpt.excerptId}: DIRECT/PRIMARY_TEXT is not backed by primary source`);
    }
    if (excerpt.runtime && (!excerpt.ru.trim() || !excerpt.ko.trim() || !excerpt.translationId)) failures.push(`${excerpt.excerptId}: runtime excerpt missing text/translation_id`);
    if (excerpt.runtime && sourceIds.size === 0) failures.push(`${excerpt.excerptId}: runtime excerpt has no source`);
  }
  if (!localExcerpts.some(excerpt => ['scan+transcription','scan-only'].includes(excerpt.displayMode))) failures.push(`${item.caseId}: no scan-backed display excerpt`);
  const metadataOnly = localExcerpts.filter(excerpt => excerpt.evidenceKind === 'ARCHIVAL_METADATA').length;
  const scanOnly = localExcerpts.filter(excerpt => excerpt.evidenceKind === 'SCAN_ONLY_PRIMARY').length;
  const primaryText = localExcerpts.filter(excerpt => excerpt.evidenceKind === 'PRIMARY_TEXT').length;
  if (item.caseId === 'E07' && (metadataOnly !== 5 || scanOnly !== 0 || primaryText !== 0)) failures.push(`${item.caseId}: archival classification counts are ${JSON.stringify({primaryText,scanOnly,metadataOnly})}`);
  for (const excerpt of localExcerpts) {
    const scene = item.subScenes?.find(candidate => candidate.excerptIds?.includes(excerpt.excerptId));
    const latest = scene?.sceneDate || excerpt.sceneDate || item.sceneDate;
    const end = item.sources.find(source => source.sourceId === excerpt.sourceId)?.sourceDateEnd || excerpt.sourceDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(end) && end > latest && excerpt.evidenceKind === 'PRIMARY_TEXT') failures.push(`${excerpt.excerptId}: primary text is future-dated for ${latest}`);
  }
  if ((item.decisions ?? []).length !== 3) failures.push(`${item.caseId}: requires 3 concrete decisions`);
  if (!item.followUp?.lines?.length || !item.followUp.sourceIds?.length) failures.push(`${item.caseId}: missing sourced follow-up dialogue`);
}
if (caseIds.size !== 3 || !['E02','E05','E07'].every(id => caseIds.has(id))) failures.push('gold cases must be exactly E02, E05, E07');
if (!(data.cases ?? []).some(item => (item.excerpts ?? []).some(excerpt => ['scan+transcription','scan-only'].includes(excerpt.displayMode)))) failures.push('gold set has no scan-backed display excerpt');
const evidenceClassCounts = Object.fromEntries([...new Set((data.cases ?? []).flatMap(item => item.excerpts ?? []).map(excerpt => excerpt.evidenceKind))].map(kind => [kind, (data.cases ?? []).flatMap(item => item.excerpts ?? []).filter(excerpt => excerpt.evidenceKind === kind).length]));
console.log(JSON.stringify({schemaVersion:data.schemaVersion,cases:data.cases.length,sources:sourceIds.size,excerpts:ids.size,evidenceClassCounts,failures}, null, 2));
if (failures.length) process.exit(1);
