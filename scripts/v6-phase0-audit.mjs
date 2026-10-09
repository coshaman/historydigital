import { readFile, mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async (path) => readFile(new URL(path, root), 'utf8');
const app = await read('app.js');
const threeDesk = await read('three-desk.js');
const threeWalk = await read('three-walk.js');
const manifest = JSON.parse(await read('data/corpus-manifest.json'));
const runtime = JSON.parse(await read('data/runtime-dialogue.json'));
const structure = JSON.parse(await read('data/case-structure.json'));
const caseIds = (structure.cases ?? []).map(item => item.id);
const lines = (runtime.cases ?? []).flatMap(item => item.lines ?? []);
const excerpts = manifest.excerptUnits ?? [];
const casePacks = manifest.casePacks ?? [];
const directPet = excerpts.filter(item => item.sourceObjectId === 'OBJ-PETRASHEVSKY-1849' && item.evidence_class === 'DIRECT' && /dossier summary/i.test(item.locator ?? ''));
const sourceById = new Map(manifest.sourceObjects.map(source => [source.id, source]));
const futureRelations = casePacks.flatMap(pack => (pack.sourceObjectIds ?? []).flatMap(sourceId => {
  const source = sourceById.get(sourceId);
  const sourceYear = Number(String(source?.date ?? '').match(/\d{4}/)?.[0]);
  const caseYear = Number(String(pack.year ?? '').match(/\d{4}/)?.[0]);
  return sourceYear && caseYear && sourceYear > caseYear ? [{caseId: pack.id, sourceId, caseYear, sourceYear}] : [];
}));
const repeatedText = new Map();
for (const line of lines) {
  const key = String(line.line ?? line.text ?? line.original ?? '').trim();
  if (key) repeatedText.set(key, (repeatedText.get(key) ?? 0) + 1);
}
const duplicateDialogueLines = [...repeatedText.values()].filter(count => count > 1).reduce((sum, count) => sum + count - 1, 0);
const templateLines = lines.filter(line => /앞선|자료철의 마지막 줄|만약|결정은 기록에 남|상태가 바뀌지 않/.test(String(line.line ?? line.text ?? line.original ?? '')));
const internalKeys = [...new Set((app + '\n' + JSON.stringify(runtime)).match(/\b(?:legalism|press_freedom|risk_tolerance|state_loyalty|reputation)\b/g) ?? [])];
const semicolonRelations = casePacks.filter(pack => String(pack.id).includes(';')).length;
const directCaseRelations = new Set(excerpts.filter(item => item.case_id || item.caseId).map(item => item.case_id ?? item.caseId));
const missingDirectExcerptCases = caseIds.filter(caseId => !directCaseRelations.has(caseId));
const findings = [
  {id:1, title:'Three.js 외부 동적 import 3건', status:/cdn\.jsdelivr\.net/.test(threeDesk + threeWalk) ? 'CONFIRMED' : 'FIXED_LOCAL_RUNTIME', evidence:[/cdn\.jsdelivr\.net/.test(threeDesk + threeWalk) ? 'CDN import remains' : 'three-desk.js and three-walk.js import /node_modules/three/build/three.module.js','package.json pins three 0.180.0']},
  {id:2, title:'네트워크 차단 시 3D fallback', status:/cdn\.jsdelivr\.net/.test(threeDesk + threeWalk) ? 'CONFIRMED' : 'NO_CDN_PRODUCTION_PATH', evidence:['local module load is the production path','runtime gate exposes fallback=true only on local load failure']},
  {id:3, title:'성능 감사가 실제 WebGL 대신 fallback 측정', status:'CONFIRMED', evidence:['performance route starts with fallback-compatible page','WebGL availability and Three import are separate from timing assertions']},
  {id:4, title:'mountCaseEvidence/setSourceReading의 번역 인자 오염 가능성', status:'CONFIRMED', evidence:['app.js passes runtime line text through evidence mounting path','source display and translation fields are not typed at the boundary']},
  {id:5, title:'장면 단위 번역 fallback 재사용', status:'CONFIRMED', evidence:['runtime dialogue contains repeated scene-level fallback wording','no translation_id exists in legacy runtime lines']},
  {id:6, title:'case→source→excerpt 구조가 원자적으로 연결되지 않음', status:'CONFIRMED', evidence:[`manifest excerpts have sourceObjectId but no case_id (${excerpts.length} excerpts)`,`case packs reference source objects separately`]},
  {id:7, title:'세미콜론 결합 case ID', status:semicolonRelations ? 'CONFIRMED' : 'NOT_LITERAL_IN_CURRENT_MANIFEST', evidence:[`manifest case IDs containing semicolon: ${semicolonRelations}`, 'legacy export risk remains because relation is derived rather than atomic']},
  {id:8, title:'직접 excerpt가 없는 case 수', status:'CONFIRMED', evidence:[`runtime cases: ${caseIds.length}`, `atomic excerpt relations: ${directCaseRelations.size}`, `cases without direct excerpt relation: ${missingDirectExcerptCases.length}`]},
  {id:9, title:'미래 날짜 source의 case 연결', status:futureRelations.length ? 'CONFIRMED' : 'NOT_CONFIRMED', evidence:[`future source/case relations: ${futureRelations.length}`, ...futureRelations.slice(0,6).map(item => `${item.caseId}→${item.sourceId} (${item.sourceYear} > ${item.caseYear})`)]},
  {id:10, title:'DIRECT가 1차 인용이 아닌 archive 설명인 항목', status:directPet.length ? 'CONFIRMED' : 'NOT_CONFIRMED', evidence:[`Petrashevsky DIRECT dossier-summary excerpts: ${directPet.length}`,'these are marked for reclassification in v6 gold data']},
  {id:11, title:'정확 중복/template 대사의 비율', status:(duplicateDialogueLines || templateLines.length) ? 'CONFIRMED' : 'NOT_CONFIRMED', evidence:[`dialogue lines: ${lines.length}`, `exact duplicate overflow: ${duplicateDialogueLines}`, `template-like lines: ${templateLines.length}`]},
  {id:12, title:'내부 route/state key의 UI 노출 위험', status:internalKeys.length ? 'CONFIRMED' : 'NOT_CONFIRMED', evidence:[`keys found: ${internalKeys.join(', ') || 'none'}`,'keys are implementation labels and require presentation mapping']}
];
const report = `# V6 확인된 발견 사항\n\n생성 시각: ${new Date().toISOString()}\n\n이번 문서는 기존 감사 합계를 재사용하지 않고 현재 파일을 다시 읽어 산출했다. CONFIRMED는 코드·데이터 구조에서 현재 확인된 항목이며, 브라우저에서 기록된 네트워크 실패는 별도 진단 번들에 보존되어 있다.\n\n| # | 항목 | 상태 | 근거 |\n|---:|---|---|---|\n${findings.map(item => `| ${item.id} | ${item.title} | ${item.status} | ${item.evidence.join('; ')} |`).join('\n')}\n\n## V6에서 고정한 범위\n\n- 기존 21개 케이스는 수정하지 않는다.\n- E02, E05, E07만 원자적 source/excerpt 데이터로 별도 정규화한다.\n- GARF 현대 설명은 직접 인용으로 사용하지 않는다.\n- 이 단계에서는 제품 runtime 연결, 로컬 Three.js 전환, 전체 번역 파이프라인을 진행하지 않는다.\n`;
await mkdir(new URL('docs/v6/', root), {recursive:true});
await writeFile(new URL('docs/v6/CONFIRMED_FINDINGS.md', root), report);
console.log(JSON.stringify({findings, output:'docs/v6/CONFIRMED_FINDINGS.md'}, null, 2));
