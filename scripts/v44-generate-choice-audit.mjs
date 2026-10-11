import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, 'narrative', 'MAIN_20MIN_DIALOGUE.json'), 'utf8'));
const registry = Object.fromEntries(Object.entries(data.v43ChoiceTypeRegistry || {}).map(([kind, ids]) => [kind, [...ids]]));
for (const [kind, ids] of Object.entries(data.v44ChoiceTypes || {})) { for (const other of Object.keys(registry)) registry[other] = registry[other].filter((id) => !ids.includes(id)); registry[kind] = [...new Set([...(registry[kind] || []), ...ids])]; }
const kindOf = (choice) => choice.choiceKind || Object.entries(registry).find(([, ids]) => ids.includes(choice.id))?.[0] || (choice.action ? 'ACTION' : 'DIALOGUE_RESPONSE');
const rows = [['scene', 'choice', 'oldText', 'choiceKind', 'philosophicalQuestion', 'newText', 'beliefEffect', 'actionEffect', 'NPCResponse', 'laterCallback', 'keep/remove']];
const add = (scene, choice, decision) => rows.push([scene, choice.id, choice.text || choice.spokenText || '', kindOf(choice), data.scenes.find((item) => item.id === scene)?.question || '당대의 사상·사회적 질문에 어떻게 답하는가', choice.text || choice.spokenText || '', JSON.stringify(choice.ideologyEffects || {}), kindOf(choice) === 'ACTION' ? choice.action || '' : 'none — opinion does not move a document', choice.reaction || 'local dialogue response', choice.callbackKey || 'none', decision]);
for (const scene of data.scenes) for (const field of ['choices', 'postChoices']) for (const choice of (scene[field] || [])) add(scene.id, choice, data.v44MainSceneIds?.includes(scene.id) ? 'keep' : 'remove');
for (const beat of [...data.ideologyPrologue.beats, ...data.c07IdeologicalFollowUp.beats]) for (const choice of beat.choices || []) add(beat.id, choice, 'keep');
for (const archived of data.archiveScenes || []) rows.push(['ARCHIVE', archived.id, archived.title, 'ARCHIVE', '이 자료를 필수 루트에 둘 것인가', archived.title, 'none', 'none', archived.reason, 'optional archive', 'remove']);
fs.mkdirSync(path.join(root, 'docs', 'v44'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'v44', 'PHILOSOPHICAL_CHOICE_AUDIT.tsv'), rows.map((row) => row.map((value) => String(value).replaceAll('\t', ' ').replaceAll('\n', ' ')).join('\t')).join('\n') + '\n');
console.log(`generated V44 philosophical choice audit: ${rows.length - 1} rows`);
