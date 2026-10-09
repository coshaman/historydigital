import { readFile } from 'node:fs/promises';

const plan = JSON.parse(await readFile(new URL('../data/dialogue-plan.json', import.meta.url)));
const model = JSON.parse(await readFile(new URL('../data/press-decision-model.json', import.meta.url)));
const corpus = JSON.parse(await readFile(new URL('../data/corpus-manifest.json', import.meta.url)));
const templates = plan.lineTemplates;
const failures = [];
if (model.cases.length !== 24) failures.push(`encounter cases ${model.cases.length}, expected 24`);
if (plan.voiceProfiles.length < 5) failures.push('voice profiles below 5');
for (const profile of plan.voiceProfiles) if (!profile.id || !profile.role || !profile.presence || !profile.evidenceClass) failures.push('incomplete voice profile');
const lines = [];
for (const item of model.cases) {
  const pack = corpus.casePacks.find((candidate) => candidate.id === item.casePackId);
  if (!pack || pack.sourceObjectIds.length < 4) failures.push(`${item.id}: missing four source links`);
  templates.direct.forEach((text, index) => lines.push({id:`${item.id}-D${index+1}`,caseId:item.id,text,evidenceClass:'DIRECT',sourceIds:pack.sourceObjectIds.slice(0,2)}));
  templates.paraphrase.forEach((text, index) => lines.push({id:`${item.id}-P${index+1}`,caseId:item.id,text,evidenceClass:'PARAPHRASE',sourceIds:pack.sourceObjectIds.slice(0,2)}));
  templates.reconstructed.forEach((text, index) => lines.push({id:`${item.id}-R${index+1}`,caseId:item.id,text,evidenceClass:'RECONSTRUCTED',sourceIds:pack.sourceObjectIds.slice(0,1)}));
  templates.conditional.forEach((text, index) => lines.push({id:`${item.id}-C${index+1}`,caseId:item.id,text,evidenceClass:'RECONSTRUCTED',conditional:true,sourceIds:pack.sourceObjectIds.slice(0,1)}));
}
const choices = model.cases.length * templates.choices.length;
const direct = lines.filter((line) => line.evidenceClass === 'DIRECT').length;
const paraphrase = lines.filter((line) => line.evidenceClass === 'PARAPHRASE').length;
const reconstructed = lines.filter((line) => line.evidenceClass === 'RECONSTRUCTED').length;
const conditional = lines.filter((line) => line.conditional).length;
for (const line of lines) {
  if (!line.text || !line.evidenceClass || !line.sourceIds?.length) failures.push(`${line.id}: incomplete metadata`);
  if (line.sourceIds.some((sourceId) => !corpus.sourceObjects.some((source) => source.id === sourceId))) failures.push(`${line.id}: unknown source`);
}
if (lines.length < 500) failures.push(`dialogue lines ${lines.length}, target 500`);
if (direct + paraphrase < 180) failures.push(`DIRECT/PARAPHRASE ${direct + paraphrase}, target 180`);
if (reconstructed < 320) failures.push(`RECONSTRUCTED ${reconstructed}, target 320`);
if (conditional < 120) failures.push(`conditional ${conditional}, target 120`);
if (choices < 200) failures.push(`choices ${choices}, target 200`);
console.log(JSON.stringify({encounters:model.cases.length,dialogueLines:lines.length,direct,paraphrase,reconstructed,conditional,playerChoices:choices,failures}, null, 2));
if (failures.length) process.exit(1);
