import fs from 'node:fs';
import crypto from 'node:crypto';

const file = 'narrative/MAIN_20MIN_DIALOGUE.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const outDir = 'docs/v30';
fs.mkdirSync(outDir, {recursive:true});
const rows = [];
const markdown = ['# MAIN 20분 대본 전체 검토본', '', `원본: ${file}`, `SHA-256: ${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`, ''];
for (const scene of data.scenes) {
  markdown.push(`## ${scene.id} · ${scene.title} · ${scene.date}`, '', `쟁점: ${scene.question}`, `다음 사건: ${scene.next || '결말'}`, '');
  markdown.push('### 도입 대화');
  scene.intro.forEach(([speaker, line], index) => { markdown.push(`${index + 1}. **${speaker}** ${line}`); rows.push({sceneId:scene.id,nodeId:`${scene.id}-INTRO-${index+1}`,kind:'intro',speaker,text:line}); });
  markdown.push('', '### 선택지와 반응');
  scene.choices.forEach((choice, index) => { markdown.push(`#### ${choice.id}`, `- 선택: ${choice.text}`, `- 인물: ${choice.actor}`, `- 행동: ${choice.action}`, `- 경로: ${choice.channel}`, `- 반응: ${choice.reaction}`, ''); rows.push({sceneId:scene.id,nodeId:choice.id,kind:'choice',speaker:'PLAYER_ACTION',text:choice.text,action:choice.action,channel:choice.channel,reaction:choice.reaction}); });
  markdown.push('### 연속 원문·한국어 대목');
  scene.excerpts.forEach((excerpt, index) => { markdown.push(`#### ${excerpt.excerptId} · ${excerpt.sourceId} · ${excerpt.locator}`, `- 원문: ${excerpt.ru}`, `- 번역: ${excerpt.ko}`, `- 성격: ${excerpt.context} / ${excerpt.evidence} / ${excerpt.quotationStatus}`, ''); rows.push({sceneId:scene.id,nodeId:excerpt.excerptId,kind:'excerpt',sourceId:excerpt.sourceId,text:excerpt.ru,translation:excerpt.ko,locator:excerpt.locator}); });
}
markdown.push('## 다섯 결말');
for (const ending of data.endings) { markdown.push(`### ${ending.id} · ${ending.title}`, `- 조건: ${ending.condition}`, `- 에필로그: ${ending.epilogue}`, ''); rows.push({sceneId:'ENDING',nodeId:ending.id,kind:'ending',text:ending.epilogue,condition:ending.condition}); }
const tsvFields = ['sceneId','nodeId','kind','speaker','sourceId','action','channel','condition','locator','text','translation','reaction'];
const tsv = [tsvFields.join('\t'), ...rows.map((row)=>tsvFields.map((field)=>String(row[field] ?? '').replaceAll('\t',' ').replaceAll('\n',' ')).join('\t'))].join('\n')+'\n';
fs.writeFileSync(`${outDir}/MAIN_20MIN_DIALOGUE_REVIEW.md`, markdown.join('\n')+'\n');
fs.writeFileSync(`${outDir}/MAIN_20MIN_DIALOGUE_REVIEW.tsv`, tsv);
fs.writeFileSync(`${outDir}/MAIN_SOURCE_REVIEW.md`, ['# MAIN 20분 사료 검토표','',...data.scenes.flatMap((scene)=>[`## ${scene.id} · ${scene.title} · ${scene.date}`,...scene.sources.map((source)=>`- ${source.sourceId} · ${source.titleKo || source.titleRu} · ${source.date || ''} · ${source.locator || ''} · ${source.url || ''}`),'',...scene.excerpts.map((excerpt)=>`### ${excerpt.excerptId} · ${excerpt.sourceId}\n- 원문: ${excerpt.ru}\n- 한국어: ${excerpt.ko}\n- 위치: ${excerpt.locator}\n- 상태: ${excerpt.evidence} / ${excerpt.quotationStatus} / ${excerpt.translationReview}`),''] )].join('\n')+'\n');
fs.writeFileSync(`${outDir}/MAIN20_EXPORT_MANIFEST.json`, JSON.stringify({schemaVersion:'MAIN20-EXPORT-1', source:file, sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), rows:rows.length, markdown:`${outDir}/MAIN_20MIN_DIALOGUE_REVIEW.md`, tsv:`${outDir}/MAIN_20MIN_DIALOGUE_REVIEW.tsv`}, null, 2)+'\n');
console.log(JSON.stringify({status:'PASS',rows:rows.length,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}, null, 2));
