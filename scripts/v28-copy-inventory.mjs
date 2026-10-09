import fs from 'node:fs';
const files=['index.html','gold-runtime.js','narrative/VN_DIALOGUE_GRAPH.json','narrative/ENDING_DIALOGUES.json','styles.css'];
const rows=[['file','text','classification']];
const meta=/시범 케이스|내 판단|케이스 후속 기록|자료 처리의 순서|후속 자료가 열렸|쟁점 상태|이번 회차에서 건너뛴|테스트 케이스|엔딩 경로 목록/;
for(const file of files){const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(/(?:textContent|innerHTML|textContent=|utteranceKo|spokenKo|text=|placeholder=|aria-label=|content:)\s*[`'\"]([^`'\"]{3,160})[`'\"]/g)){const value=match[1].replaceAll(',','，').replaceAll('\n',' ');const classification=meta.test(value)?'DELETE_OR_DEV_ONLY':file.startsWith('narrative/')?'DIEGETIC_SPOKEN':'ESSENTIAL_ACCESSIBILITY_UI';rows.push([file,`"${value}"`,classification]);}}
fs.mkdirSync('docs/v28',{recursive:true});fs.writeFileSync('docs/v28/PLAYER_VISIBLE_COPY_INVENTORY.csv',rows.map(r=>r.join(',')).join('\n'));console.log(JSON.stringify({status:'PASS',files,rows:rows.length-1,forbiddenFindings:rows.filter(r=>r[2]==='DELETE_OR_DEV_ONLY').length},null,2));
