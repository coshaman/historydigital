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
  if ((ending.dialogue || []).flat().some((line) => String(line).match(/만남이 아니다|친분을 뜻하지 않는다|접촉이 아니다|동일한 사상을 선언하는 결말이 아니다/))) failures.push(`ending/${ending.id}: disclaimer leaked into ending dialogue`);
}

for (const scene of data.scenes.filter((item) => sceneIds.includes(item.id))) {
  for (const choice of [...(scene.choices || []), ...(scene.postChoices || [])]) {
    for (const field of ['displayText', 'hint', 'spokenText']) if (!choice[field]) failures.push(`${scene.id}/${choice.id}: missing ${field}`);
    if (choice.displayText && choice.displayText.length > 80) failures.push(`${scene.id}/${choice.id}: displayText too long`);
  }
}

const runtime = fs.readFileSync('main20-runtime.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const gold = fs.readFileSync('gold-runtime.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
if (!runtime.includes("runtimeOwner") || !runtime.includes("main20")) failures.push('main20-runtime: missing explicit runtime ownership');
if (!app.includes('main20-mode') || !gold.includes('main20-mode')) failures.push('legacy handlers: missing MAIN20 ownership guard');
if (!runtime.includes('MAIN20_DEAD_END_STATES')) failures.push('main20-runtime: missing dead-end audit marker');
for (const required of ['endingLifeHeading', 'endingFuture', 'endingSources', '당신이라면', '이 결말의 근거']) if (!index.includes(required)) failures.push(`index.html: missing ending section ${required}`);
for (const required of ['endingFuture', 'endingSources', 'dataset.runtimeOwner']) if (!runtime.includes(required)) failures.push(`main20-runtime: missing ending/ownership render field ${required}`);
if (!fs.existsSync('docs/v41/CHOICE_COPY_AUDIT.tsv')) failures.push('docs/v41/CHOICE_COPY_AUDIT.tsv: missing');

if (failures.length) {
  console.error(`V41 life ending/choice/route audit: FAIL (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`V41 life ending/choice/route audit: PASS (${data.endings.length} endings, ${sceneIds.length} scenes)`);
