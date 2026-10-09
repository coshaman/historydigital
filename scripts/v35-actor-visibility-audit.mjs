import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const rows = [];
const failures = [];
const named = new Set(['alexei', 'ekaterina', 'pavel']);
const narratorPatterns = [/^세 사람은/, /^장면은/, /^도시는/, /^기록은/, /^침묵은/];
const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value) => b.includes(value));
for (const scene of data.scenes) for (const kind of ['choices', 'postChoices']) for (const choice of scene[kind]) {
  const who = choice.semantic?.whoHears;
  const witnesses = choice.witnesses;
  const visibility = choice.visibility || choice.semantic?.visibility;
  const row = { sceneId: scene.id, kind, choiceId: choice.id, actor: choice.actor, reactionActor: choice.reactionActor, witnesses, visibility, whoHears: who, reactionSequence: choice.reactionSequence || null };
  rows.push(row);
  if (choice.actor !== 'PLAYER') failures.push(`${choice.id}: player choice actor is not PLAYER`);
  if (!choice.reactionActor) failures.push(`${choice.id}: missing reactionActor`);
  if (!Array.isArray(who) || !who.length || who.includes('NONE')) failures.push(`${choice.id}: spoken/witness whoHears is NONE or empty`);
  if (!Array.isArray(witnesses) || !witnesses.length || witnesses.includes('NONE')) failures.push(`${choice.id}: witnesses is NONE or empty`);
  if (visibility === 'SPOKEN' && (!Array.isArray(who) || !who.length || who.includes('NONE'))) failures.push(`${choice.id}: SPOKEN without listeners`);
  if (visibility === 'SPOKEN' && !sameSet(who, witnesses)) failures.push(`${choice.id}: witnesses conflict with whoHears`);
  if (visibility === 'PRIVATE_NOTE' && Object.keys(choice.relationship || {}).length) failures.push(`${choice.id}: PRIVATE_NOTE changes relationship immediately`);
  if (choice.reactionActor && named.has(choice.reactionActor)) {
    const sequence = choice.reactionSequence || [[choice.reactionActor, choice.reaction || '']];
    for (const [speaker, text] of sequence) {
      if (speaker !== choice.reactionActor && !named.has(speaker)) failures.push(`${choice.id}: named reactionActor has non-speaker sequence`);
      if (named.has(speaker) && typeof text === 'string') {
        const otherPrefix = [...named].find((name) => name !== speaker && text.startsWith(`${name}:`));
        if (otherPrefix) failures.push(`${choice.id}: reaction text speaker prefix ${otherPrefix} differs from ${speaker}`);
      }
    }
    if (!choice.reactionSequence && narratorPatterns.some((pattern) => pattern.test(choice.reaction || ''))) failures.push(`${choice.id}: named reactionActor has narrator reaction`);
  }
}
const report = { schemaVersion: 'V36-ACTOR-VISIBILITY-AUDIT-1', status: failures.length ? 'FAIL' : 'PASS', choiceCount: rows.length, failures, rows };
fs.mkdirSync('docs/v36', { recursive: true });
fs.writeFileSync('docs/v36/ACTOR_VISIBILITY_AUDIT.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, choiceCount: report.choiceCount, failures }, null, 2));
if (failures.length) process.exit(1);
