import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const batchIds = ['teacher_lyubov', 'watercarrier_luka', 'servant_varvara', 'porter_gavrila', 'market_nadezhda', 'warehouse_pyotr'];
const questFiles = (await readdir(new URL('rpg/quests/', root))).filter(file => file.endsWith('.json'));
const individualQuests = await Promise.all(questFiles.map(file => readJson(`rpg/quests/${file}`)));
const bundle = await readJson('rpg/quests/resident-arcs-v36.json');
const quests = [...new Map([...individualQuests, ...bundle.quests].map(quest => [quest.id, quest])).values()];
const maps = Object.fromEntries(await Promise.all((await readdir(new URL('rpg/maps/', root))).filter(file => file.endsWith('.json'))
  .map(async file => { const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map]; })));

for (const hostId of batchIds) {
  const card = await readJson(`rpg/characters/${hostId}.json`);
  const goal = card.persistentPersonalGoals.find(item => item.kind === 'LIFE');
  assert.ok(goal, `${hostId} needs an authored personal life goal`);
  if (hostId === 'market_nadezhda') goal.successCondition.chainId = 'NADEZHDA_STALL_WEATHER_1847';
  if (hostId === 'warehouse_pyotr') goal.successCondition.chainId = 'PYOTR_MISSING_CRATE_AUDIT_1847';
  const chain = quests.filter(quest => quest.lifeChain?.id === goal.successCondition?.chainId)
    .sort((a, b) => a.lifeChain.stage - b.lifeChain.stage);
  assert.deepEqual(chain.map(quest => quest.lifeChain.stage), [1, 2, 3], `${hostId} needs a unique three-stage personal arc`);
  goal.successCondition.stageCount = chain.length;
  goal.autonomyStages = await Promise.all(chain.map(async quest => {
    assert.equal(quest.entry.requiredHostId, hostId, `${quest.id} must belong to ${hostId}`);
    assert.ok(card.allowedMaps.includes(quest.entry.mapId), `${hostId} cannot be routed to ${quest.entry.mapId}`);
    const map = maps[quest.entry.mapId];
    const marker = map?.layers.find(layer => layer.name === 'Interactions')?.objects.find(object => object.id === quest.entry.objectId);
    assert.ok(marker, `${quest.id} needs its real world marker`);
    return { stage: quest.lifeChain.stage, questId: quest.id, date: quest.date, mapId: quest.entry.mapId,
      position: { x: Math.floor(marker.x / 16), y: Math.floor(marker.y / 16) }, activityKo: `생활 문제 · ${quest.titleKo}`,
      prerequisiteQuestIds: quest.prerequisiteQuestIds ?? [], windowStartMinute: 1080, windowEndMinute: 1380, focusMinutes: 12 };
  }));
  await writeFile(new URL(`rpg/characters/${hostId}.json`, root), `${JSON.stringify(card, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify({ status: 'PASS', batchResidents: batchIds.length, uniquePersonalLifeStages: batchIds.length * 3,
  isolatedSharedChainReferences: ['market_nadezhda', 'warehouse_pyotr'], stageMarkersVerified: true }));
