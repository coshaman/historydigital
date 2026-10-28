import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, 'narrative', 'MAIN_20MIN_DIALOGUE.json'), 'utf8'));
const failures = [];
const requiredOrder = ['PROLOGUE', 'ACT1_UVAROV', 'ACT2_CHAADAEV', 'ACT3_SLAVOPHILE_WESTERNIZER', 'ACT4_GOGOL_BELINSKY', 'ACT5_PETRASHEVSKY_CENSORSHIP', 'ENDING'];
if (JSON.stringify(data.v44RouteOrder) !== JSON.stringify(requiredOrder)) failures.push('required V44 route order missing');
if (!Array.isArray(data.archiveScenes) || !['C03', 'C06'].every((id) => data.archiveScenes.some((scene) => scene.id === id))) failures.push('C03/C06 archival source records were not preserved');
if ((data.v44MainSceneIds || []).some((id) => ['C03', 'C06'].includes(id))) failures.push('archived Pushkin/Lermontov scenes remain in the required MAIN20 route');
if (!['E02', 'E07'].every((id) => data.v44MainSceneIds?.includes(id)) || !fs.existsSync(path.join(root, 'narrative', 'E04_SCENE.json'))) failures.push('E02/E04/E07 playable vertical slice is incomplete');
if (!data.v44BeliefActionModel?.beliefs || !data.v44BeliefActionModel?.actions) failures.push('separate beliefs/actions state contract missing');
for (const id of ['V42-TABLE-OF-RANKS', 'V42-UVAROV-1833', 'V42-CHAADAEV-1836', 'V42-SLAVOPHILE-PRIMARY', 'V42-WESTERNIZER-PRIMARY', 'V42-GOGOL-1847', 'V42-BELINSKY-1847', 'V42-PETRASHEVSKY-SYNTHESIS-2021']) {
  const source = data.sourceRegister?.find((item) => item.sourceId === id);
  const meta = data.v44SourceMetadata?.find((item) => item.sourceId === id);
  if (!meta?.author || !meta?.workTitle || !meta?.ideologicalUse || !source?.originalRussian || !source?.koreanTranslation) failures.push(`${id}: V44 source metadata incomplete`);
}
const kinds = data.v44ChoiceTypes || {};
for (const kind of ['OPINION', 'INTERPRETATION', 'DIALOGUE_RESPONSE', 'EVIDENCE_REQUEST', 'ACTION']) if (!kinds[kind]?.length) failures.push(`choice kind ${kind} missing`);
if (!data.v44EndingSequence?.stages?.length || data.v44EndingSequence.stages.length < 7) failures.push('seven-stage ending sequence missing');
if (!data.v44ComprehensionGate?.length || data.v44ComprehensionGate.length < 8) failures.push('first-time comprehension gate missing');
if (!fs.existsSync(path.join(root, 'docs', 'v44', 'PHILOSOPHICAL_CHOICE_AUDIT.tsv'))) failures.push('V44 philosophical choice audit missing');
if (!fs.existsSync(path.join(root, 'docs', 'v44', 'PRUNED_FROM_MAIN_ROUTE.md'))) failures.push('V44 pruned route report missing');
if (failures.length) { console.error(`V44 philosophy-first audit: FAIL (${failures.length})`); failures.forEach((failure) => console.error(`- ${failure}`)); process.exitCode = 1; } else console.log('V44 philosophy-first audit: PASS');
