import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd(), questDir = path.join(root, 'rpg', 'quests');
const cards = await Promise.all((await readdir(path.join(root, 'rpg', 'characters'))).filter(file => file.endsWith('.json'))
  .map(async file => JSON.parse(await readFile(path.join(root, 'rpg', 'characters', file), 'utf8'))));
const residents = cards.filter(card => card.kind === 'FICTIONAL' && !card.id.startsWith('literary_'));
const quests = (await Promise.all((await readdir(questDir)).filter(file => file.endsWith('.json') && file !== 'resident-arcs-v36.json' && file !== 'resident-arc-index.json')
  .map(async file => JSON.parse(await readFile(path.join(questDir, file), 'utf8')))));
const groups = new Map();
for (const quest of quests) if (quest.lifeChain?.stageCount === 3 && Array.isArray(quest.actions) && quest.historicalOutcome?.id) {
  const stages = groups.get(quest.lifeChain.id) ?? [];
  stages.push(quest); groups.set(quest.lifeChain.id, stages);
}
const candidates = new Map();
for (const [chainId, unsorted] of groups) {
  const stages = [...unsorted].sort((a, b) => a.lifeChain.stage - b.lifeChain.stage);
  if (stages.length !== 3 || stages.some((stage, index) => stage.lifeChain.stage !== index + 1)) continue;
  const hostId = stages[0].entry?.requiredHostId;
  if (!residents.some(card => card.id === hostId)) continue;
  const rows = candidates.get(hostId) ?? [];
  rows.push({ chainId, stages }); candidates.set(hostId, rows);
}
const selected = [];
for (const resident of residents) {
  const options = candidates.get(resident.id) ?? [];
  options.sort((a, b) => Number(Boolean(a.stages[0].prerequisiteQuestIds?.length)) - Number(Boolean(b.stages[0].prerequisiteQuestIds?.length))
    || Number(b.stages.some(stage => stage.socialChain)) - Number(a.stages.some(stage => stage.socialChain)) || a.chainId.localeCompare(b.chainId));
  if (!options.length) throw new Error(`missing resident life arc: ${resident.id}`);
  selected.push(...options[0].stages);
}
const bundle = { schemaVersion: 'V36_RESIDENT_ARC_BUNDLE_1', residentCount: residents.length, chainCount: selected.length / 3, quests: selected };
await writeFile(path.join(questDir, 'resident-arcs-v36.json'), `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', residents: residents.length, chains: bundle.chainCount, questRecords: selected.length }));
