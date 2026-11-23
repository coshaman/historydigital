import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { mimeTypeFor } from '../server-mime.mjs';
import { attachCityServiceCounters, cityCounterOffers, performCityDayJobStep, purchaseCityCounterOffer, residentServiceAnswer } from '../rpg/engine/city-services.mjs';

const require = createRequire(import.meta.url);
const game = require('../rpg/engine/game-state.js');
const { createRpgAiService, MemorySessionStore } = require('../ai/v33/session-runtime.cjs');
const catalog = require('../rpg/data/city-services.json');
const jsonDirectory = async directory => Promise.all((await readdir(directory)).filter(file => file.endsWith('.json'))
  .map(async file => JSON.parse(await readFile(path.join(directory, file), 'utf8'))));
const [mapList, hostCards] = await Promise.all([jsonDirectory('rpg/maps'), jsonDirectory('rpg/characters')]);
const maps = Object.fromEntries(mapList.map(map => [map.mapId, map]));
attachCityServiceCounters(maps, catalog);
const output = path.resolve(process.env.V47_CITY_OUTPUT || 'artifacts/v47/CITY_SERVICES_BROWSER');
const staticRoot = path.resolve('dist-v33');
const origin = 'http://127.0.0.1:4197';
await mkdir(output, { recursive: true });

function parkAtCounter(counterId, minute) {
  const counter = catalog.counters[counterId];
  const state = game.createInitialState({ maps, hostCards, startMapId: counter.mapId });
  state.world.clockMinutes = minute;
  state.player.embodiment = 'courier_pavel';
  const buyer = state.hosts.courier_pavel, seller = state.hosts[counter.sellerId];
  const adjacent = [{ x: counter.tile.x, y: counter.tile.y + 1 }, { x: counter.tile.x - 1, y: counter.tile.y }]
    .find(({ x, y }) => game.canOccupy(maps[counter.mapId], x, y));
  assert.ok(adjacent, `${counter.counterKo} can be reached from a walkable tile`);
  state.player.position = adjacent;
  Object.assign(buyer, { mapId: counter.mapId, position: adjacent });
  Object.assign(seller, { mapId: counter.mapId, position: counter.tile });
  buyer.needs.hunger = 60;
  buyer.money.amount = 24;
  for (const host of Object.values(state.hosts)) if (![buyer.id, seller.id].includes(host.id) && host.mapId === counter.mapId) {
    if (game.nearTile(host.position, adjacent, 2)) host.position = { x: 2, y: 2 };
  }
  return state;
}

async function openGame(page, state, api = null) {
  page.setDefaultTimeout(10000);
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/rpg/')) {
      if (!api) return route.fulfill({ status: 503, json: { error: 'ai_not_configured' } });
      const res = await api.handle({ method: route.request().method(), path: url.pathname,
        origin, body: route.request().postDataJSON() });
      return route.fulfill({ status: res.status, json: res.body });
    }
    const filename = path.resolve(staticRoot, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
    if (!filename.startsWith(`${staticRoot}${path.sep}`)) return route.abort();
    try { return route.fulfill({ status: 200, body: await readFile(filename), contentType: mimeTypeFor(filename) }); }
    catch { return route.fulfill({ status: 404 }); }
  });
  await page.addInitScript(save => {
    if (!localStorage.getItem('v33-rpg-save')) localStorage.setItem('v33-rpg-save', save);
    localStorage.setItem('v34-tutorial-stage', 'done');
  }, game.saveGame(state));
  await page.goto(origin);
  await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
}

async function useLocalObject(page, name) {
  await page.locator('#use').click();
  const chooseCounter = page.locator('#actions button').filter({ hasText: `${name} 이용` });
  if (await chooseCounter.count()) await chooseCounter.click();
}

