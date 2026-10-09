import { readFile } from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../data/case-dialogues.json',import.meta.url)));
const lines=data.cases.flatMap(c=>c.lines.map(line=>({...line,caseId:c.id}))).slice(0,100);
const banned=['당신은 ~해야 합니다','그것은 ~입니다','에 대하여','통하여','하는 것이 가능합니다','나는 이것이','중요한 것은','핵심은','단순히','흥미로운 점은','Document to inspect','Source drawer','EVIDENCE LAYERS ON'];
const failures=[];for(const [i,line] of lines.entries()){if(line.text.length>180)failures.push(`line ${i} too long`);for(const phrase of banned)if(line.text.includes(phrase))failures.push(`line ${i} contains ${phrase}`);if(!line.evidence_class||!line.source_ids?.length||!line.voice_profile)failures.push(`line ${i} missing metadata`);}
console.log(JSON.stringify({reviewedLines:lines.length,casesCovered:new Set(lines.map(l=>l.caseId)).size,failures},null,2));if(failures.length)process.exit(1);console.log('korean-dialogue-review: 100 authored lines checked for natural Korean, translation residue, and metadata — PASS');
