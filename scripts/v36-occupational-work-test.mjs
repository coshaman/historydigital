import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const mapFiles = (await readdir(new URL('../rpg/maps/', import.meta.url))).filter(file => file.endsWith('.json'));
const maps = Object.fromEntries(await Promise.all(mapFiles.map(async file => {
  const map = await readJson(`../rpg/maps/${file}`);
  return [map.mapId, map];
})));
const cardFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const hostCards = await Promise.all(cardFiles.map(file => readJson(`../rpg/characters/${file}`)));
const activeResidents = hostCards.filter(card => card.kind === 'FICTIONAL' && card.rosterClass !== 'EVENT_PERFORMER' && !card.id.startsWith('literary_'));
assert.equal(activeResidents.length, 36);
const workSlots = activeResidents.flatMap(card => card.schedule.filter(slot => slot.workAction).map(slot => ({ card, slot })));
assert.equal(workSlots.length, 72, 'each active resident has two authored job actions');
assert.equal(new Set(workSlots.map(({ slot }) => slot.workAction.id)).size, 72, 'work action IDs are unique');
assert.equal(new Set(workSlots.map(({ slot }) => slot.workAction.outputKo)).size, 72, 'work outputs are individually authored');

const runAction = ({ card, slot, minutes = 20, possessed = false, offsite = false }) => {
  const state = game.createInitialState({ maps, hostCards, startMapId: slot.mapId });
  const map = maps[slot.mapId], collision = map.layers.find(layer => layer.name === 'Collision');
  const positions = [slot.position, { x: slot.position.x, y: slot.position.y - 1 }, { x: slot.position.x + 1, y: slot.position.y },
    { x: slot.position.x, y: slot.position.y + 1 }, { x: slot.position.x - 1, y: slot.position.y }];
  const workplace = positions.find(position => position.x >= 0 && position.y >= 0 && position.x < map.width && position.y < map.height
    && Number(collision.data[position.y * collision.width + position.x] ?? 0) === 0);
  assert.ok(workplace, `${card.id} action has an adjacent walkable workplace tile`);
  let playerPlace = null;
  for (let y = 0; y < map.height && !playerPlace; y += 1) for (let x = 0; x < map.width && !playerPlace; x += 1) {
    if (Math.abs(x - workplace.x) + Math.abs(y - workplace.y) >= 4 && Number(collision.data[y * collision.width + x] ?? 0) === 0) playerPlace = { x, y };
  }
  if (playerPlace) state.player.position = { ...playerPlace };
  const host = state.hosts[card.id], originalMoney = host.money?.amount;
  for (const resident of Object.values(state.hosts)) if (resident.id !== card.id) resident.schedule = [];
  const isolatedSlot = structuredClone(slot);
  delete isolatedSlot.task;
  host.mapId = offsite ? (slot.mapId === 'market-quay' ? 'nevsky' : 'market-quay') : slot.mapId;
  host.position = { ...workplace };
  host.schedule = [{ ...isolatedSlot, atMinute: 540, position: workplace }];
  host.personalLifeGoals = [];
  host.lifeGoals = [];
  host.personalGoals = [];
  if (host.needs) host.needs.incomePressure = 0;
  if (possessed) {
    state.player.embodiment = host.id;
    host.activeGoal = { type: 'POSSESSED', selectedAtMinute: state.world.clockMinutes };
  }
  return { next: game.advanceNpcWorld(state, minutes, maps), originalMoney, hostId: card.id, item: slot.workAction.inventoryItemKo };
};

for (const item of workSlots) {
  const { next, originalMoney, hostId, item: product } = runAction(item);
  const host = next.hosts[hostId];
  assert.equal(host.workRecords?.filter(record => record.actionId === item.slot.workAction.id).length, 1,
    `${hostId} completes ${item.slot.workAction.id} after its authored work duration (target=${JSON.stringify(item.slot.position)}, map=${host.mapId}, pos=${JSON.stringify(host.position)}, routine=${host.routineState?.state}, goal=${host.activeGoal?.type}, clock=${next.world.clockMinutes})`);
  const output = next.ledger.flatMap(entry => entry.workOutputs ?? []).find(record => record.actionId === item.slot.workAction.id);
  assert.ok(output, `${item.slot.workAction.id} is recorded in the world ledger`);
  assert.equal(host.money?.amount, originalMoney, 'work output does not invent or credit wages');
  if (product) assert.ok(host.inventory.includes(product), `${item.slot.workAction.id} creates its explicitly authored item`);
}

const sample = workSlots.find(({ slot }) => slot.workAction.inventoryItemKo);
const partial = JSON.parse(JSON.stringify(runAction({ ...sample, minutes: 10 }).next));
assert.equal(partial.hosts[sample.card.id].workRecords?.some(record => record.actionId === sample.slot.workAction.id) ?? false, false,
  'partial work does not prematurely create an outcome');
const resumed = game.advanceNpcWorld(partial, 10, maps);
assert.equal(resumed.hosts[sample.card.id].workRecords?.filter(record => record.actionId === sample.slot.workAction.id).length, 1,
  'work progress persists across save-state shaped simulation chunks');
const twice = game.advanceNpcWorld(resumed, 30, maps);
assert.equal(twice.hosts[sample.card.id].workRecords.filter(record => record.actionId === sample.slot.workAction.id).length, 1,
  'one authored work action produces at most one result per in-game day');
const possessed = runAction({ ...sample, possessed: true, minutes: 30 }).next;
assert.equal(possessed.hosts[sample.card.id].workRecords?.some(record => record.actionId === sample.slot.workAction.id) ?? false, false,
  'resident work cannot be simulated while the player possesses that resident');
const offsite = runAction({ ...sample, offsite: true, minutes: 1 }).next;
assert.equal(offsite.hosts[sample.card.id].workRecords?.some(record => record.actionId === sample.slot.workAction.id) ?? false, false,
  'work produces no result away from its scheduled workplace');

console.log(JSON.stringify({ status: 'PASS', residents: activeResidents.length, authoredActions: workSlots.length,
  verifiedWorkOutputs: workSlots.length, inventedWages: false, partialProgressPersists: true }, null, 2));
