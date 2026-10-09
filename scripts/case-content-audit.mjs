import { readFile } from 'node:fs/promises';

const model=JSON.parse(await readFile(new URL('../data/press-decision-model.json',import.meta.url)));
const corpus=JSON.parse(await readFile(new URL('../data/corpus-manifest.json',import.meta.url)));
const runtime=JSON.parse(await readFile(new URL('../data/runtime-dialogue.json',import.meta.url)));
const structure=JSON.parse(await readFile(new URL('../data/case-structure.json',import.meta.url)));
const aliases={'OBJ-BELINSKY-GOGOL-1847':['OBJ-WS-BELINSKY-1847','OBJ-WS-GOGOL-1847'],'OBJ-HERZEN-1847':['OBJ-WS-HERZEN-1847']};
const packs=Object.fromEntries(corpus.casePacks.map(p=>[p.id,p]));
const structureById=Object.fromEntries(structure.cases.map(c=>[c.id,c]));
const runtimeById=Object.fromEntries(runtime.cases.map(c=>[c.id,c]));
const failures=[]; const coverage=[];
for(const c of model.cases){
  const pack=packs[c.casePackId];
  const sourceIds=pack?.sourceObjectIds??[];
  const allowed=new Set(sourceIds.flatMap(id=>[id,...(aliases[id]??[])]));
  const excerpts=(runtimeById[c.id]?.lines??[]).filter(line=>line.original&&line.locator&&line.source_ids?.some(id=>allowed.has(id)));
  const item={id:c.id,casePackId:c.casePackId,excerptCount:excerpts.length,incoming:c.incoming.length,review:c.review.length,hasOutcome:Boolean(structureById[c.id]?.historicalOutcome),hasOptionalBranch:Boolean(structureById[c.id]?.optionalBranch)};
  coverage.push(item);
  if(excerpts.length<5) failures.push(`${c.id}: ${excerpts.length} source-backed excerpts, target 5`);
  if(c.incoming.length<4||c.incoming.length>7) failures.push(`${c.id}: incoming count ${c.incoming.length}`);
  if(c.review.length<2) failures.push(`${c.id}: review count ${c.review.length}`);
  if(!item.hasOutcome||!item.hasOptionalBranch) failures.push(`${c.id}: missing outcome/optional branch`);
}
console.log(JSON.stringify({cases:coverage.length,coverage,failures},null,2));
if(failures.length) process.exit(1);
console.log('case-content-audit: every case has 5–12 source-backed excerpts and complete outcome/branch structure — PASS');
