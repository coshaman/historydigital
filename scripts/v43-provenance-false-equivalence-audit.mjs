import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, 'narrative', 'MAIN_20MIN_DIALOGUE.json'), 'utf8'));
const failures = [];
for (const source of data.sourceRegister || []) if (source.classification === 'DIRECT' && /\b(Внутренняя правда|Каждый должен|Вечера у Петрашевского)/.test(source.originalRussian || '') && source.sourceId === 'V42-SLAVOPHILE-PRIMARY') failures.push(`${source.sourceId}: paraphrase-like wording marked DIRECT`);
for (const source of data.sourceRegister || []) {
  const range = data.sourceContextRanges?.[source.contextRangeId];
  if (!range || range.type !== 'CONTIGUOUS_WITNESS_RANGE' || Number(range.paragraphCount) < 2) failures.push(`${source.sourceId}: contiguous context missing`);
}
const forbidden = ['Official Nationality = Slavophilism', 'Slavophiles = government ideology', 'Westernizers =', 'Slavophiles = simple nationalism', 'Gogol = government propaganda', 'Belinsky = simple revolutionary', 'Petrashevsky circle = one unified revolutionary party', 'Table of Ranks = one philosophical ideology'];
const dialogueText = JSON.stringify({ onboarding: data.onboarding, scenes: data.scenes, ideologyPrologue: data.ideologyPrologue, c07: data.c07IdeologicalFollowUp });
for (const phrase of forbidden) if (dialogueText.includes(phrase)) failures.push(`forbidden equivalence in route dialogue: ${phrase}`);
if ((data.literaryBorrowings || []).some((item) => item.classification !== 'LITERARY_BORROWING')) failures.push('literary borrowing is not separated by classification');
if (failures.length) { console.error(`V43 provenance/false-equivalence audit: FAIL (${failures.length})`); failures.forEach((failure) => console.error(`- ${failure}`)); process.exitCode = 1; } else console.log('V43 provenance/false-equivalence audit: PASS');
