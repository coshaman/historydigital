import { readFile } from 'node:fs/promises';
const [html,app]=await Promise.all([readFile(new URL('../index.html',import.meta.url),'utf8'),readFile(new URL('../app.js',import.meta.url),'utf8')]);
const banned=['편집실의 마찰','여백메모','성향 반영','Evidence Overlay','위험을 감수한다','균형 잡힌 태도를 보인다','의견을 기록한다','보수적으로 대응한다','이번 lead'];
const failures=banned.filter(term=>html.includes(term)||app.includes(term)).map(term=>`abstract or stale copy: ${term}`);
const concrete=['현재 할 일','개인 메모','문서를 상급자 서류철에 넣는다','봉투를 접어 개인 메모와 함께 보관한다'];
for(const term of concrete)if(!html.includes(term)&&!app.includes(term))failures.push(`missing concrete action copy: ${term}`);
console.log(JSON.stringify({banned,concrete,failures},null,2));if(failures.length)process.exit(1);console.log('copy-clarity-audit: concrete actions, personal-note purpose, and stale abstract labels — PASS');
