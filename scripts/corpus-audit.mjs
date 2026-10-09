import { readFile } from 'node:fs/promises';

const corpus = JSON.parse(await readFile(new URL('../data/corpus-manifest.json', import.meta.url)));
let candidateExcerpts = [];
try { candidateExcerpts = JSON.parse(await readFile(new URL('../data/excerpt-candidates.json', import.meta.url))); } catch {}
let translationReview = [];
try { translationReview = JSON.parse(await readFile(new URL('../data/excerpt-translation-review.json', import.meta.url))); } catch {}
const failures = [];
const objects = new Map(corpus.sourceObjects.map(source => [source.id, source]));
const required = ['id','title_ru','date','author_or_issuer','publication','city','source_type','archive','catalog_id','stable_url','rights','original_language','provenance','verified_on','case_pack_ids'];
const ids = new Set();
for (const source of corpus.sourceObjects) {
  for (const field of required) if (!source[field]) failures.push(`${source.id}: missing ${field}`);
  if (ids.has(source.id)) failures.push(`${source.id}: duplicate source object id`);
  ids.add(source.id);
  if (!/^https:\/\//.test(source.stable_url)) failures.push(`${source.id}: invalid stable_url`);
  if (source.scan_url && !source.scan_access) failures.push(`${source.id}: scan_url without scan_access`);
  for (const caseId of source.case_pack_ids ?? []) if (!corpus.casePacks.some(pack => pack.id === caseId)) failures.push(`${source.id}: unknown case ${caseId}`);
}
const caseIds = new Set();
for (const pack of corpus.casePacks) {
  if (caseIds.has(pack.id)) failures.push(`${pack.id}: duplicate case id`);
  caseIds.add(pack.id);
  if (!pack.title_ko || !pack.year || !pack.status) failures.push(`${pack.id}: incomplete case header`);
  if ((pack.sourceObjectIds ?? []).length < 4) failures.push(`${pack.id}: fewer than four source objects`);
  for (const sourceId of pack.sourceObjectIds ?? []) if (!objects.has(sourceId)) failures.push(`${pack.id}: unknown source object ${sourceId}`);
}
if (corpus.casePacks.length !== 24) failures.push(`case pack count ${corpus.casePacks.length}, expected 24`);
if (corpus.policy?.unverifiedExcerptPolicy !== 'do-not-invent') failures.push('unverified excerpt policy is not explicit');
const scanObjects = corpus.sourceObjects.filter(source => source.scan_url && source.scan_access);
const sourceRecords = corpus.sourceObjects.flatMap(source => {
  const plan = source.record_unit_plan;
  if (!plan?.count) return [];
  return Array.from({length: plan.count}, (_, index) => ({
    id: `${source.id}::${String(index + 1).padStart(3, '0')}`,
    sourceObjectId: source.id,
    locator: plan.locator_template.replace('{page}', String(index + 1)).replace('{unit}', String(index + 1)).replace('{volume}', source.id === 'OBJ-SOV-1847' ? String(Math.ceil((index + 1) / 2)) : '61').replace('{issue}', String(index + 1)),
    scanBacked: Boolean(source.scan_url && source.scan_access),
    transcriptionStatus: source.source_type === 'visual-reference' ? 'image-reference' : 'not-yet-transcribed'
  }));
});
const categoryTargets = {periodical:60, 'letter-transcription':35, letter:35, administrative:30, 'administrative-and-police-file':30, book:25, 'book-transcription':25, map:30, 'visual-reference':30};
const categoryCounts = Object.fromEntries(Object.keys(categoryTargets).map(category => [category, sourceRecords.filter(record => objects.get(record.sourceObjectId)?.source_type === category).length]));
const casesBelowFourRecords = corpus.casePacks.filter(pack => {
  const records = sourceRecords.filter(record => pack.sourceObjectIds.includes(record.sourceObjectId));
  return records.length < 4;
});
const excerptUnits = corpus.excerptUnits ?? [];
const allRuExcerpts = [...excerptUnits, ...candidateExcerpts];
const translationMap = new Map(translationReview.map(unit => [unit.id, unit]));
const translationUnits = [...excerptUnits.filter(unit => unit.natural_ko), ...candidateExcerpts.filter(unit => translationMap.has(unit.id))];
const excerptIds = new Set();
const excerptTexts = new Set();
for (const excerpt of allRuExcerpts) {
  for (const field of ['id','sourceObjectId','locator','ru_excerpt','source_context_note','evidence_class','translation_status']) {
    if (!excerpt[field]) failures.push(`${excerpt.id ?? 'excerpt'}: missing ${field}`);
  }
  if (excerptIds.has(excerpt.id)) failures.push(`${excerpt.id}: duplicate excerpt id`);
  excerptIds.add(excerpt.id);
  const textKey = `${excerpt.sourceObjectId}:${excerpt.ru_excerpt}`;
  if (excerptTexts.has(textKey)) failures.push(`${excerpt.id}: duplicate source excerpt text`);
  excerptTexts.add(textKey);
  if (!objects.has(excerpt.sourceObjectId)) failures.push(`${excerpt.id}: unknown source object ${excerpt.sourceObjectId}`);
  if (!['DIRECT','PARAPHRASE'].includes(excerpt.evidence_class)) failures.push(`${excerpt.id}: excerpt evidence class must be DIRECT or PARAPHRASE`);
  if (excerpt.translation_status === 'reviewed-draft' && !excerpt.natural_ko) failures.push(`${excerpt.id}: reviewed translation missing natural_ko`);
}
for (const review of translationReview) {
  const candidate = candidateExcerpts.find(unit => unit.id === review.id);
  if (!candidate) failures.push(`${review.id}: translation review has no candidate`);
  if (!review.natural_ko || !review.review_note) failures.push(`${review.id}: incomplete translation review`);
}
if (sourceRecords.length < 150) failures.push(`source record count ${sourceRecords.length}, target 150`);
if (sourceRecords.filter(record => record.scanBacked).length < 100) failures.push(`scan-backed source record count ${sourceRecords.filter(record => record.scanBacked).length}, target 100`);
if (casesBelowFourRecords.length) failures.push(`cases below four indexed records: ${casesBelowFourRecords.map(pack => pack.id).join(', ')}`);
if (allRuExcerpts.length < 220) failures.push(`RU excerpt count ${allRuExcerpts.length}, target 220`);
if (translationUnits.length < 220) failures.push(`KO translation count ${translationUnits.length}, target 220`);
for (const [category, target] of Object.entries(categoryTargets)) {
  const count = categoryCounts[category] ?? 0;
  if (count < target && !['letter','administrative-and-police-file','book-transcription'].includes(category)) failures.push(`${category} record count ${count}, target ${target}`);
}
console.log(JSON.stringify({
  schemaVersion: corpus.schemaVersion,
  sourceObjects: corpus.sourceObjects.length,
  sourceRecords: sourceRecords.length,
  scanBackedObjects: scanObjects.length,
  scanBackedRecords: sourceRecords.filter(record => record.scanBacked).length,
  categoryCounts,
  casePacks: corpus.casePacks.length,
  casesBelowFourRecords: casesBelowFourRecords.length,
  pendingArchiveItems: corpus.sourceObjects.filter(source => /pending/i.test(source.provenance) || /pending/i.test(source.rights)).length,
  excerptUnits: allRuExcerpts.length,
  translationPendingUnits: candidateExcerpts.filter(unit => !translationMap.has(unit.id)).length,
  translationUnits: translationUnits.length,
  failures
}, null, 2));
if (failures.length) process.exit(1);
