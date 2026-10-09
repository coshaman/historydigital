import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const failures = [];
if (data.schemaVersion !== 'MAIN-20MIN-DIALOGUE-V35') failures.push('schema');
const years = data.scenes.map((scene) => Number(scene.date.slice(0, 4)));
if (data.scenes.map((scene) => scene.id).join(',') !== 'C03,C06,C07,E02,E07') failures.push('scene order');
if (years.join(',') !== '1837,1841,1842,1847,1849') failures.push('chronology');
if (data.scenes.some((scene) => scene.excerpts.some((excerpt) => !excerpt.sourceUrl || !excerpt.provenance || !excerpt.verifiedSpan))) failures.push('source witness');
for (const ending of data.endings) {
  for (const field of ['meaningStatement', 'historicalAnalogyLimits', 'sourceScenes']) if (!ending[field]) failures.push(`${ending.id}/${field}`);
  if (!ending.rule?.requiredActions?.length || !ending.rule?.relationshipGate) failures.push(`${ending.id}/hard gate`);
}
const report = { schemaVersion: 'V36-HISTORICAL-REGRESSION-1', status: failures.length ? 'FAIL' : 'PASS', sceneOrder: data.scenes.map((scene) => scene.id), years, sourceWitnesses: data.scenes.reduce((n, scene) => n + scene.excerpts.length, 0), endings: data.endings.map((ending) => ending.id), failures };
fs.mkdirSync('docs/v36', { recursive: true });
fs.writeFileSync('docs/v36/HISTORICAL_REGRESSION.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);

