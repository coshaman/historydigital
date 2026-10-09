import {readFile} from 'node:fs/promises';
const parse = text => text.trim().split(/\r?\n/).slice(1).map(line=>line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(value=>value.replace(/^\"|\"$/g,'').trim()));
const review=parse(await readFile(new URL('../docs/v12/GOLD_DECISION_SEMANTICS_REVIEW.csv',import.meta.url),'utf8')); const matrix=parse(await readFile(new URL('../docs/v12/GOLD_DECISION_EFFECT_MATRIX.csv',import.meta.url),'utf8')); const runtime=await readFile(new URL('../gold-runtime.js',import.meta.url),'utf8'); const failures=[];
if(review.length!==24||matrix.length!==24) failures.push(`row counts review=${review.length}, matrix=${matrix.length}`);
if(review.some(row=>row.at(-1)!=='REVISED')) failures.push('unreviewed row');
if(matrix.some(row=>!row.at(-1))) failures.push('missing justification');
for(const forbidden of ['radicalAction+1','russianParticularism+1','westernOrientation+1','belinskyAffinity+1']) if(runtime.includes(forbidden)) failures.push(`unsupported legacy effect remains: ${forbidden}`);
const judgmentRelationships=matrix.filter(row=>row[1].includes('E0')&&row[2].includes('-J')&&row[6]); if(judgmentRelationships.length) failures.push('judgment changed relationship without interaction');
console.log(JSON.stringify({reviewRows:review.length,matrixRows:matrix.length,judgmentRelationshipRows:judgmentRelationships.length,failures},null,2)); if(failures.length)process.exit(1); console.log('v12-semantics-test: all 24 rows justified; issue/institution/relationship effects separated — PASS');
