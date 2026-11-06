import { readdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const forbidden = /(?:허구|가상(?:의)?|재구성|게임\s*(?:내\s*)?설정|역사적\s*사실.{0,16}(?:아니|아님|단정|주장)|실제\s*(?:역사|인물|사건|기록|증언).{0,18}(?:아니|아님|않|주장|재현|복원|바뀌지)|뜻은\s*아닙니다|교류를\s*만들어\s*내지|역사\s*미검증|측량된\s*복원이\s*아닙니다)/giu;
const visibleKeys = new Set([
  'premiseKo', 'titleKo', 'labelKo', 'subcopyKo', 'resultKo', 'followupKo', 'situationKo',
  'textKo', 'entrySituationKo', 'choiceSubcopyKo', 'epilogueKo', 'contextKo', 'contextNoteKo', 'bodyKo', 'storyTextKo',
  'documentedLifeKo', 'routeContextKo', 'name', 'occupation', 'personalObjective', 'displayNameKo',
]);
const failures = [];
function inspectText(value, file, path) {
  forbidden.lastIndex = 0;
  if (forbidden.test(value)) failures.push(`${file}${path}: ${value}`);
}

function inspectJson(value, file, path = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => inspectJson(item, file, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    if (Array.isArray(value.properties)) for (const property of value.properties) {
      if (['storyTextKo', 'labelKo', 'promptKo', 'textKo'].includes(property.name) && typeof property.value === 'string') {
        inspectText(property.value, file, `${path}.properties.${property.name}`);
      }
    }
    if (value.hostLines && typeof value.hostLines === 'object') for (const [hostId, line] of Object.entries(value.hostLines)) {
      if (typeof line === 'string') inspectText(line, file, `${path}.hostLines.${hostId}`);
    }
    return Object.entries(value).forEach(([key, item]) => inspectJson(item, file, `${path}.${key}`));
  }
  if (typeof value !== 'string' || !visibleKeys.has(path.split('.').at(-1)?.replace(/\[\d+\]$/, ''))) return;
  inspectText(value, file, path.slice(1));
}

for (const file of ['index.html', 'rpg/main.js', 'rpg/engine/world-reaction-presentation.mjs']) {
  let text = await readFile(new URL(file, root), 'utf8');
  if (file === 'index.html') text = text.replace(/<dialog id="api-settings"[\s\S]*?<\/dialog>/, '');
  forbidden.lastIndex = 0;
  if (forbidden.test(text)) failures.push(`${file}: forbidden player-facing meta copy`);
}
const authoredDialogue = await readFile(new URL('rpg/ai/authored-dialogue.mjs', root), 'utf8');
for (const phrase of ['실제 역사와 같다고 말하는 건 아닙니다', '실제 관청 절차의 설명이 아닙니다', '이 허구 인물', '이 이야기 안에서만 통하는 허구']) {
  if (authoredDialogue.includes(phrase)) failures.push(`rpg/ai/authored-dialogue.mjs: player-facing dialogue contains meta disclaimer: ${phrase}`);
}
for (const directory of ['rpg/quests', 'rpg/maps', 'rpg/characters']) {
  for (const name of (await readdir(new URL(`${directory}/`, root))).filter(item => item.endsWith('.json'))) {
    const file = `${directory}/${name}`;
    inspectJson(JSON.parse(await readFile(new URL(file, root), 'utf8')), file);
  }
}
for (const file of ['rpg/data/scene-observations.json', 'rpg/data/source-reader-index.json', 'rpg/data/life-simulation.json',
  'rpg/data/learning-exam.json', 'rpg/data/historical-comparisons.json', 'rpg/quests/campaign.json']) {
  inspectJson(JSON.parse(await readFile(new URL(file, root), 'utf8')), file);
}

if (failures.length) {
  console.error(`v37-player-surface-copy-lint: ${failures.length} issue(s)\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('v37-player-surface-copy-lint: visible copy has no reconstruction, fiction, or gameplay-balance disclaimers — PASS');
