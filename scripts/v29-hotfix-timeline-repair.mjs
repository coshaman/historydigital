import fs from 'node:fs';

const bundlePath = 'data/v27-case-bundle.json';
const graphPath = 'narrative/VN_DIALOGUE_GRAPH.json';
const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const dates = { C03:'1837-03', C05:'1840-05-15', C06:'1842-02', C07:'1842-05', C14:'1847-07', C19:'1849-02', C21:'1848-10', C24:'1849-12-22' };
const firstLines = {
  C05:'1840년 5월, 레르몬토프 초판과 벨린스키의 동시기 평론이 함께 도착했다.',
  C03:'1837년 3월, 푸시킨의 사망 소식과 언론의 반응이 서로 다른 봉투로 도착했다.',
  C06:'1842년 2월, 레르몬토프 결투의 수사 기록과 증언이 봉인된 채 도착했다.',
  C07:'1842년 5월, 수정된 《죽은 혼》 원고와 허가 표기가 한 묶음으로 돌아왔다.',
  C14:'1847년 7월, 편집부로 향한 편지와 검열관의 메모가 같은 봉투에 묶여 도착했다.',
  C19:'1849년 2월, 1848년 지면과 훗날의 평론이 한 자료철에서 겹쳐졌다.',
  C21:'1848년 10월, 1849년 《현대인》 발행 계획 공고와 삽화 연감의 판매 문구가 나란히 도착했다.',
  C24:'1849년 12월 22일, 수사 기록과 선고 문서가 봉인되기 직전 책상에 놓였다.'
};
for (const c of bundle.cases) {
  if (!dates[c.caseId]) continue;
  c.date = dates[c.caseId];
  if (c.caseId === 'C21') {
    const source = c.sources.find(s=>s.sourceId==='OBJ-WS-SOVREMENNIK-1848');
    if (source) {
      source.date='1848-09-30';
      source.availableToPlayerDate='1848-09-30';
      source.sourceCreationDate={...source.sourceCreationDate,granularity:'DAY',earliest:'1848-09-30',latest:'1848-09-30',originalDateText:'1848 (publication year; checked access 1848-09-30)'};
      source.arrivalBasis='1848 publication notice; checked player access date 1848-09-30';
    }
  }
}
for (const c of graph.cases || []) {
  if (!dates[c.caseId]) continue;
  c.dateRange=[dates[c.caseId], dates[c.caseId]];
  for (const node of c.nodes || []) node.dateRange=[dates[c.caseId], dates[c.caseId]];
  const first = (c.nodes || []).find(n=>String(n.id).endsWith('-LINE-1'));
  if (first) first.utteranceKo=firstLines[c.caseId];
}
fs.writeFileSync(bundlePath, JSON.stringify(bundle,null,2)+'\n');
fs.writeFileSync(graphPath, JSON.stringify(graph,null,2)+'\n');
console.log(`V29 timeline repair applied: ${Object.keys(dates).length} cases`);