async function walkToPlatform(page, map, target) {
  const blocked = new Set();
  const directions = { right: [1, 0], up: [0, -1], down: [0, 1], left: [-1, 0] };
  const coordinate = () => page.evaluate(() => [Number(document.body.dataset.playerX), Number(document.body.dataset.playerY)]);
  const near = ([x, y]) => Math.abs(x - target.x) + Math.abs(y - target.y) <= 1;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const start = await coordinate();
    if (near(start)) return;
    const queue = [{ position: start, firstMove: null }], seen = new Set([...blocked, start.join(',')]);
    let move;
    while (queue.length && !move) {
      const { position: [x, y], firstMove } = queue.shift();
      for (const [direction, [dx, dy]] of Object.entries(directions)) {
        const position = [x + dx, y + dy], key = position.join(',');
        if (seen.has(key) || !game.canOccupy(map, ...position)) continue;
        seen.add(key);
        const candidate = firstMove ?? { direction, position };
        if (near(position)) { move = candidate; break; }
        queue.push({ position, firstMove: candidate });
      }
    }
    assert.ok(move, 'the quay remains reachable by another path when a resident blocks a tile');
    await page.locator(`[data-move="${move.direction}"]`).click();
    if ((await coordinate()).join(',') === start.join(',')) blocked.add(move.position.join(','));
  }
  assert.fail('the worker did not reach the quay platform');
}

async function workAtTheQuay(browser) {
  const job = catalog.dayJob;
  const initial = game.createInitialState({ maps, hostCards, startMapId: job.mapId });
  const worker = initial.hosts.courier_pavel, payer = initial.hosts[job.payerId];
  initial.player.embodiment = worker.id;
  initial.player.position = { x: job.board.tile.x - 1, y: job.board.tile.y };
  Object.assign(worker, { mapId: job.mapId, position: { ...initial.player.position } });
  assert.equal(performCityDayJobStep(initial, job, 'delivery').ok, false, 'the job pays only at the receiving platform');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), errors = [], screenshots = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await openGame(page, initial);
    const readSaved = () => page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state);
    await useLocalObject(page, job.board.name);
    await page.getByRole('button', { name: `상자를 맡는다 · 품삯 ${job.pay}코페이카` }).click();
    const inTransit = await readSaved();
    assert.ok(inTransit.hosts[worker.id].inventory.includes(job.cargoKo));
    assert.equal(inTransit.hosts[worker.id].money.amount, worker.money.amount);
    assert.equal(inTransit.hosts[payer.id].money.amount, payer.money.amount - job.pay);
    await page.screenshot({ path: path.join(output, 'carry-from-warehouse.png') }); screenshots.push('carry-from-warehouse.png');

    await walkToPlatform(page, maps[job.mapId], job.delivery.tile);
    await useLocalObject(page, job.delivery.name);
    await page.getByRole('button', { name: `상자를 내려놓고 ${job.pay}코페이카를 받는다` }).click();
    const delivered = await readSaved();
    assert.equal(delivered.hosts[worker.id].inventory.includes(job.cargoKo), false);
    assert.equal(delivered.hosts[worker.id].money.amount, worker.money.amount + job.pay);
    assert.equal(delivered.hosts[payer.id].money.amount, payer.money.amount - job.pay);
    assert.ok(delivered.hosts[worker.id].needs.fatigue >= inTransit.hosts[worker.id].needs.fatigue + job.fatigue);
    const ledger = delivered.ledger.filter(row => row.eventType.startsWith('CITY_JOB_'));
    assert.deepEqual(ledger.map(row => row.eventType), ['CITY_JOB_ACCEPTED', 'CITY_JOB_PAID']);
    assert.equal(performCityDayJobStep(delivered, job, 'delivery').reason, 'no_cargo');
    await page.screenshot({ path: path.join(output, 'wages-at-the-quay.png') }); screenshots.push('wages-at-the-quay.png');
    assert.deepEqual(errors, []);
    return { activity: 'day-job', worker: worker.id, stages: ledger, screenshots, pageErrors: errors };
  } finally { await context.close(); }
}

