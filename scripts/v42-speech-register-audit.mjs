import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'narrative', 'MAIN_20MIN_DIALOGUE.json'), 'utf8'));
const route = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'narrative', 'ACT_III_BRANCH_ROUTE.json'), 'utf8'));
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

function dialogueProfiles(lines) {
  const groups = new Map();
  for (const line of lines) {
    if (!line?.speaker || !line?.text) continue;
    const bucket = groups.get(line.speaker) ?? [];
    bucket.push(line.text.trim());
    groups.set(line.speaker, bucket);
  }
  const profiles = new Map();
  for (const [speaker, texts] of groups) {
    const endings = new Set(texts.map((text) => {
      const finalWord = text.match(/[가-힣]+(?=[.!?。！？”’"']?$)/u)?.[0] ?? text.split(/\s+/u).at(-1);
      if (/(?:습니다|ㅂ니다|십시오|합니다|겠습니다|됩니다|십시오)$/u.test(finalWord)) return 'formal-polite';
      if (/(?:아요|어요|해요|네요|군요|까요|세요|죠)$/u.test(finalWord)) return 'polite-yo';
      if (/(?:어|아|야|지|네|자|래|거든|잖아|해)$/u.test(finalWord)) return 'casual';
      if (/다$/u.test(finalWord)) return 'plain-declarative';
      return 'other';
    }));
    const wordsPerLine = texts.map((text) => text.split(/\s+/u).filter(Boolean).length);
    const meanWords = wordsPerLine.reduce((sum, value) => sum + value, 0) / wordsPerLine.length;
    const rhythm = meanWords < 9 ? 'short' : meanWords < 16 ? 'mid' : 'long';
    const sentencePattern = new Set(texts.map((text) => (text.match(/[.!?。！？]/gu) ?? []).length >= 2 ? 'multi' : 'single'));
    profiles.set(speaker, { endings, rhythm, sentencePattern });
  }
  return profiles;
}

function dialogueProfilesAreDistinct(profiles) {
  const values = [...profiles.values()];
  if (values.length < 2) return false;
  return values.every((left, index) => values.slice(index + 1).every((right) =>
    left.rhythm !== right.rhythm || [...left.endings].some((ending) => !right.endings.has(ending)) ||
    [...right.endings].some((ending) => !left.endings.has(ending)) ||
    [...left.sentencePattern].some((pattern) => !right.sentencePattern.has(pattern)) ||
    [...right.sentencePattern].some((pattern) => !left.sentencePattern.has(pattern))));
}

const actualLines = (route.branches ?? []).flatMap((branch) => branch.speakerLines ?? []);
const actualProfiles = dialogueProfiles(actualLines);
for (const speaker of speakers) if (!actualProfiles.has(speaker)) failures.push(`${speaker}: no authored route dialogue to audit`);
if (!dialogueProfilesAreDistinct(actualProfiles)) {
  const summary = Object.fromEntries([...actualProfiles].map(([speaker, profile]) => [speaker, { endings: [...profile.endings], rhythm: profile.rhythm, sentencePattern: [...profile.sentencePattern] }]));
  failures.push(`authored route dialogue converges to the same sentence-ending and rhythm profile across characters: ${JSON.stringify(summary)}`);
}
const deliberatelyUniformFixture = dialogueProfiles(speakers.map((speaker) => ({ speaker, text: '그 일은 제가 확인하겠습니다.' })));
if (dialogueProfilesAreDistinct(deliberatelyUniformFixture)) failures.push('uniform-dialogue self-test failed to detect identical endings and rhythm');
if (failures.length) {
  console.error(`V42 speech register audit: FAIL (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else console.log('V42 speech register audit: PASS');
