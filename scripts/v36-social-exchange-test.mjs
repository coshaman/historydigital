import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const json = async file => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
const mapIds = ['nevsky','printshop','chancery','courtyard','market-quay','police-station'];
const characterFiles = (await (await import('node:fs/promises')).readdir(new URL('../rpg/characters/', import.meta.url)))
  .filter(file => file.endsWith('.json'));
const [maps, cards] = await Promise.all([
  Promise.all(mapIds.map(async id => [id, await json(`../rpg/maps/${id}.json`)])),
  Promise.all(characterFiles.map(file => json(`../rpg/characters/${file}`))).then(records => records.filter(card => mapIds.includes(card.start.mapId))),
]);
const mapTable = Object.fromEntries(maps);

let state = game.createInitialState({ maps: mapTable, hostCards: cards, startMapId: 'market-quay' });
const baker = state.hosts.baker_fyodor, seller = state.hosts.market_nadezhda;
const startingFunds = { baker: baker.money.amount, seller: seller.money.amount };
const possessed = structuredClone(state);
possessed.player.embodiment = 'baker_fyodor';
const paused = game.advanceNpcWorld(possessed, 90, mapTable);
assert.equal(paused.ledger.flatMap(event => event.exchanges ?? []).length, 0, 'a possessed resident cannot autonomously trade');

const exchanges = [];
const movementTrace = [];
for (let minute = 0; minute < 180; minute += 1) {
  const ledgerLength = state.ledger.length;
  state = game.advanceNpcWorld(state, 1, mapTable);
  const event = state.ledger.length > ledgerLength ? state.ledger.at(-1) : null;
  movementTrace.push(...(event?.moves ?? []).filter(move => ['baker_fyodor','market_nadezhda'].includes(move.hostId)).map(move => ({ minute, hostId: move.hostId, mapId: move.toMapId, position: move.to })));
  for (const exchange of event?.exchanges ?? []) {
    const sellerNow = state.hosts[exchange.recipientHostId], bakerNow = state.hosts[exchange.hostId];
    assert.equal(bakerNow.mapId, sellerNow.mapId, 'the exchange must happen on the same physical map');
    assert.ok(Math.abs(bakerNow.position.x - sellerNow.position.x) + Math.abs(bakerNow.position.y - sellerNow.position.y) <= 1, 'the residents must be adjacent at handoff');
    exchanges.push({ ...exchange, occurredAt: event.startClockMinutes + exchange.minute });
  }
}
assert.equal(exchanges.length, 1, `the scheduled market exchange should occur once; nearby=${JSON.stringify({ baker: { mapId: state.hosts.baker_fyodor.mapId, position: state.hosts.baker_fyodor.position, taskId: state.hosts.baker_fyodor.routineTaskCompletedId }, seller: { mapId: state.hosts.market_nadezhda.mapId, position: state.hosts.market_nadezhda.position }, movementTrace })}`);
assert.equal(exchanges[0].hostId, 'baker_fyodor');
assert.equal(exchanges[0].recipientHostId, 'market_nadezhda');
assert.equal(exchanges[0].itemKo, '빵 한 묶음');
assert.equal(exchanges[0].moneyAmount, 3);
assert.equal(exchanges[0].occurredAt, 600, 'the pair waits until the scheduled market transaction time');
assert.equal(state.hosts.baker_fyodor.inventory.includes('빵 한 묶음'), false);
assert.equal(state.hosts.market_nadezhda.inventory.includes('빵 한 묶음'), true);
assert.equal(state.hosts.baker_fyodor.money.amount, startingFunds.baker + 3);
assert.equal(state.hosts.market_nadezhda.money.amount, startingFunds.seller - 3);
assert.equal(state.hosts.baker_fyodor.relations.market_nadezhda, '빵값을 치른 거래 이웃');
assert.equal(state.hosts.market_nadezhda.relations.baker_fyodor, '빵을 산 거래 이웃');
const loaded = game.loadGame(game.saveGame(state), { maps: mapTable, hostCards: cards });
assert.equal(game.stateHash(loaded), game.stateHash(state), 'trade, goods, funds, and relationship survive save/load');
console.log(JSON.stringify({ status: 'PASS', exchangeCount: exchanges.length, exchange: exchanges[0], goodsAndFundsTransferred: true, relationshipRecordedForBothResidents: true, possessionPausesTrade: true, saveReloadParity: true }, null, 2));