async function cityReading(browser) {
  const sourceId = 'LIT-TURGENEV-KHOR-KALYNYCH-1847';
  const surfaces = [
    { id: 'purchased-issue', mapId: 'nevsky', object: item => item.type === 'shop-counter' },
    { id: 'bookshop-copy', mapId: 'bookshop-interior', object: item => item.properties?.some(p => p.name === 'sourceId' && p.value === sourceId) },
  ];
  const results = [];
  for (const surface of surfaces) {
    const { mapId } = surface, map = maps[mapId];
    const object = map.layers.find(layer => layer.name === 'Interactions').objects.find(surface.object);
    const x = object.x / 16, y = object.y / 16;
    const initial = game.createInitialState({ maps, hostCards, startMapId: mapId });
    const position = [{ x, y: y - 1 }, { x: x + 1, y }, { x, y: y + 1 }, { x: x - 1, y }]
      .find(tile => game.canOccupy(map, tile.x, tile.y));
    initial.player.embodiment = 'courier_pavel';
    initial.player.position = position;
    Object.assign(initial.hosts.courier_pavel, { mapId, position, money: { ...initial.hosts.courier_pavel.money, amount: 24 } });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    try {
      await openGame(page, initial);
      await useLocalObject(page, object.name);
      if (surface.id === 'purchased-issue') {
        await page.locator('#actions button').filter({ hasText: '《현대인》 1847년 제1호' }).click();
        await page.getByRole('button', { name: '구입한 호를 읽는다' }).click();
      } else {
        const selectBook = page.locator('#actions button').filter({ hasText: /자료 읽기.*호리와 칼리니치/ });
        if (await selectBook.count()) await selectBook.click();
      }
      await page.locator('#source-reader[open]').waitFor({ state: 'visible' });
      assert.match(await page.locator('#source-reader-title').innerText(), /호리와 칼리니치/);
      assert.ok(await page.locator('.source-passage-ru').count() > 1);
      assert.equal(await page.locator('.source-passage-ru').count(), await page.locator('.source-passage-ko').count());
      await page.screenshot({ path: path.join(output, `${surface.id}.png`) });
      await page.locator('#source-reader-complete').click();
      await page.locator('#save').click();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state);
      const read = saved.ledger.find(row => row.sourceId === sourceId);
      assert.equal(read?.readingMode, surface.id === 'purchased-issue' ? 'PLAYER_ARCHIVE' : 'PHYSICAL_COPY');
      assert.ok(saved.player.observedEvidenceIds.includes(sourceId));
      if (surface.id === 'purchased-issue') assert.equal(saved.hosts.courier_pavel.money.amount, 20);
      assert.deepEqual(errors, []);
      results.push({ activity: surface.id, sourceId, readingMode: read.readingMode, screenshot: `${surface.id}.png`, pageErrors: errors });
    } finally { await context.close(); }
  }
  return results;
}

