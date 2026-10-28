import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'narrative', 'MAIN_20MIN_DIALOGUE.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const failures = [];
const requireValue = (condition, message) => { if (!condition) failures.push(message); };

const dimensions = ['officialNationality', 'westernizer', 'slavophile', 'moralOrthodoxReform', 'publicLiteraryCriticism', 'socialReform', 'radicalDiscussion'];
const requiredSources = ['V42-UVAROV-1833', 'V42-TABLE-OF-RANKS', 'V42-CHAADAEV-1836', 'V42-WESTERNIZER-PRIMARY', 'V42-SLAVOPHILE-PRIMARY', 'V42-GOGOL-1847', 'V42-BELINSKY-1847', 'V42-PETRASHEVSKY-SYNTHESIS-2021'];
const requiredBeats = ['V42-PROLOGUE-EUROPEANIZATION', 'V42-PROLOGUE-RANKS', 'V42-PROLOGUE-UVAROV', 'V42-PROLOGUE-CHAADAEV', 'V42-C07-GOGOL-1847', 'V42-C07-BELINSKY-1847'];
const forbidden = ['OFFICIAL_NATIONALITY_EQUALS_SLAVOPHILISM', 'WESTERNIZER_COPIES_ALL_EUROPE', 'SLAVOPHILE_ETHNIC_NATIONALISM', 'GOGOL_GOVERNMENT_PROPAGANDA', 'BELINSKY_REVOLUTIONARY_SOCIALIST', 'PETRASHEVSKY_UNIFIED_PARTY', 'TABLE_OF_RANKS_IDEOLOGY'];

requireValue(data.ideologyDimensions && dimensions.every((key) => data.ideologyDimensions.includes(key)), 'missing ideologyDimensions');
requireValue(data.ideologyPrologue && data.ideologyPrologue.durationMinutes >= 3 && data.ideologyPrologue.durationMinutes <= 4, 'missing 3–4 minute ideologyPrologue');
requireValue(data.falseEquivalenceWarnings && forbidden.every((id) => data.falseEquivalenceWarnings.some((warning) => warning.id === id)), 'missing false-equivalence warnings');
requireValue(data.speechRegisterMatrix && ['alexei', 'ekaterina', 'pavel', 'protagonist'].every((key) => data.speechRegisterMatrix[key]), 'speech register matrix incomplete');
requireValue(data.sourceRegister && requiredSources.every((id) => data.sourceRegister.some((source) => source.sourceId === id)), 'required V42 source register incomplete');
const ids = new Set([
  ...(data.scenes || []).flatMap((scene) => [scene.id, ...(scene.beats || []).map((beat) => beat.id)]),
  ...(data.ideologyPrologue?.beats || []).map((beat) => beat.id),
  ...(data.c07IdeologicalFollowUp?.beats || []).map((beat) => beat.id)
]);
for (const id of requiredBeats) requireValue(ids.has(id), `missing required beat ${id}`);
requireValue(data.v44RouteOrder?.[0] === 'PROLOGUE' && data.v44RouteOrder.indexOf('ACT1_UVAROV') > 0, 'ideology prologue must precede the historical choice route');
requireValue(data.c07IdeologicalFollowUp?.chronologyOrder?.join('>') === '1842>1847-GOGOL>1847-BELINSKY', 'C07 1842→1847 chronology missing');
requireValue(!JSON.stringify(data).toLowerCase().includes('chekhov'), 'Chekhov is anachronistically present');

const choices = [
  ...(data.scenes || []).flatMap((scene) => [ ...(scene.choices || []), ...(scene.postChoices || []), ...(scene.ideologicalChoices || []) ]),
  ...(data.ideologyPrologue?.beats || []).flatMap((beat) => beat.choices || []),
  ...(data.c07IdeologicalFollowUp?.beats || []).flatMap((beat) => beat.choices || [])
];
const ideologicalChoices = choices.filter((choice) => choice.ideologyEffects || choice.callbackKey);
requireValue(ideologicalChoices.length >= 6, 'fewer than six ideological choices');
for (const choice of ideologicalChoices) {
  const direction = data.choiceImmediateDirections?.[choice.id] || choice.immediateDirection;
  requireValue(direction && direction.audience && direction.recordMode && direction.leavesOffice && direction.risk, `choice ${choice.id} lacks immediate direction fields`);
  requireValue(choice.sourcePrerequisite && data.sourceRegister.some((source) => source.sourceId === choice.sourcePrerequisite), `choice ${choice.id} lacks a registered source prerequisite`);
}

if (failures.length) {
  console.error(`V42 ideological history audit: FAIL (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('V42 ideological history audit: PASS');
}
