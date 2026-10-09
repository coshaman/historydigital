import { readFile } from 'node:fs/promises';

const pilot = JSON.parse(await readFile(new URL('../data/v25-pilot-cases.json', import.meta.url), 'utf8'));
const bundle = JSON.parse(await readFile(new URL('../data/v26-case-bundle.json', import.meta.url), 'utf8'));
const contentData = JSON.parse(await readFile(new URL('../data/content.json', import.meta.url), 'utf8'));
const content = contentData.endings;
const failures = [];
if (bundle.cases.length !== 24) failures.push('case count is not 24');
if (new Set(bundle.cases.map(item => item.caseId)).size !== 24) failures.push('duplicate case ids');
for (const item of bundle.cases) {
  if (item.excerpts.length < 5 && !String(item.sourceStatus).startsWith('BLOCKED_')) failures.push(`${item.caseId} has fewer than five excerpts`);
  if (new Set(item.excerpts.map(excerpt => excerpt.excerptId)).size !== item.excerpts.length) failures.push(`${item.caseId} duplicate excerpt ids`);
  for (const excerpt of item.excerpts) if (!excerpt.ru || !excerpt.ko || excerpt.ru.includes('...') || excerpt.ko.includes('...')) failures.push(`${item.caseId} incomplete excerpt`);
  if (item.proceduralChoices.length < 3 || item.judgments.length !== 3 || item.followups.length !== 3) failures.push(`${item.caseId} branch contract`);
}
const byCase = Object.fromEntries(pilot.cases.map(item => [item.caseId, item]));
for (const [caseId, judgmentId, forbidden] of [['C06','V25-C06-J3','literaturePublicRole'],['C07','V25-C07-J2','censorshipScope'],['C07','V25-C07-J3','pressFreedom'],['C19','V25-C19-J3','pressFreedom']]) {
  const judgment = byCase[caseId].judgments.find(item => item.id === judgmentId);
  if (judgment?.effect?.issue?.[forbidden]) failures.push(`${judgmentId} retains unsupported ${forbidden}`);
}
if (content.length !== 5) failures.push('ending count is not exactly five');
console.log(JSON.stringify({ status: failures.length ? 'FAIL' : 'PASS', cases: bundle.cases.length, blocked: bundle.cases.filter(item => String(item.sourceStatus || '').startsWith('BLOCKED_')).map(item => item.caseId), endings: content.map(item => item.id), failures }, null, 2));
if (failures.length) process.exitCode = 1;