const samples = [
  { counterId: 'anna-clothes', minute: 780, topic: 'clothes', items: ['wool-shawl'], width: 1440, height: 900 },
  { counterId: 'irina-tavern', minute: 1020, topic: 'meal', items: ['shchi-and-pie', 'anise-spirit'], width: 390, height: 844 },
];
const reports = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
try {
  const workOnly = process.argv.includes('--work-only'), readingOnly = process.argv.includes('--reading-only');
  for (const sample of workOnly || readingOnly ? [] : samples) {
    const counter = catalog.counters[sample.counterId], initial = parkAtCounter(sample.counterId, sample.minute);
    assert.equal(cityCounterOffers(initial, counter).offers.length, 2);
    const remote = structuredClone(initial);
    remote.hosts.courier_pavel.position = { x: 2, y: 2 };
    assert.equal(purchaseCityCounterOffer(remote, counter, sample.items[0]).reason, 'counter_unavailable');
    const closed = structuredClone(initial);
    closed.world.clockMinutes = counter.closesMinute;
    assert.equal(purchaseCityCounterOffer(closed, counter, sample.items[0]).reason, 'counter_closed');
    const noCash = structuredClone(initial);
    noCash.hosts.courier_pavel.money.amount = 0;
    assert.equal(purchaseCityCounterOffer(noCash, counter, sample.items[0]).reason, 'insufficient_funds');
    const topicsSeen = [];
    const service = createRpgAiService({ secret: 'browser-fixture-secret-only-for-mock-sessions', store: new MemorySessionStore(),
      allowedOrigins: [origin], provider: { generate: async ({ input }) => {
        const topic = catalog.topics[sample.topic];
        if (!input.character.cityServiceKnowledge.some(row => row.topicId === sample.topic)) throw new Error('NPC was missing their service knowledge');
        topicsSeen.push({ mapId: input.conversation.sceneContext.mapId, topic: sample.topic, npc: input.character.id });
        return { schemaVersion: 'V33_RPG_DIALOGUE_V2', sceneId: input.scene.id,
          beats: [{ speakerId: input.character.id, textKo: topic.residents[input.character.id], emotion: 'neutral', claimIds: [] }],
          suggestedReplies: [{ id: 'R1', textKo: '그곳에 가서 한번 살펴볼게요.', tone: 'curious' },
            { id: 'R2', textKo: '덕분에 어디로 갈지 알겠어요.', tone: 'empathetic' }] };
      } } });
    const context = await browser.newContext({ viewport: { width: sample.width, height: sample.height } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await openGame(page, initial, service);
    await page.locator('#talk').click();
    const question = catalog.topics[sample.topic].questionKo;
    await page.locator('.dialogue-input input').fill(question);
    await page.locator('.dialogue-input button').click();
    await page.locator('#journal-text').filter({ hasText: catalog.topics[sample.topic].residents[counter.sellerId] }).waitFor({ state: 'visible' });
    assert.deepEqual(topicsSeen, [{ mapId: counter.mapId, topic: sample.topic, npc: counter.sellerId }]);
    assert.match(await page.locator('#record').innerText(), /AI 생성 답변/);
    await page.getByRole('button', { name: '대화 마치기' }).click();
    const shots = [];
    for (const id of sample.items) {
      await useLocalObject(page, counter.counterKo);
      const item = counter.products.find(product => product.id === id);
      const button = page.locator('#actions button').filter({ hasText: item.labelKo });
      await button.click();
      await page.locator('#journal-text').filter({ hasText: item.resultKo }).waitFor({ state: 'visible' });
      const shot = `${id}-${sample.width}.png`;
      await page.screenshot({ path: path.join(output, shot) }); shots.push(shot);
    }
    const readSaved = () => page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state);
    const saved = await readSaved();
    const receipts = saved.ledger.filter(event => event.eventType === 'CITY_COUNTER_PURCHASE');
    assert.deepEqual(receipts.map(row => row.productId), sample.items);
    const cost = receipts.reduce((sum, row) => sum + row.price, 0);
    assert.equal(saved.hosts.courier_pavel.money.amount, initial.hosts.courier_pavel.money.amount - cost);
    assert.equal(saved.hosts[counter.sellerId].money.amount, initial.hosts[counter.sellerId].money.amount + cost);
    assert.equal(saved.ledger.some(row => row.eventType === 'DIALOGUE_TURN' && row.hostId === counter.sellerId && row.aiGenerated), true);
    if (sample.topic === 'clothes') assert.ok(saved.hosts.courier_pavel.inventory.includes('모직 어깨숄'));
    if (sample.topic === 'meal') assert.ok(saved.hosts.courier_pavel.needs.hunger < initial.hosts.courier_pavel.needs.hunger);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
    assert.deepEqual((await readSaved()).ledger.filter(event => event.eventType === 'CITY_COUNTER_PURCHASE'), receipts);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    assert.ok(residentServiceAnswer(catalog, counter.sellerId, initial.world.date, question));
    reports.push({ counterId: sample.counterId, viewport: [sample.width, sample.height], topicsSeen, receipts, screenshots: shots, pageErrors: errors });
    await context.close();
  }
  if (!readingOnly) reports.push(await workAtTheQuay(browser));
  if (!workOnly) reports.push(...await cityReading(browser));
} finally { await browser.close(); }
await writeFile(path.join(output, 'REPORT.json'), `${JSON.stringify({ status: 'PASS', provider: 'mock', reports }, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', output, reports }, null, 2));
