import fs from 'node:fs';
import { chromium } from 'playwright';
const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const patterns = {
  UVAROV: { C03:[0,0], C06:[0,0], C07:[0,0], E02:[1,1], E07:[1,1] },
  BELINSKY: { C03:[1,1], C06:[1,1], C07:[1,1], E02:[0,0], E07:[0,0] },
  HERZEN: { C03:[2,2], C06:[2,2], C07:[2,2], E02:[2,2], E07:[2,2] },
  KHOMYAKOV: { C03:[1,1], C06:[1,1], C07:[2,2], E02:[1,1], E07:[3,3] },
  DOSTOEVSKY_PETRASHEVSKY: { C03:[2,2], C06:[2,2], C07:[1,1], E02:[0,2], E07:[0,0] }
};
function candidate(pattern) {
  const source = { flags: [], relationships: { alexei:0, ekaterina:0, pavel:0 }, history: [] };
  for (const scene of data.scenes) for (const kind of ['pre_read_choice','post_read_choice']) {
    const choice = kind === 'pre_read_choice' ? scene.choices[pattern[scene.id][0]] : scene.postChoices[pattern[scene.id][1]];
    source.flags.push(...(choice.flagsAdd || []));
    for (const [person, amount] of Object.entries(choice.relationship || {})) source.relationships[person] += amount;
    source.history.push({ sceneId: scene.id, kind, action: choice.action, flags: choice.flagsAdd || [] });
  }
  source.flags = [...new Set(source.flags)];
  return source;
}
const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
await page.goto('http://127.0.0.1:4173/?main20=1#v34-counterfactual'); await page.waitForFunction(() => Boolean(window.__main20));
const positives = {}; const negatives = {};
for (const [id, pattern] of Object.entries(patterns)) {
  const source = candidate(pattern);
  positives[id] = await page.evaluate((value) => window.__main20.resolveEndingFor(value), source);
  const required = data.endings.find((ending) => ending.id === id).rule.requiredActions[0];
  const altered = { ...source, history: source.history.filter((item) => item.action !== required) };
  altered.flags = [...new Set(altered.history.flatMap((item) => item.flags))];
  negatives[id] = { removedAction: required, resolved: await page.evaluate((value) => window.__main20.resolveEndingFor(value), altered) };
}
const memoryCases = [
  { id: 'alexei', sceneId: 'E07', history: [{ action:'public_citation' }, { action:'report_medical_fact_only' }] },
  { id: 'ekaterina', sceneId: 'E07', history: [{ action:'preserve_public_grief' }, { action:'literaryArgumentChoice' }] },
  { id: 'pavel', sceneId: 'E07', history: [{ action:'trace_print_route' }, { action:'networkReception' }] }
];
const memoryPositive = await page.evaluate((cases) => cases.map((item) => ({ id:item.id, callbackCharacters:window.__main20.memoryLineFor(item.sceneId, { history:item.history }).sort() })), memoryCases);
const memoryNegative = await page.evaluate((cases) => cases.map((item) => ({ id:item.id, callbackCharacters:window.__main20.memoryLineFor(item.sceneId, { history:[] }) })), memoryCases);
await browser.close();
const status = Object.entries(positives).every(([id, value]) => value === id) && Object.values(negatives).every((item) => item.resolved === null) && memoryPositive.every((item) => item.callbackCharacters.includes(item.id)) && memoryNegative.every((item) => item.callbackCharacters.length === 0);
const report = { schemaVersion:'V34-ENDING-MEMORY-COUNTERFACTUAL-1', status, positives, negatives, memoryPositive, memoryNegative };
fs.mkdirSync('docs/v34', { recursive:true }); fs.writeFileSync('docs/v34/ENDING_MEMORY_COUNTERFACTUAL_BROWSER.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2)); if (!status) process.exit(1);
