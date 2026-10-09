import fs from 'node:fs';
import crypto from 'node:crypto';

const sourceFile = 'narrative/MAIN_20MIN_DIALOGUE.json';
const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const outDir = 'docs/v31';
fs.mkdirSync(outDir, { recursive: true });
const sha = crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex');
const rows = [];
const witnessRows = [];
const md = [`# MAIN 20분 대본 전체 원고 — V31`, '', `원본: ${sourceFile}`, `SHA-256: ${sha}`, '', `> 직접 인용은 원문·번역·출처 위치를 함께 표시합니다. 가상 대사는 역사적 직접 인용이 아닙니다.`, ''];

for (const scene of data.scenes) {
  md.push(`## ${scene.id} · ${scene.title} · ${scene.dateLabel}`, '', `시간축: ${scene.transition}`, `자료 도착: ${scene.sourceMoment}`, `쟁점: ${scene.question}`, '');
  md.push('### 도입과 튜토리얼');
  scene.intro.forEach(([speaker, text], index) => { md.push(`${index + 1}. **${speaker}** ${text}`); rows.push({ sceneId: scene.id, nodeId: `${scene.id}-INTRO-${index + 1}`, kind: 'intro', speaker, text, sourceContext: scene.sourceMoment }); });
  md.push('', `### 첫 선택 — ${scene.question}`);
  for (const choice of scene.choices) { md.push(`#### ${choice.id}`, `- 플레이어: ${choice.text}`, `- 상대: ${choice.actor}`, `- 행동: ${choice.action}`, `- 반응: ${choice.reaction}`, ''); rows.push({ sceneId: scene.id, nodeId: choice.id, kind: 'pre_read_choice', speaker: 'PLAYER', actor: choice.actor, action: choice.action, text: choice.text, reaction: choice.reaction }); }
  md.push('### 실제 원문·정확한 번역');
  for (const e of scene.excerpts) { md.push(`#### ${e.excerptId} · ${e.locator}`, `- 러시아어: ${e.ru}`, `- 한국어: ${e.ko}`, `- 출처 링크: ${e.sourceUrl}`, `- 출처 상태: ${e.sourceQuality} / ${e.quoteClass}`, `- 맥락: ${e.context}`, ''); rows.push({ sceneId: scene.id, nodeId: e.excerptId, kind: 'substantive_excerpt', sourceId: e.sourceId, locator: e.locator, text: e.ru, translation: e.ko, sourceQuality: e.sourceQuality }); witnessRows.push({ sceneId: scene.id, groupingId: `${scene.id}-READING`, excerptId: e.excerptId, sourceId: e.sourceId, sourceUrl: e.sourceUrl, origin: e.sourceQuality, edition: e.sourceId, creationDate: e.sourceDate, availableDate: e.availableDate, locator: e.locator, quotationClass: e.quoteClass, rights: 'public-domain/transcription or archival publication; verify repository terms', ru: e.ru, ko: e.ko, status: e.sourceQuality }); }
  if (scene.metadata?.length) { md.push('### 메타데이터 — 본문 읽기 단위가 아님'); for (const m of scene.metadata) { md.push(`- ${m.id}: ${m.text} / ${m.ko} — ${m.role}`); witnessRows.push({ sceneId: scene.id, groupingId: `${scene.id}-METADATA`, excerptId: m.id, sourceId: m.sourceId, origin: 'ARCHIVAL_METADATA', edition: m.sourceId, creationDate: scene.date, availableDate: scene.date, locator: m.text, quotationClass: 'METADATA', rights: 'archive reference only', ru: m.text, ko: m.ko, status: 'BLOCKED_AS_BODY' }); } md.push(''); }
  md.push(`### 읽은 뒤의 두 번째 선택 — ${scene.readPrompt}`);
  for (const choice of scene.postChoices) { md.push(`#### ${choice.id}`, `- 플레이어: ${choice.text}`, `- 상대: ${choice.actor}`, `- 행동: ${choice.action}`, `- 반응: ${choice.reaction}`, ''); rows.push({ sceneId: scene.id, nodeId: choice.id, kind: 'post_read_choice', speaker: 'PLAYER', actor: choice.actor, action: choice.action, text: choice.text, reaction: choice.reaction }); }
  if (scene.laterDocuments) { md.push('### 후대 도착 자료 — 현재 장면에서 읽지 않음'); for (const later of scene.laterDocuments) { md.push(`- ${later.availableDate} · ${later.sourceId} · ${later.label} · ${later.status} · ${later.note}`); if (later.text) witnessRows.push({ sceneId: scene.id, groupingId: `${scene.id}-LATER`, excerptId: later.sourceId, sourceId: later.sourceId, sourceUrl: later.sourceUrl || '', origin: 'LATER_DOCUMENT', edition: later.sourceId, creationDate: later.availableDate, availableDate: later.availableDate, locator: later.label, quotationClass: 'LATER_DOCUMENT_NOT_SHOWN', rights: 'reference only; not rendered in initial scene', ru: later.text, ko: '', status: 'LATER_DOCUMENT_NOT_IN_INITIAL_SCENE' }); } md.push(''); }
}

