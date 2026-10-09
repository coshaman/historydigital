import fs from 'node:fs';
const roots=['index.html','app.js','gold-runtime.js','styles.css','narrative/VN_DIALOGUE_GRAPH.json','narrative/ENDING_DIALOGUES.json'];
const rows=[['text','classification','source']];
const meta=/시범 케이스|자료 처리의 순서|내 판단|케이스 후속 기록|쟁점 점수|분기 후속 문서|선택 판단|테스트 케이스|엔딩 경로 목록/g;
for(const file of roots){const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(meta)){const classification=file==='gold-runtime.js'?'LEGACY_SANITIZED_SOURCE':'DEV_ONLY';rows.push([match[0],classification,`${file}:${text.slice(0,match.index).split('\n').length} (sanitizePlayerCopy)`])}}
const graph=JSON.parse(fs.readFileSync('narrative/VN_DIALOGUE_GRAPH.json','utf8'));for(const c of graph.cases)for(const n of c.nodes)rows.push([n.utteranceKo,n.speakerId==='PLAYER_ACTION'?'NATURAL_PLAYER_ACTION':n.speakerId==='NARRATION_MINIMAL'?'IN_WORLD_DOCUMENT':'DIEGETIC_SPOKEN',`narrative/VN_DIALOGUE_GRAPH.json:${n.id}`]);
fs.mkdirSync('docs/v28',{recursive:true});fs.writeFileSync('docs/v28/PLAYER_VISIBLE_COPY_INVENTORY.csv',rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'));console.log(`v28-copy-inventory: ${rows.length-1} authored/runtime strings, ${rows.filter(r=>r[1]==='DEV_ONLY').length} meta findings`);
