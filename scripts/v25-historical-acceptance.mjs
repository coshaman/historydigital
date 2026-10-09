import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile('data/v25-pilot-cases.json', 'utf8'));
const failures = [];
for (const item of data.cases) {
  const sceneYear = Math.max(...String(item.date).match(/\d{4}/g).map(Number));
  for (const source of item.sources) {
    if (!source.url || source.sourceImageStatus === 'VERIFIED_SCAN') failures.push(`${item.caseId}:${source.sourceId}:invalid-source-image-claim`);
    if (Number(String(source.date).slice(0, 4)) > sceneYear) failures.push(`${item.caseId}:${source.sourceId}:future-source`);
  }
  for (const excerpt of item.excerpts) if ([excerpt.ru, excerpt.ko].some((text) => !text || text.includes('...') || text.includes('…'))) failures.push(`${item.caseId}:${excerpt.excerptId}:placeholder-or-empty`);
}
const result = { status: failures.length ? 'FAIL' : 'PASS', failures, cases: data.cases.length };
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'PASS') process.exitCode = 1;

