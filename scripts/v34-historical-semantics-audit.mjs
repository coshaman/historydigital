import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const failures = [];
if (data.schemaVersion !== 'MAIN-20MIN-DIALOGUE-V34') failures.push('schema');
if (data.scenes.map((scene) => scene.id).join(',') !== 'C03,C06,C07,E02,E07') failures.push('scene order');
if (data.scenes.map((scene) => Number(scene.date.slice(0, 4))).join(',') !== '1837,1841,1842,1847,1849') failures.push('chronology');
if (data.scenes.some((scene) => scene.excerpts.some((excerpt) => !excerpt.sourceUrl || !excerpt.provenance || !excerpt.verifiedSpan))) failures.push('source witness');
for (const id of ['C07', 'E02', 'E07']) { const current = data.scenes.find((scene) => scene.id === id); if (current.choices.every((choice) => ['alexei', 'ekaterina', 'pavel'].includes(choice.actor))) failures.push(`${id} still actor-choice pattern`); }
if (data.scenes.find((scene) => scene.id === 'E07').choices.length < 4) failures.push('E07 channels');
for (const ending of data.endings) { for (const field of ['meaningStatement', 'historicalAnalogyLimits', 'sourceScenes']) if (!ending[field]) failures.push(`${ending.id}/${field}`); if (!ending.rule?.requiredActions?.length || !ending.rule?.relationshipGate) failures.push(`${ending.id}/hard gate`); }
const report = { schemaVersion: 'V34-HISTORICAL-SEMANTICS-AUDIT-1', status: failures.length ? 'FAIL' : 'PASS', sceneOrder: data.scenes.map((scene) => scene.id), years: data.scenes.map((scene) => Number(scene.date.slice(0, 4))), c07e02e07IndependentChoices: data.scenes.filter((scene) => ['C07', 'E02', 'E07'].includes(scene.id)).map((scene) => ({ id: scene.id, actors: [...new Set(scene.choices.map((choice) => choice.actor))], choiceCount: scene.choices.length })), callbackCounts: data.scenes.filter((scene) => scene.memoryCallbacks).map((scene) => ({ id: scene.id, callbacks: scene.memoryCallbacks.length })), endings: data.endings.map((ending) => ({ id: ending.id, title: ending.title, requiredActions: ending.rule.requiredActions, relationshipGate: ending.rule.relationshipGate })), failures };
fs.mkdirSync('docs/v34', { recursive: true }); fs.writeFileSync('docs/v34/HISTORICAL_SEMANTICS_AUDIT.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); if (failures.length) process.exit(1);
