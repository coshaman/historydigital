import fs from 'node:fs';
const d = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const failures = [];
const dates = d.scenes.map((scene) => scene.date).map((date) => Number(String(date).slice(0, 4)));
if (JSON.stringify(dates) !== JSON.stringify([...dates].sort((a, b) => a - b))) failures.push('CHRONOLOGY_NOT_ASCENDING');
for (const scene of d.scenes) {
  if (scene.choices.length !== 3 || scene.postChoices.length !== 3) failures.push(`${scene.id}:CHOICE_COUNT`);
  if (scene.excerpts.length < 2) failures.push(`${scene.id}:INSUFFICIENT_SUBSTANTIVE_EXCERPTS`);
  if (scene.excerpts.some((item) => item.sourceQuality === 'ARCHIVAL_METADATA' || item.quoteClass === 'METADATA')) failures.push(`${scene.id}:METADATA_AS_BODY`);
  if (new Set(scene.choices.map((item) => item.text)).size !== 3 || new Set(scene.postChoices.map((item) => item.text)).size !== 3) failures.push(`${scene.id}:DUPLICATE_CHOICE_COPY`);
  if (scene.laterDocuments?.some((item) => Number(String(item.availableDate).slice(0, 4)) <= Number(String(scene.date).slice(0, 4)) && item.status !== 'LATER_DOCUMENT_NOT_IN_INITIAL_SCENE')) failures.push(`${scene.id}:LATER_DOCUMENT_DATE`);
}
const e07 = d.scenes.find((scene) => scene.id === 'E07');
if (!e07.metadata?.length || e07.metadata.some((item) => !item.role.includes('본문'))) failures.push('E07_METADATA_BOUNDARY');
const report = { schemaVersion: 'V31-SOURCE-CHRONOLOGY-1', status: failures.length ? 'FAIL' : 'PASS', sceneOrder: d.scenes.map((scene) => scene.id), dates, substantiveExcerptCounts: Object.fromEntries(d.scenes.map((scene) => [scene.id, scene.excerpts.length])), e07MetadataRows: e07.metadata.length, failures, checkedAt: new Date().toISOString() };
fs.mkdirSync('docs/v31', { recursive: true }); fs.writeFileSync('docs/v31/CHRONOLOGY_AND_AVAILABILITY.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); if (report.status !== 'PASS') process.exit(1);
