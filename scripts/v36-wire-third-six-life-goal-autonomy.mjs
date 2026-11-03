import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const batchIds = ['apothecary_yakov', 'baker_fyodor', 'bookbinder_elizaveta', 'carter_roman', 'coachman_timofey', 'fishseller_klavdiya'];
const questFiles = (await readdir(new URL('rpg/quests/', root))).filter(file => file.endsWith('.json'));
const quests = await Promise.all(questFiles.map(file => readJson(`rpg/quests/${file}`)));
const maps = Object.fromEntries(await Promise.all((await readdir(new URL('rpg/maps/', root))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));

for (const hostId of batchIds) {
  const card = await readJson(`rpg/characters/${hostId}.json`);
  const goal = card.persistentPersonalGoals.find(item => item.kind === 'LIFE');
  assert.ok(goal, `${hostId} needs an authored personal life goal`);
  const chain = quests.filter(quest => quest.lifeChain?.id === goal.successCondition?.chainId)
    .sort((a, b) => a.lifeChain.stage - b.lifeChain.stage);
  assert.deepEqual(chain.map(quest => quest.lifeChain.stage), [1, 2, 3], `${hostId} needs three linked physical stages`);
  goal.autonomyStages = await Promise.all(chain.map(async quest => {
    assert.equal(quest.entry.requiredHostId, hostId, `${quest.id} must belong to ${hostId}`);
    assert.ok(card.allowedMaps.includes(quest.entry.mapId), `${hostId} cannot be routed to ${quest.entry.mapId}`);
    const map = maps[quest.entry.mapId];
    const marker = map?.layers.find(layer => layer.name === 'Interactions')?.objects.find(object => object.id === quest.entry.objectId);
    assert.ok(marker, `${quest.id} needs its real world marker`);
    return { stage: quest.lifeChain.stage, questId: quest.id, date: quest.date, mapId: quest.entry.mapId,
      position: { x: Math.floor(marker.x / 16), y: Math.floor(marker.y / 16) },
      activityKo: `생활 문제 · ${quest.titleKo}`, prerequisiteQuestIds: quest.prerequisiteQuestIds ?? [],
      windowStartMinute: 720, windowEndMinute: 1380, focusMinutes: 12 };
  }));
  await writeFile(new URL(`rpg/characters/${hostId}.json`, root), `${JSON.stringify(card, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify({ status: 'PASS', batchResidents: batchIds.length, authoredLifeArcStages: batchIds.length * 3,
  deferredByHistoricalDateOrPrerequisite: [], stageMarkersVerified: true }));
