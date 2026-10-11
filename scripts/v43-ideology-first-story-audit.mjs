import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, 'narrative', 'MAIN_20MIN_DIALOGUE.json'), 'utf8'));
const failures = [];
const requiredKinds = ['OPINION', 'INTERPRETATION', 'DIALOGUE_RESPONSE', 'EVIDENCE_REQUEST', 'ACTION'];
const registry = Object.fromEntries(Object.entries(data.v43ChoiceTypeRegistry || {}).map(([kind, ids]) => [kind, [...ids]]));
for (const [kind, ids] of Object.entries(data.v44ChoiceTypes || {})) { for (const other of Object.keys(registry)) registry[other] = registry[other].filter((id) => !ids.includes(id)); registry[kind] = [...new Set([...(registry[kind] || []), ...ids])]; }
const allIds = [];
const allChoices = [];
for (const scene of data.scenes) for (const field of ['choices', 'postChoices']) for (const choice of (scene[field] || [])) { allIds.push(choice.id); allChoices.push(choice); }
for (const beat of [...data.ideologyPrologue.beats, ...data.c07IdeologicalFollowUp.beats]) for (const choice of beat.choices || []) { allIds.push(choice.id); allChoices.push(choice); }
const seen = new Map();
for (const [kind, ids] of Object.entries(registry)) for (const id of ids) seen.set(id, (seen.get(id) || 0) + 1);
for (const kind of requiredKinds) if (!Array.isArray(registry[kind]) || !registry[kind].length) failures.push(`choice registry missing ${kind}`);
for (const id of allIds) if (seen.get(id) !== 1) failures.push(`${id}: must have exactly one choice kind`);
for (const id of seen.keys()) if (!allIds.includes(id)) failures.push(`${id}: registry references missing choice`);
if (registry.ACTION.length >= allIds.length) failures.push('all choices are ACTION');
if (allChoices.filter((choice) => ['OPINION', 'DIALOGUE_RESPONSE', 'INTERPRETATION'].some((kind) => registry[kind]?.includes(choice.id))).length < 5) failures.push('fewer than five pure opinion/dialogue choices');
for (const scene of Object.keys(data.v43SceneClassification || {})) if (scene !== 'IDELOGY_PROLOGUE' && scene !== 'C03' && scene !== 'C06' && scene !== 'C07' && scene !== 'E02' && scene !== 'E07') failures.push(`${scene}: unknown scene classification`);
for (const [sceneId, classification] of Object.entries(data.v43SceneClassification || {})) if (!classification) failures.push(`${sceneId}: missing classification`);
for (const requirement of data.v43SourceRequirements || []) {
  const source = data.sourceRegister?.find((item) => item.sourceId === requirement.sourceId);
  for (const field of ['author', 'workTitle', 'ideologicalUse']) if (!requirement[field]) failures.push(`${requirement.sourceId}: missing ${field}`);
  if (!source) failures.push(`${requirement.sourceId}: missing source register record`);
  if (source && !source.originalRussian) failures.push(`${requirement.sourceId}: missing original Russian`);
}
const routeText = JSON.stringify({ onboarding: data.onboarding, scenes: data.scenes, ideologyPrologue: data.ideologyPrologue, c07: data.c07IdeologicalFollowUp });
if (/чехов|chekhov|체호프/i.test(routeText)) failures.push('Chekhov appears in 1836–1849 route');
for (const warning of data.falseEquivalenceWarnings || []) if (!warning.claim || !warning.correction) failures.push(`${warning.id}: warning incomplete`);
for (const beat of data.c07IdeologicalFollowUp?.beats || []) {
  const kinds = new Set((beat.choices || []).map((choice) => Object.entries(registry).find(([, ids]) => ids.includes(choice.id))?.[0]));
  if (kinds.size < 2 || !kinds.has('OPINION')) failures.push(`${beat.id}: needs multiple meaningful opinion/interpretation choices`);
}
for (const ending of data.endings || []) {
  const profile = data.endingIdeologyProfiles?.[ending.id];
  if (!profile?.beliefSceneMinimum || profile.beliefSceneMinimum < 3) failures.push(`${ending.id}: needs beliefs from at least three scenes`);
  if (!profile?.actionGate?.all?.length || profile.actionGate.all.length < 2) failures.push(`${ending.id}: needs at least two concrete actions`);
}
for (const file of ['docs/v43/IDEOLOGY_STORY_AUDIT.tsv', 'docs/v43/CHOICE_TYPE_AUDIT.tsv', 'docs/v43/PRUNED_FROM_MAIN_ROUTE.md']) if (!fs.existsSync(path.join(root, file))) failures.push(`${file}: required deliverable missing`);
if (failures.length) { console.error(`V43 ideology-first story audit: FAIL (${failures.length})`); failures.forEach((failure) => console.error(`- ${failure}`)); process.exitCode = 1; } else console.log('V43 ideology-first story audit: PASS');
