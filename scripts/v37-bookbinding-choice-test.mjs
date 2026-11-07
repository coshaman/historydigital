import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { questChoices } from '../rpg/engine/quest-presentation.mjs';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(new URL('../rpg/maps/', import.meta.url)), readdir(new URL('../rpg/characters/', import.meta.url)),
  read('../rpg/quests/bookbinding-order-choice-1847.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/maps/${file}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => read(`../rpg/characters/${file}`))),
]);
const map = maps['market-quay'];
const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(row => row.id === quest.entry.objectId);
assert.ok(object, 'the delivery choice sits at the physical market handover point');
const stateFor = () => {
  const state = game.createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'market-quay' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 660;
  state.world.currentMapId = 'market-quay'; state.player.embodiment = 'bookbinder_elizaveta';
  state.player.position = { x: 21, y: 14 }; state.quests[quest.id] = { status: 'open' };
  for (const [id, position] of Object.entries({ bookbinder_elizaveta: { x: 21, y: 14 }, bookseller_lev: { x: 22, y: 14 } })) {
    state.hosts[id].mapId = 'market-quay'; state.hosts[id].position = position;
  }
  state.hosts.bookbinder_elizaveta.inventory.push('제본 중인 책 한 권');
  state.world.livingEventStates.E08 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E08',
    status: 'ACTIVE', stage: 'BOOK_BOUND', startedAtMinute: 440, dayIndex: 0,
    binderHostId: 'bookbinder_elizaveta', booksellerHostId: 'bookseller_lev', itemKo: '제본 중인 책 한 권',
    contractTaskId: 'ELIZAVETA_BOOKBINDER_ORDER_TO_LEV_1847', valueStatus: 'fictional_gameplay_balance',
    validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
  return state;
};

const before = stateFor(); delete before.world.livingEventStates.E08;
assert.equal(objectIsPresent(object, before, [quest]), false, 'the handover point stays quiet before the book is bound');
const state = stateFor();
assert.equal(objectIsPresent(object, state, [quest]), true, 'the market handover opens for a bound book');
assert.deepEqual(questChoices(quest, 'bookbinder_elizaveta', [], state).map(row => row.action.id),
  ['E08_DELIVER_BOOK_NOW', 'E08_DEFER_DELIVERY'], 'the binder can deliver or keep the finished book');
const distant = structuredClone(state); distant.hosts.bookseller_lev.position = { x: 27, y: 14 };
assert.deepEqual(questChoices(quest, 'bookbinder_elizaveta', [], distant).map(row => row.action.id),
  ['E08_DEFER_DELIVERY'], 'cash delivery requires the actual buyer at the handover');

const delivered = game.performQuestAction(state, { questId: quest.id, hostId: 'bookbinder_elizaveta',
  actionId: 'E08_DELIVER_BOOK_NOW', objectId: object.id }, { quests: [quest], maps });
assert.equal(delivered.ok, true, `the real buyer can accept and pay (${delivered.reason ?? ''})`);
assert.equal(delivered.state.world.livingEventStates.E08.stage, 'DELIVERED_PAID');
assert.equal(delivered.state.hosts.bookbinder_elizaveta.money.amount, state.hosts.bookbinder_elizaveta.money.amount + 2);
assert.equal(delivered.state.hosts.bookseller_lev.money.amount, state.hosts.bookseller_lev.money.amount - 2);
assert.ok(delivered.state.hosts.bookseller_lev.inventory.includes('제본 중인 책 한 권'));
assert.ok(!delivered.state.hosts.bookbinder_elizaveta.inventory.includes('제본 중인 책 한 권'));

const deferred = game.performQuestAction(stateFor(), { questId: quest.id, hostId: 'bookbinder_elizaveta',
  actionId: 'E08_DEFER_DELIVERY', objectId: object.id }, { quests: [quest], maps });
assert.equal(deferred.ok, true, `the binder can carry the book home (${deferred.reason ?? ''})`);
assert.equal(deferred.state.world.livingEventStates.E08.stage, 'BOOK_BOUND');
assert.equal(deferred.state.world.livingEventStates.E08.status, 'ACTIVE');
assert.ok(deferred.state.hosts.bookbinder_elizaveta.inventory.includes('제본 중인 책 한 권'));
assert.equal(deferred.state.hosts.bookbinder_elizaveta.completedSocialTaskDayById.ELIZAVETA_BOOKBINDER_ORDER_TO_LEV_1847, 0,
  'choosing to defer prevents the automatic sale for the rest of this day');
const deferralRecord = deferred.state.ledger.at(-1).livingEvents?.[0];
assert.equal(deferralRecord.witnessedByPlayer, true, 'the defer decision is recorded at the witnessed handover point');
assert.equal(deferralRecord.changeKo, '엘리자베타는 책을 가지고 돌아가 내일 다시 납품하기로 했다.');
const tomorrow = game.releaseHost(deferred.state, map).state;
tomorrow.world.clockMinutes = 1440; tomorrow.world.date = '1847-06-02';
tomorrow.world.currentMapId = 'market-quay'; tomorrow.player.position = { x: 25, y: 14 };
const scheduledDelivery = cards.find(card => card.id === 'bookbinder_elizaveta').schedule
  .find(slot => slot.task?.id === 'ELIZAVETA_BOOKBINDER_ORDER_TO_LEV_1847');
tomorrow.hosts.bookbinder_elizaveta.schedule = [{ ...structuredClone(scheduledDelivery), atMinute: 1,
  position: { x: 21, y: 14 } }];
tomorrow.hosts.bookseller_lev.schedule = [{ atMinute: 1, mapId: 'market-quay', position: { x: 22, y: 14 }, activityKo: '책방 주인을 기다린다' }];
tomorrow.hosts.bookbinder_elizaveta.mapId = tomorrow.hosts.bookseller_lev.mapId = 'market-quay';
tomorrow.hosts.bookbinder_elizaveta.position = { x: 21, y: 14 };
tomorrow.hosts.bookseller_lev.position = { x: 22, y: 14 };
const resumed = game.advanceNpcWorld(tomorrow, 2, maps);
assert.equal(resumed.world.livingEventStates.E08.stage, 'DELIVERED_PAID',
  'the deferred job resumes on the next daily exchange and resolves without a player');
assert.equal(resumed.world.livingEventStates.E08.status, 'RESOLVED');
assert.ok(resumed.hosts.bookseller_lev.inventory.includes('제본 중인 책 한 권'));
assert.ok(!resumed.hosts.bookbinder_elizaveta.inventory.includes('제본 중인 책 한 권'));
assert.equal(resumed.hosts.bookbinder_elizaveta.money.amount, tomorrow.hosts.bookbinder_elizaveta.money.amount + 2);
for (const result of [delivered, deferred]) {
  const restored = game.loadGame(game.saveGame(result.state), { maps, hostCards: cards, quests: [quest] });
  assert.deepEqual(restored.world.livingEventStates.E08, result.state.world.livingEventStates.E08,
    'the delivery decision survives save/load');
}
console.log('V37 E08 bookbinding choice: event-gated physical handover, real payment/item transfer, deferred sale, and save/load passed.');
