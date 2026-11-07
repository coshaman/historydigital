import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'narrative', 'MAIN_20MIN_DIALOGUE.json'), 'utf8'));
const failures = [];
const speakers = ['alexei', 'ekaterina', 'pavel', 'protagonist'];
const situations = ['firstMeeting', 'ordinaryColleague', 'private', 'conflict', 'increasedIntimacy', 'formalInstitutional'];
const runtimeSituations = ['firstMeeting', 'colleague', 'private', 'conflict', 'intimacy', 'formal'];
const charactersDir = path.join(process.cwd(), 'rpg', 'characters');
const residents = fs.readdirSync(charactersDir).filter(file => file.endsWith('.json'))
  .map(file => JSON.parse(fs.readFileSync(path.join(charactersDir, file), 'utf8')))
  .filter(character => character.kind === 'FICTIONAL');
const normalized = value => String(value ?? '').normalize('NFC').replace(/[\s.,!?…·]/g, '').toLocaleLowerCase('ko');
if (residents.length < 36) failures.push(`expected at least 36 fictional resident voice cards, found ${residents.length}`);
for (const character of residents) {
  if (!character.speechRhythm?.trim()) failures.push(`${character.id}: missing speech rhythm`);
  for (const situation of runtimeSituations) {
    if (!character.speechRegister?.[situation]?.trim()) failures.push(`${character.id}/${situation}: missing speech register`);
  }
  if ((character.voiceSamples ?? []).length < 3) failures.push(`${character.id}: fewer than three voice samples`);
  if ((character.lexicon ?? []).length < 2) failures.push(`${character.id}: fewer than two lexical anchors`);
}
for (const field of ['speechRhythm', ...runtimeSituations.map(situation => `speechRegister.${situation}`)]) {
  const values = residents.map(character => field === 'speechRhythm' ? character.speechRhythm : character.speechRegister?.[field.split('.')[1]]).filter(Boolean);
  if (new Set(values.map(normalized)).size !== residents.length) failures.push(`fictional residents share a ${field} profile`);
}
const sampleOwners = new Map();
for (const character of residents) for (const sample of character.voiceSamples ?? []) {
  const key = normalized(sample);
  if (sampleOwners.has(key)) failures.push(`duplicate voice sample: ${sampleOwners.get(key)} and ${character.id}`);
  else sampleOwners.set(key, character.id);
}
for (const speaker of speakers) {
  const matrix = data.speechRegisterMatrix?.[speaker];
  if (!matrix) { failures.push(`${speaker}: missing matrix`); continue; }
  for (const situation of situations) {
    const row = matrix[situation];
    if (!row || !row.sentenceEndings?.length || !row.rhythm?.length || !row.vocabulary?.length) failures.push(`${speaker}/${situation}: incomplete register row`);
  }
}
for (const situation of situations) {
  const signatures = new Set(speakers.map((speaker) => {
    const row = data.speechRegisterMatrix?.[speaker]?.[situation] || {};
    return `${(row.sentenceEndings || []).join('|')}::${(row.rhythm || []).join('|')}`;
  }));
  if (signatures.size !== speakers.length) failures.push(`${situation}: characters are not all rhythmically distinguishable`);
}
const flatten = (value) => JSON.stringify(value);
if (/안녕하세요|고맙습니다/.test(flatten(data.ideologyPrologue || {}))) failures.push('prologue uses uniform honorific filler instead of authored register');
if (failures.length) {
  console.error(`V42 speech register audit: FAIL (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else console.log('V42 speech register audit: PASS');
