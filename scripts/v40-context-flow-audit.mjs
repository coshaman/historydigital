import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const failures = [];
const requiredContextFields = ['whoIsThisAbout', 'whatJustHappened', 'whatDocumentsAreHere', 'whyTheDocumentsDiffer', 'whatThePlayerShouldNotice'];
const sceneIds = ['C03', 'C06', 'C07', 'E02', 'E07'];

for (const id of sceneIds) {
  const scene = data.scenes.find((item) => item.id === id);
  if (!scene) { failures.push(`${id}: scene missing`); continue; }
  for (const field of requiredContextFields) if (!scene[field]) failures.push(`${id}: missing ${field}`);
  if (!Array.isArray(scene.sourceDiscussion) || scene.sourceDiscussion.length < 2) failures.push(`${id}: sourceDiscussion must contain at least two authored lines`);
  if (!scene.decisionPrompt) failures.push(`${id}: missing decisionPrompt`);
  if (!scene.transitionCard?.place || !scene.transitionCard?.event) failures.push(`${id}: missing transitionCard place/event`);
  for (const choice of scene.choices || []) {
    if (!choice.uiLabel || !choice.uiHint) failures.push(`${id}/${choice.id}: missing uiLabel/uiHint`);
    if (choice.uiLabel && choice.uiLabel.length > 28) failures.push(`${id}/${choice.id}: uiLabel too long`);
  }
}

const c03 = data.scenes.find((item) => item.id === 'C03');
const c03Text = JSON.stringify(c03);
for (const phrase of ['푸시킨', '두', '부고']) if (!c03Text.includes(phrase)) failures.push(`C03: missing comprehension cue ${phrase}`);

if (failures.length) {
  console.error(`V40 context flow audit: FAIL (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`V40 context flow audit: PASS (${sceneIds.length} scenes, ${sceneIds.length * requiredContextFields.length} context fields checked)`);
