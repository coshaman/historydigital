import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'narrative', 'MAIN_20MIN_DIALOGUE.json'), 'utf8'));
const failures = [];
const speakers = ['alexei', 'ekaterina', 'pavel', 'protagonist'];
const situations = ['firstMeeting', 'ordinaryColleague', 'private', 'conflict', 'increasedIntimacy', 'formalInstitutional'];
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
  if (signatures.size < 3) failures.push(`${situation}: characters are not rhythmically distinguishable`);
}
const flatten = (value) => JSON.stringify(value);
if (/안녕하세요|고맙습니다/.test(flatten(data.ideologyPrologue || {}))) failures.push('prologue uses uniform honorific filler instead of authored register');
if (failures.length) {
  console.error(`V42 speech register audit: FAIL (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else console.log('V42 speech register audit: PASS');
