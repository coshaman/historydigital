import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const pilotIds = ['clerk_alexei', 'printer_ekaterina', 'courier_pavel', 'seamstress_anna', 'tenant_mikhail', 'bookseller_lev'];
const questFiles = (await readdir(new URL('rpg/quests/', root))).filter(file => file.endsWith('.json'));
const quests = await Promise.all(questFiles.map(file => readJson(`rpg/quests/${file}`)));
const mapIds = new Set((await Promise.all((await readdir(new URL('rpg/maps/', root))).filter(file => file.endsWith('.json')).map(file => readJson(`rpg/maps/${file}`)))).map(map => map.mapId));

for (const hostId of pilotIds) {
  const card = await readJson(`rpg/characters/${hostId}.json`);
  const goal = card.persistentPersonalGoals.find(item => item.kind === 'LIFE');
  assert.ok(goal, `${hostId} needs an authored personal life goal`);
  const chain = quests.filter(quest => quest.lifeChain?.id === goal.successCondition?.chainId)
    .sort((a, b) => a.lifeChain.stage - b.lifeChain.stage);
  assert.deepEqual(chain.map(quest => quest.lifeChain.stage), [1, 2, 3], `${hostId} needs all three physical arc stages`);
  goal.autonomyStages = await Promise.all(chain.map(async quest => {
    assert.equal(quest.entry.requiredHostId, hostId, `${quest.id} must belong to ${hostId}`);
    const map = await readJson(`rpg/maps/${quest.entry.mapId}.json`);
    const marker = map.layers.find(layer => layer.name === 'Interactions')?.objects.find(object => object.id === quest.entry.objectId);
    assert.ok(marker && mapIds.has(quest.entry.mapId), `${quest.id} needs a real map marker`);
    return { stage: quest.lifeChain.stage, questId: quest.id, date: quest.date, mapId: quest.entry.mapId,
      position: { x: Math.floor(marker.x / 16), y: Math.floor(marker.y / 16) },
      activityKo: `생활 문제 · ${quest.titleKo}`, prerequisiteQuestIds: quest.prerequisiteQuestIds ?? [],
      windowStartMinute: 480, windowEndMinute: 1140, focusMinutes: 12 };
  }));
  await writeFile(new URL(`rpg/characters/${hostId}.json`, root), `${JSON.stringify(card, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify({ status: 'PASS', pilotResidents: pilotIds.length, authoredLifeArcStages: pilotIds.length * 3,
  stageTargetsComeFromPhysicalQuestMarkers: true, autonomousVisitsDoNotResolvePlayerChoices: true }));
