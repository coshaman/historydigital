import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { objectIsPresent, questPrerequisitesMet } from '../rpg/engine/world-presentation.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const stageIds = ['bakery-flour-1847','market-prices-1847','warehouse-loss-record-1847','carter-delivery-delay-1847','porter-load-1847','landlady-rent-commons-1847'];
const hostIds = ['baker_fyodor','market_nadezhda','warehouse_pyotr','carter_roman','porter_gavrila','landlady_polina'];
const mapIds = ['nevsky','printshop','chancery','courtyard','market-quay','police-station','dead-souls','overcoat'];
const maps = Object.fromEntries(await Promise.all(mapIds.map(async id => [id, await json(`../rpg/maps/${id}.json`)])));
const quests = await Promise.all(stageIds.map(id => json(`../rpg/quests/${id}.json`)));
const hostCards = await Promise.all(hostIds.map(id => json(`../rpg/characters/${id}.json`)));

function questObject(quest) {
  return maps[quest.entry.mapId].layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === quest.entry.objectId);
}

function runRoute(actionIndexes) {
  let state = game.createInitialState({ maps, hostCards, quests, startMapId: 'market-quay' });
  const lockChecks = [];
  for (let index = 0; index < quests.length; index += 1) {
    const quest = quests[index], object = questObject(quest);
    assert.equal(objectIsPresent(object, state, quests), true, `stage ${index + 1} becomes physically visible when unlocked`);
    assert.equal(questPrerequisitesMet(state, quest), true);
    const position = { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) };
    state.world.currentMapId = quest.entry.mapId;
    state.player.embodiment = hostIds[index];
    state.player.position = { ...position };
    state.hosts[hostIds[index]].mapId = quest.entry.mapId;
    state.hosts[hostIds[index]].position = { ...position };
    if (index > 0) {
      const locked = game.performQuestAction(state, { questId: quests[index + 1]?.id ?? 'LANDLADY_RENT_COMMONS_1847', hostId: hostIds[Math.min(index + 1, hostIds.length - 1)], actionId: quests[index + 1]?.actions[0].id ?? 'LANDLADY_POLINA_CHOICE_1', objectId: quests[index + 1] ? questObject(quests[index + 1]).id : 96 }, { quests, maps });
      if (index < quests.length - 1) {
        assert.equal(locked.ok, false);
        assert.equal(locked.reason, 'quest_chain_locked');
        lockChecks.push(locked.reason);
      }
    }
    const action = quest.actions[actionIndexes[index]];
    const applied = game.performQuestAction(state, { questId: quest.id, hostId: hostIds[index], actionId: action.id, objectId: object.id }, { quests, maps });
    assert.equal(applied.ok, true, `stage ${index + 1}: ${applied.reason}`);
    state = applied.state;
    const saved = game.saveGame(state);
    const restored = game.loadGame(saved, { maps, hostCards, quests });
    assert.equal(game.stateHash(restored), game.stateHash(state), `stage ${index + 1} survives save/reload`);
    if (index < quests.length - 1) {
      assert.equal(questPrerequisitesMet(state, quests[index + 1]), true);
      assert.equal(objectIsPresent(questObject(quests[index + 1]), state, quests), true);
    }
  }
  return { state, lockChecks };
}

const routeA = runRoute([0,0,0,0,1,2]);
const routeB = runRoute([1,1,2,1,2,0]);
const chainA = routeA.state.world.lifeChains.MARKET_MEAL_ROUTE_1847;
const chainB = routeB.state.world.lifeChains.MARKET_MEAL_ROUTE_1847;
assert.equal(chainA.stage, 6);
assert.equal(chainA.history.length, 6);
assert.equal(chainA.history.every((entry, index) => entry.stage === index + 1 && entry.hostId === hostIds[index]), true);
assert.notDeepEqual(chainA.metrics, chainB.metrics, 'different resident choices change persisted household/trade consequences');
assert.equal(routeA.state.quests.LANDLADY_RENT_COMMONS_1847.status, 'resolved');
console.log(JSON.stringify({ status: 'PASS', residents: hostIds.length, stages: quests.length, branchesReplayed: 2, lockChecks: routeA.lockChecks.length, savedStagesPerRoute: 6, divergentFinalMetrics: true, metricsA: chainA.metrics, metricsB: chainB.metrics }, null, 2));
