import { readFile, writeFile } from 'node:fs/promises';

const readJson = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const model = await readJson('data/press-decision-model.json');
const runtime = await readJson('data/runtime-dialogue.json');
const corpus = await readJson('data/corpus-manifest.json');
const pilot = await readJson('data/v25-pilot-cases.json');
const overrides = await readJson('data/v26-case-overrides.json');
const corpusById = new Map(corpus.sourceObjects.map(source => [source.id, source]));
const pilotById = new Map(pilot.cases.map(item => [item.caseId, item]));
const runtimeById = new Map(runtime.cases.map(item => [item.id, item]));

const koTitle = source => source?.title_ko || source?.titleKo || source?.title_ru || source?.titleRu || source?.id;
const toSource = id => {
  const source = corpusById.get(id);
  if (!source) return null;
  return {
    sourceId: source.id,
    titleKo: koTitle(source),
    titleRu: source.title_ru,
    publication: source.publication,
    date: source.date,
    url: source.stable_url,
    locator: source.record_unit_plan?.locator_template || source.catalog_id,
    materialStatus: source.source_type === 'visual-reference' ? 'VISUAL_REFERENCE' : 'MODERN_TRANSCRIPTION',
    sceneRole: 'IN_WORLD',
    acquisitionBasis: source.provenance,
    imageStatus: source.scan_url ? 'CATALOG_OR_VIEWER_LINK' : 'NOT_CONNECTED'
  };
};

const makeGeneric = item => {
  const runtimeCase = runtimeById.get(item.id);
  const allDirect = (runtimeCase?.lines || []).filter(line => line.evidence_class === 'DIRECT' && line.original && !line.original.includes('...') && !line.original.includes('…') && !line.text.includes('...') && !line.text.includes('…'));
  const direct = [];
  const seenSources = new Set();
  for (const line of allDirect) {
    const sourceId = line.source_ids?.[0];
    if (sourceId && !seenSources.has(sourceId)) {
      direct.push(line);
      seenSources.add(sourceId);
    }
  }
  for (const line of allDirect) {
    if (direct.length >= 5) break;
    if (!direct.includes(line)) direct.push(line);
  }
  const sourceIds = [...new Set(direct.flatMap(line => line.source_ids || []))];
  const sources = sourceIds.map(toSource).filter(Boolean).slice(0, 3);
  const excerpts = direct.map((line, index) => ({
    excerptId: `V26-${item.id}-X${index + 1}`,
    sourceId: line.source_ids?.find(id => sources.some(source => source.sourceId === id)) || sources[0]?.sourceId,
    locator: line.locator || `runtime dialogue direct excerpt ${index + 1}`,
    ru: line.original,
    ko: line.text,
    context: `기존 검증 대화의 직접 인용 ${index + 1} · ${item.title}`,
    evidence: 'DIRECT',
    quotationStatus: 'VERBATIM',
    translationReview: 'REVIEWED'
  }));
  const reviews = item.review || [];
  const route = item.choiceRoutes || [];
  const judgments = [0, 1, 2].map(index => ({
    id: `V26-${item.id}-J${index + 1}`,
    text: reviews[index % reviews.length] || `자료의 범위를 확인한 뒤 ${index + 1}번 기록으로 남긴다.`,
    evidenceExcerptIds: excerpts.slice(0, Math.min(2 + index, excerpts.length)).map(excerpt => excerpt.excerptId),
    effect: { issue: {}, institutional: { recordTrail: 1 } },
    routeSignal: route[index] || null,
    whatPlayerBelieves: `이 케이스의 ${reviews[index % reviews.length] || '자료 범위'}를 기록상 판단으로 남긴다.`,
    visibleToWhom: 'fictional clerk record only',
    whyEffectsFollow: '판단 자체는 비공개 기록으로 남고, 자료를 확인했다는 행위만 접수 이력에 반영된다.',
    laterConsequence: `후속 자료에서 ${route[index] || '기록 경로'} 접근 신호를 확인한다.`
  }));
  return {
    caseId: item.id,
    casePackId: item.casePackId,
    sceneId: `V26-${item.id}`,
    date: item.year,
    titleRu: item.title,
    titleKo: item.title,
    question: item.lead,
    sourceStatus: excerpts.length < 5 ? 'BLOCKED_INCOMPLETE_EXCERPTS' : sources.length >= 2 ? 'READY_WITH_EXISTING_VERIFIED_RECORDS' : 'BLOCKED_SOURCE_DIVERSITY',
    sources,
    excerpts,
    proceduralChoices: [
      `${item.review?.[0] || '발신 경로'}를 먼저 확인해 접수한다.`,
      `${item.review?.[1] || '문서의 날짜'}를 별도 칸에 남겨 대조한다.`,
      `${item.escalation || '확인된 범위만 상신한다.'}`
    ],
    judgments,
    followups: [
      `${item.privateResponse || '개인 기록'}은 공식 판단과 분리해 보관한다.`,
      `${item.escalation || '상급자에게 확인된 자료만 상신한다.'} 후속 자료의 도착 경로를 남긴다.`,
      `${item.dialogueHook || '전달자의 말'}을 사실과 추정으로 나누어 다음 기록에 연결한다.`
    ],
    provenance: {
      sourceRecordIds: sources.map(source => source.sourceId),
      directExcerptCount: excerpts.length,
      note: '기존 체크인 데이터에서 추출한 원문·번역 pair; 원자료별 대표 인용을 우선 선택했으며 새 사료를 생성하지 않음.'
    }
  };
};

const bundle = model.cases.map(item => overrides.cases[item.id] ? { caseId:item.id, casePackId:item.casePackId, sceneId:`V26-${item.id}`, date:item.year, titleRu:item.title, titleKo:item.title, question:item.lead, ...overrides.cases[item.id], provenance:{ sourceRecordIds:overrides.cases[item.id].sources.map(source=>source.sourceId), directExcerptCount:overrides.cases[item.id].excerpts.length, note:'V26 override from checked-in source record; no synthetic quotation.' } } : pilotById.has(item.id) ? pilotById.get(item.id) : makeGeneric(item));
await writeFile(new URL('../data/v26-case-bundle.json', import.meta.url), `${JSON.stringify({ schemaVersion: 'v26-content-bundle-1', cases: bundle }, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', cases: bundle.length, ready: bundle.filter(item => !String(item.sourceStatus || '').startsWith('BLOCKED_')).length, blocked: bundle.filter(item => String(item.sourceStatus || '').startsWith('BLOCKED_')).map(item => item.caseId) }, null, 2));
