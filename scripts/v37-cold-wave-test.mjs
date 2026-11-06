import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { weatherForDate } from '../rpg/engine/atmosphere.mjs';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const cardFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const [maps, cards, quest] = await Promise.all([
  Promise.all(mapFiles.map(async file => json(`../rpg/maps/${file}`))).then(records => Object.fromEntries(records.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.map(file => json(`../rpg/characters/${file}`))),
  json('../rpg/quests/cold-wave-firewood-1847.json'),
]);
const coldDate = '1847-01-01';
assert.equal(weatherForDate(coldDate, 0), 'snow');
const warm = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
warm.world.date = '1847-06-01';
assert.equal(game.advanceNpcWorld(warm, 1, maps).world.livingEventStates.E03, undefined,
  'a winter fuel event cannot start in warm-season weather');
assert.equal(game.performQuestAction(warm, { questId: quest.id, hostId: 'porter_gavrila', actionId: 'E03_BUY_FIREWOOD', objectId: quest.entry.objectId }, { quests: [quest], maps }).reason,
  'living_event_not_active', 'an untriggered event does not allow a stale or guessed choice');

const cold = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
cold.world.date = coldDate;
const triggered = game.advanceNpcWorld(cold, 1, maps);
const event = triggered.world.livingEventStates.E03;
assert.equal(event.status, 'ACTIVE');
assert.equal(event.stage, 'COLD_WAVE');
assert.equal(event.weather, 'snow');
assert.deepEqual(event.actorHostIds, ['tenant_mikhail', 'landlady_polina', 'porter_gavrila']);
assert.notEqual(triggered.hosts.tenant_mikhail.activeGoal.type, 'LIVING_EVENT_RESPONSE', 'Mikhail keeps his near-term scheduled shift ahead of the cold-wave errand');
assert.equal(triggered.hosts.landlady_polina.activeGoal.type, 'SCHEDULED_WORK', 'the cold wave does not pull Polina away from her current paid work');
assert.ok(triggered.ledger.flatMap(entry => entry.livingEvents ?? []).some(row => row.catalogEventId === 'E03' && row.stage === 'COLD_WAVE'));
const object = maps['market-quay'].layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
assert.equal(objectIsPresent(object, triggered, [quest]), true, 'the physical fuel ledger appears only after the weather trigger');

const acting = structuredClone(triggered);
acting.hosts.porter_gavrila.mapId = 'market-quay';
acting.hosts.porter_gavrila.position = { x: 12, y: 11 };
acting.player.position = { x: 12, y: 11 };
acting.player.embodiment = 'porter_gavrila';
acting.world.currentMapId = 'market-quay';
const purchased = game.performQuestAction(acting, { questId: quest.id, hostId: 'porter_gavrila', actionId: 'E03_BUY_FIREWOOD', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(purchased.ok, true, `the physical fuel choice is executable (${purchased.reason ?? 'unknown'})`);
assert.equal(purchased.state.world.livingEventStates.E03.stage, 'FIREWOOD_BOUGHT');
assert.equal(purchased.state.hosts.porter_gavrila.money.amount, acting.hosts.porter_gavrila.money.amount - 2);
assert.ok(purchased.state.hosts.porter_gavrila.inventory.includes('장작 한 단'));
assert.equal(purchased.state.hosts.tenant_mikhail.needs.safetyConcern, Math.max(0, acting.hosts.tenant_mikhail.needs.safetyConcern - 8));
assert.equal(purchased.state.ledger.at(-1).livingEvents[0].validationStatus, 'DESIGN_SEED_NOT_VERIFIED');
const reloaded = game.loadGame(game.saveGame(purchased.state), { maps, hostCards: cards, quests: [quest] });
assert.equal(game.stateHash(reloaded), game.stateHash(purchased.state), 'purchase, inventory, event state and concern survive save/load');

const pooled = structuredClone(triggered);
pooled.hosts.landlady_polina.mapId = 'market-quay';
pooled.hosts.landlady_polina.position = { x: 11, y: 11 };
pooled.hosts.tenant_mikhail.mapId = 'market-quay';
pooled.hosts.tenant_mikhail.position = { x: 10, y: 11 };
pooled.player.position = { x: 11, y: 11 };
pooled.player.embodiment = 'landlady_polina';
pooled.world.currentMapId = 'market-quay';
const shared = game.performQuestAction(pooled, { questId: quest.id, hostId: 'landlady_polina',
  actionId: 'E03_POOL_COURTYARD_FUEL', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(shared.ok, true, `the present household can share fuel cost (${shared.reason ?? 'unknown'})`);
assert.equal(shared.state.world.livingEventStates.E03.stage, 'COURTYARD_FUEL_POOLED');
assert.ok(shared.state.hosts.landlady_polina.inventory.includes('공용 장작 한 몫'));
assert.ok(shared.state.hosts.landlady_polina.relations.tenant_mikhail.includes('장작'));
assert.equal(shared.state.hosts.tenant_mikhail.needs.safetyConcern, Math.max(0, pooled.hosts.tenant_mikhail.needs.safetyConcern - 5));

const deferred = structuredClone(triggered);
deferred.hosts.porter_gavrila.mapId = 'market-quay';
deferred.hosts.porter_gavrila.position = { x: 12, y: 11 };
deferred.player.position = { x: 12, y: 11 };
deferred.player.embodiment = 'porter_gavrila';
deferred.world.currentMapId = 'market-quay';
const noPurchase = game.performQuestAction(deferred, { questId: quest.id, hostId: 'porter_gavrila',
  actionId: 'E03_LEAVE_FUEL_UNBOUGHT', objectId: quest.entry.objectId }, { quests: [quest], maps });
assert.equal(noPurchase.ok, true);
assert.equal(noPurchase.state.world.livingEventStates.E03.stage, 'FUEL_DEFERRED');
assert.equal(noPurchase.state.hosts.porter_gavrila.money.amount, deferred.hosts.porter_gavrila.money.amount);
assert.equal(noPurchase.state.hosts.tenant_mikhail.needs.safetyConcern, Math.min(100, deferred.hosts.tenant_mikhail.needs.safetyConcern + 4));

const unattended = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
unattended.world.date = coldDate;
const coldWithoutIntervention = game.advanceNpcWorld(unattended, 1441, maps);
assert.equal(coldWithoutIntervention.world.livingEventStates.E03.stage, 'COLD_PASSED');
assert.ok(coldWithoutIntervention.hosts.tenant_mikhail.needs.safetyConcern > unattended.hosts.tenant_mikhail.needs.safetyConcern);
assert.ok(coldWithoutIntervention.hosts.tenant_mikhail.completedWorkActionKeys.includes('0:V36_TENANT_RESERVE_RETURN_FARE'),
  'the cold-wave response does not suppress Mikhail’s scheduled paid shift');
assert.ok(coldWithoutIntervention.ledger.flatMap(entry => entry.livingEvents ?? []).some(row => row.catalogEventId === 'E03' && row.stage === 'COLD_PASSED'));
console.log(JSON.stringify({ status: 'PASS', triggerWeather: event.weather, playerChoices: quest.actions.length,
  purchaseCost: 2, unattendedConsequence: 'TENANT_COLD_CONCERN_INCREASED', saveLoad: 'PASS' }, null, 2));
