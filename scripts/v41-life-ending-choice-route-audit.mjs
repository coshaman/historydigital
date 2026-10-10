import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const failures = [];
const sceneIds = ['C03', 'C06', 'C07', 'E02', 'E07'];
const realPeople = ['세르게이 우바로프', '비사리온 벨린스키', '알렉산드르 게르첸', '알렉세이 호먀코프', '도스토옙스키', '페트라셰프스키'];

for (const ending of data.endings || []) {
  for (const field of ['historicalPerson', 'historicalLifeSummary', 'historicalLifeSources', 'futureLife', 'whyThisResult']) {
    if (!ending[field]) failures.push(`ending/${ending.id}: missing ${field}`);
  }
  if (!realPeople.some((name) => String(ending.title || '').includes(name) || String(ending.historicalPerson || '').includes(name))) failures.push(`ending/${ending.id}: title/person is not a real historical life`);
  if (String(ending.historicalOutcome || '').match(/실제 역사는 바뀌지 않았습니다|친분을 맺었다|만남이 아닙니다/)) failures.push(`ending/${ending.id}: disclaimer leaked into main historical outcome`);
}

for (const scene of data.scenes.filter((item) => sceneIds.includes(item.id))) {
  for (const choice of scene.choices || []) {
    for (const field of ['displayText', 'hint', 'spokenText']) if (!choice[field]) failures.push(`${scene.id}/${choice.id}: missing ${field}`);
    if (choice.displayText && choice.displayText.length > 80) failures.push(`${scene.id}/${choice.id}: displayText too long`);
  }
}

const runtime = fs.readFileSync('main20-runtime.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const gold = fs.readFileSync('gold-runtime.js', 'utf8');
if (!runtime.includes("runtimeOwner") || !runtime.includes("main20")) failures.push('main20-runtime: missing explicit runtime ownership');
if (!app.includes('main20-mode') || !gold.includes('main20-mode')) failures.push('legacy handlers: missing MAIN20 ownership guard');
if (!runtime.includes('MAIN20_DEAD_END_STATES')) failures.push('main20-runtime: missing dead-end audit marker');
if (!fs.existsSync('docs/v41/CHOICE_COPY_AUDIT.tsv')) failures.push('docs/v41/CHOICE_COPY_AUDIT.tsv: missing');

if (failures.length) {
  console.error(`V41 life ending/choice/route audit: FAIL (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`V41 life ending/choice/route audit: PASS (${data.endings.length} endings, ${sceneIds.length} scenes)`);
