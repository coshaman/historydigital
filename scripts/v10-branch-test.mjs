import {readFile} from 'node:fs/promises';
const text=await readFile(new URL('../docs/v11/GOLD_DECISION_EFFECT_MATRIX.csv',import.meta.url),'utf8');
const rows=text.trim().split(/\r?\n/).slice(1).map(line=>line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/));
const results=[]; for(const id of ['E02','E05-A','E05-B','E07']){const group=rows.filter(row=>row[0]===id); const procedures=group.filter(row=>row[2]==='procedural'); const judgments=group.filter(row=>row[2]==='judgment'); if(procedures.length!==3||judgments.length!==3) throw new Error(`${id}: expected 3+3`); results.push({id,proceduralBranches:3,judgmentBranches:9,uniqueFollowUps:new Set(judgments.map(row=>row[8])).size});}
console.log(JSON.stringify({branchAcceptance:'PASS',results},null,2));
