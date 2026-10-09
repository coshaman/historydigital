import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const c03 = data.scenes.find((scene) => scene.id === 'C03');
const c03a = c03?.choices.find((choice) => choice.id === 'C03-A');
if (c03a?.reactionActor !== 'alexei') throw new Error(`C03-A reaction must be Alexei, got ${c03a?.reactionActor}`);
const intentionalNarration = data.scenes.flatMap((scene) => [...(scene.choices || []), ...(scene.postChoices || [])]).filter((choice) => choice.reactionActor === 'NARRATION').map((choice) => choice.id);
if (intentionalNarration.some((id) => id !== 'C07-P3')) throw new Error(`unexpected narration reaction actor: ${intentionalNarration.join(',')}`);
console.log('PASS MAIN20 character reaction actors');
