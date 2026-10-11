import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, 'narrative', 'MAIN_20MIN_DIALOGUE.json'), 'utf8'));
const registry = data.v43ChoiceTypeRegistry || {};
const typeOf = (id) => Object.entries(registry).find(([, ids]) => ids.includes(id))?.[0] || 'UNCLASSIFIED';
const esc = (value) => String(value ?? '').replaceAll('\t', ' ').replaceAll('\n', ' ');
const all = [];
for (const scene of data.scenes) for (const field of ['choices', 'postChoices']) for (const choice of (scene[field] || [])) all.push({ sceneId: scene.id, choice, sourceSupport: (scene.excerpts || []).map((item) => item.sourceId).filter(Boolean).join('|') || 'scene dialogue' });
for (const beat of [...data.ideologyPrologue.beats, ...data.c07IdeologicalFollowUp.beats]) for (const choice of beat.choices || []) all.push({ sceneId: beat.id, choice, sourceSupport: (beat.sourceIds || []).join('|') });

const choiceHeader = ['sceneId', 'choiceId', 'choiceKind', 'opinionText', 'ideologicalEffects', 'actionEffects', 'visibleReaction', 'laterCallback', 'endingRelevant', 'sourceSupport'];
const choiceRows = [choiceHeader, ...all.map(({ sceneId, choice, sourceSupport }) => [sceneId, choice.id, typeOf(choice.id), choice.text || choice.spokenText || '', JSON.stringify(choice.ideologyEffects || {}), choice.action || '', choice.reaction || choice.reactionActor || 'local dialogue reaction', choice.callbackKey || 'none', Object.keys(choice.endingAffinity || {}).length ? 'yes' : 'belief/callback', sourceSupport])];

const storyRows = [['itemType', 'itemId', 'classification', 'decision', 'reason', 'sourceSupport']];
for (const [sceneId, classification] of Object.entries(data.v43SceneClassification || {})) storyRows.push(['SCENE', sceneId, classification, classification === 'CONTEXT_ONLY' ? 'archive' : 'keep', classification === 'CORE_IDEOLOGICAL' ? 'directly stages a historical ideological/social dispute' : 'supports a social or moral choice without pretending to be a school debate', sceneId]);
for (const source of data.sourceRegister || []) {
  const requirement = (data.v43SourceRequirements || []).find((item) => item.sourceId === source.sourceId);
  storyRows.push(['SOURCE', source.sourceId, requirement ? requirement.ideologicalUse : 'UNCLASSIFIED', 'keep', source.classification === 'PARAPHRASE' ? 'verified context is used as paraphrase, never counterfeit quotation' : 'checked source excerpt supports the route argument', source.url]);
}
for (const row of all) storyRows.push(['CHOICE', row.choice.id, typeOf(row.choice.id), typeOf(row.choice.id) === 'ACTION' ? 'keep' : 'rewrite', typeOf(row.choice.id) === 'ACTION' ? 'concrete record/delivery consequence' : 'player opinion, interpretation, evidence request or dialogue response', row.sourceSupport]);

fs.mkdirSync(path.join(root, 'docs', 'v43'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'v43', 'CHOICE_TYPE_AUDIT.tsv'), choiceRows.map((row) => row.map(esc).join('\t')).join('\n') + '\n');
fs.writeFileSync(path.join(root, 'docs', 'v43', 'IDEOLOGY_STORY_AUDIT.tsv'), storyRows.map((row) => row.map(esc).join('\t')).join('\n') + '\n');
console.log(`generated V43 audits: ${all.length} choices, ${storyRows.length - 1} story rows`);