md.push('## 다섯 엔딩');
for (const ending of data.endings) { md.push(`### ${ending.id} · ${ending.title}`, `- 조건: ${JSON.stringify(ending.rule)}`, `- 역사적 경계: ${ending.historicalOutcome}`, ...ending.dialogue.map(([speaker, text], i) => `${i + 1}. **${speaker}** ${text}`), ''); rows.push({ sceneId: 'ENDING', nodeId: ending.id, kind: 'ending', text: ending.title, reaction: ending.historicalOutcome }); }

const fields = ['sceneId', 'nodeId', 'kind', 'speaker', 'actor', 'sourceId', 'action', 'locator', 'sourceQuality', 'text', 'translation', 'reaction', 'sourceContext'];
const clean = (value) => String(value ?? '').replaceAll('\t', ' ').replaceAll('\r', ' ').replaceAll('\n', ' ');
const tsv = [fields.join('\t'), ...rows.map((row) => fields.map((field) => clean(row[field])).join('\t'))].join('\n') + '\n';
const witnessFields = ['sceneId', 'groupingId', 'excerptId', 'sourceId', 'sourceUrl', 'origin', 'edition', 'creationDate', 'availableDate', 'locator', 'quotationClass', 'rights', 'ru', 'ko', 'status'];
const csvQuote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const witnessCsv = [witnessFields.join(','), ...witnessRows.map((row) => witnessFields.map((field) => csvQuote(row[field])).join(','))].join('\n') + '\n';

fs.writeFileSync(`${outDir}/MAIN_20MIN_DIALOGUE_ALL.md`, md.join('\n') + '\n');
fs.writeFileSync(`${outDir}/MAIN_20MIN_DIALOGUE_ALL.tsv`, tsv);
fs.writeFileSync(`${outDir}/MAIN20_DIALOGUE_LINE_AUDIT.csv`, ['sceneId,nodeId,kind,status', ...rows.map((row) => [row.sceneId, row.nodeId, row.kind, 'REACHABLE'].map(csvQuote).join(','))].join('\n') + '\n');
fs.writeFileSync(`${outDir}/SOURCE_WITNESS_MAIN20.csv`, witnessCsv);
fs.writeFileSync(`${outDir}/ENDING_DIALOGUE_AND_GATES.json`, JSON.stringify({ schemaVersion: 'V31-ENDING-GATES-1', endings: data.endings.map(({ id, title, rule, dialogue }) => ({ id, title, rule, dialogueLines: dialogue.length })) }, null, 2) + '\n');
fs.writeFileSync(`${outDir}/MAIN20_EXPORT_MANIFEST.json`, JSON.stringify({ schemaVersion: 'V31-MAIN20-EXPORT-1', sourceFile, sourceSha256: sha, dialogueRows: rows.length, witnessRows: witnessRows.length, metadataRows: witnessRows.filter((row) => row.status === 'BLOCKED_AS_BODY').length, outputs: ['MAIN_20MIN_DIALOGUE_ALL.md', 'MAIN_20MIN_DIALOGUE_ALL.tsv', 'MAIN20_DIALOGUE_LINE_AUDIT.csv', 'SOURCE_WITNESS_MAIN20.csv', 'ENDING_DIALOGUE_AND_GATES.json'] }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', dialogueRows: rows.length, witnessRows: witnessRows.length, metadataRows: witnessRows.filter((row) => row.status === 'BLOCKED_AS_BODY').length, sourceSha256: sha }, null, 2));
