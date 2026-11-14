import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { mimeTypeFor } from '../server-mime.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { attachV47StoryObjects, v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { objectIsPresent } from '../rpg/engine/world-presentation.mjs';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';
import { v47RoleProfiles } from '../rpg/data/v47-character-roles.mjs';

const root = process.cwd();
const port = Number(process.env.V47_PREVIEW_PORT ?? 4174);
const base = process.env.V47_APP_URL ?? `http://127.0.0.1:${port}/`;
const localStaticRoot = path.resolve(root, 'dist');
const serveLocalBuild = async page => {
  if (process.env.V47_APP_URL) return;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || Number(url.port) !== port) return route.abort('blockedbyclient');
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, body: 'API is disabled in this static UI acceptance run.' });
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(localStaticRoot, relative);
    if (!target.startsWith(`${localStaticRoot}${path.sep}`) && target !== localStaticRoot) {
      return route.fulfill({ status: 403, body: 'Forbidden' });
    }
    try {
      const body = await readFile(target);
      return route.fulfill({ status: 200, body, headers: { 'content-type': mimeTypeFor(target), 'cache-control': 'no-store' } });
    } catch {
      return route.fulfill({ status: 404, body: 'Not found' });
    }
  });
};
const output = process.env.V47_BROWSER_OUTPUT
  ? path.resolve(root, process.env.V47_BROWSER_OUTPUT)
  : path.join(root, 'artifacts/v47/BROWSER_ACCEPTANCE');
const read = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const [mapFiles, cardFiles, registry, campaign] = await Promise.all([
  readdir(path.join(root, 'rpg/maps')), readdir(path.join(root, 'rpg/characters')),
  read('data/era_character_registry.json'),
  read('rpg/quests/campaign.json'),
]);
const [maps, cards, storyBeatQuests] = await Promise.all([
  Promise.all(mapFiles.filter(name => name.endsWith('.json')).map(name => read(`rpg/maps/${name}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardFiles.filter(name => name.endsWith('.json')).map(name => read(`rpg/characters/${name}`))),
  Promise.resolve(toV47StoryQuests()),
]);
const runtimeCards = decorateCardsWithEraProfiles(cards, { ...registry, runtime_profiles: { ...registry.runtime_profiles, ...v47RoleProfiles } });
attachV47StoryObjects(maps);
attachV47StoryBeatObjects(maps, storyBeatQuests);
const allQuests = [...v47StoryQuests, ...storyBeatQuests];
const scenarios = [
  { story: 'MAIN01', questId: 'V47_MAIN01_DISTRIBUTION_BAN', actionId: 'V47_A06_KEEP_COPY', viewport: { width: 390, height: 844 } },
  { story: 'MAIN01', questId: 'V47_MAIN01_SUBSCRIBER_REPLY', actionId: 'V47_A08_SEND_LETTER', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN01', questId: 'V47_MAIN01_SUBSCRIBER_REPLY', actionId: 'V47_A08_PROMISE_UNAVAILABLE_COPY', viewport: { width: 390, height: 844 } },
  { story: 'MAIN01', questId: 'V47_MAIN01_A05', actionId: 'V47_A05_COPY_LEDGER', viewport: { width: 390, height: 844 } },
  { story: 'MAIN01', questId: 'V47_MAIN01_A05', actionId: 'V47_A05_WITHHOLD_SIGNATURE', viewport: { width: 390, height: 844 } },
  { story: 'MAIN01', questId: 'V47_MAIN01_A11', actionId: 'V47_A11_SETTLE_WORKERS', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN01', questId: 'V47_MAIN01_A01', actionId: 'V47_A01_OPEN_SUBSCRIBER_LEDGER', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN01', questId: 'V47_MAIN01_A01', actionId: 'V47_A01_SEND_PAVEL_TO_PRINTSHOP', viewport: { width: 390, height: 844 } },
  { story: 'MAIN01', questId: 'V47_MAIN01_A11', actionId: 'V47_A11_FIND_REPLACEMENT_WORK', viewport: { width: 390, height: 844 } },
  { story: 'MAIN01', questId: 'V47_MAIN01_A11', actionId: 'V47_A11_PUBLIC_DISPOSAL_LIST', viewport: { width: 390, height: 844 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_ARRESTS', actionId: 'V47_P07_WARN_FICTIONAL', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_ARRESTS', actionId: 'V47_P07_SEAL_ROOM', viewport: { width: 390, height: 844 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_ARRESTS', actionId: 'V47_P07_SEPARATE_WITNESS', hostId: 'police_sergeant_ivan', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_ARRESTS', actionId: 'V47_P08_CLEAR_STAIRWELL', hostId: 'police_sergeant_ivan', startMapId: 'police-station', viewport: { width: 390, height: 844 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_ARRESTS', actionId: 'V47_P08_RECORD_WITNESSES', hostId: 'clerk_alexei', viewport: { width: 390, height: 844 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_P01', actionId: 'V47_P01_OPEN_DISCUSSION', viewport: { width: 390, height: 844 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_P01', actionId: 'V47_P01_READ_NEWS_FIRST', viewport: { width: 390, height: 844 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_C01', actionId: 'V47_C01_SUPPLY_LODGING', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_C01', actionId: 'V47_C01_SUPPLY_BAKERY', viewport: { width: 390, height: 844 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_WATER_NOTICE', actionId: 'V47_C00_CLEAN_WATER', viewport: { width: 390, height: 844 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_WATER_NOTICE', actionId: 'V47_C00_TEND_PATIENT', hostId: 'innkeeper_irina', viewport: { width: 390, height: 844 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_C03', actionId: 'V47_C03_SELL_ON_CREDIT', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_C03', actionId: 'V47_C03_REQUEST_STOCK', viewport: { width: 390, height: 844 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_C05', actionId: 'V47_C05_OPEN_BEDS', viewport: { width: 390, height: 844 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_C05', actionId: 'V47_C05_LISTEN_TO_FAMILY', hostId: 'doctor_mikhail_1848', viewport: { width: 390, height: 844 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_C06', actionId: 'V47_C06_PROTECT_CART', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_C06', actionId: 'V47_C06_REPEAT_RUMOR', viewport: { width: 390, height: 844 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_C11', actionId: 'V47_C11_REOPEN_ROOM', viewport: { width: 390, height: 844 } },
  { story: 'MAIN01', questId: 'V47_MAIN01_A03', actionId: 'V47_A03_HOST_READING', hostId: 'panaeva_1848', viewport: { width: 390, height: 844 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_P05', actionId: 'V47_P05_SHARE_COPY', hostId: 'petrashevsky_1849', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_P05', actionId: 'V47_P05_DISCUSS_ARGUMENT', hostId: 'petrashevsky_1849', viewport: { width: 390, height: 844 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_P03', actionId: 'V47_P03_SERFDOM_AND_LAND', hostId: 'student_vasily', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_P06', actionId: 'V47_P06_ASK_DIRECTLY', hostId: 'antonelli_1849', viewport: { width: 390, height: 844 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_P06', actionId: 'V47_P06_LOG_SOURCED_REPORT', hostId: 'antonelli_1849', viewport: { width: 390, height: 844 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_P06', actionId: 'V47_P06_ASSERT_UNVERIFIED_SUSPICION', hostId: 'clerk_alexei', viewport: { width: 390, height: 844 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_P07', actionId: 'V47_P07_SEPARATE_REPORTS', hostId: 'liprandi_1849', viewport: { width: 1440, height: 900 } },
  { story: 'MAIN03', questId: 'V47_MAIN03_P11', actionId: 'V47_P11_GUIDE_FAMILIES', hostId: 'student_vasily', viewport: { width: 390, height: 844 } },
  { story: 'MAIN05', questId: 'V47_MAIN05_C08', actionId: 'V47_C08_ASK_NEIGHBOR_HELP', hostId: 'doctor_mikhail_1848', viewport: { width: 390, height: 844 } },
];
const directionDelta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
async function walkAndConfirm(page, directions, label) {
  for (const direction of directions) {
    const before = await page.evaluate(() => ({ x: Number(document.body.dataset.playerX), y: Number(document.body.dataset.playerY) }));
    const [dx, dy] = directionDelta[direction];
    const expected = { x: before.x + dx, y: before.y + dy };
    await page.locator(`[data-move="${direction}"]`).click();
    try {
      await page.waitForFunction(position => {
        return Number(document.body.dataset.playerX) === position.x
          && Number(document.body.dataset.playerY) === position.y;
      }, expected, { timeout: 2500 });
    } catch {
      const debug = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state;
        const pad = document.querySelector('.touch-pad');
        const rect = pad?.getBoundingClientRect();
        const button = document.querySelector('[data-move="up"]');
        const buttonRect = button?.getBoundingClientRect();
        return { position: { x: Number(document.body.dataset.playerX), y: Number(document.body.dataset.playerY) },
          storedPosition: saved?.player?.position, hostId: saved?.player?.embodiment,
          hostPosition: saved?.hosts?.[saved?.player?.embodiment]?.position,
          blockers: Object.values(saved?.hosts ?? {}).filter(host => host.historicalAliveAndPresent !== false
            && host.mapId === saved?.world?.currentMapId && host.position.x === saved?.player?.position?.x
            && host.position.y === saved?.player?.position?.y).map(host => host.id),
          pad: { display: getComputedStyle(pad).display, width: rect?.width, height: rect?.height, top: rect?.top },
          button: { disabled: button?.disabled, hidden: button?.hidden, top: buttonRect?.top,
            width: buttonRect?.width, height: buttonRect?.height, clickCount: window.__moveClickCount ?? 0 },
          gameMap: saved?.world?.currentMapId, learningHidden: document.querySelector('#learning-screen')?.hidden,
          record: document.querySelector('#record')?.textContent };
      });
      throw new Error(`${label}: ${direction} input did not move ${JSON.stringify(before)} to ${JSON.stringify(expected)}; ${JSON.stringify(debug)}`);
    }
  }
}
if (process.env.V47_CODA_ONLY === '1') scenarios.length = 0;
if (process.env.V47_SCENARIO_ID) {
  const selectedScenario = scenarios.find(item => item.questId === process.env.V47_SCENARIO_ID
    && (!process.env.V47_SCENARIO_ACTION_ID || item.actionId === process.env.V47_SCENARIO_ACTION_ID));
  assert.ok(selectedScenario, `unknown V47_SCENARIO_ID/action ${process.env.V47_SCENARIO_ID}/${process.env.V47_SCENARIO_ACTION_ID ?? ''}`);
  scenarios.splice(0, scenarios.length, selectedScenario);
}
const browserScenarioIds = new Set(scenarios.map(scenario => scenario.questId));
if (process.env.V47_CODA_ONLY !== '1' && !process.env.V47_SCENARIO_ID) for (const quest of allQuests.filter(item => item.dialogue?.length)) {
  assert.ok(browserScenarioIds.has(quest.id), `${quest.id} has a browser scenario for its scripted dialogue`);
}
const hostFor = action => action.hostIds[0];
const makeSave = (quest, action, scenario) => {
  const map = maps[quest.entry.mapId];
  const object = map.layers.flatMap(layer => layer.objects ?? []).find(item => item.id === quest.entry.objectId);
  assert.ok(object, `${quest.id} has its physical map object`);
  const tile = { x: Math.floor(object.x / map.tilewidth), y: Math.floor(object.y / map.tileheight) };
  const adjacent = [[tile.x - 1, tile.y], [tile.x + 1, tile.y], [tile.x, tile.y - 1], [tile.x, tile.y + 1]]
    .find(([x, y]) => game.canOccupy(map, x, y));
  assert.ok(adjacent, `${quest.id} object has a reachable player tile`);
  const startMapId = scenario.startMapId ?? map.mapId;
  const state = game.createInitialState({ maps, hostCards: runtimeCards, quests: allQuests, startMapId });
  state.world.chapterId = quest.chapterId;
  state.world.date = quest.date;
  state.quests.E00 = { status: 'resolved', result: 'V47_BROWSER_ACCEPTANCE_SEEDED_PROLOGUE' };
  for (const card of runtimeCards) if (card.presenceWindow) {
    state.hosts[card.id].historicalAliveAndPresent = card.presenceWindow.startDate <= quest.date
      && quest.date <= card.presenceWindow.endDate;
  }
  state.world.clockMinutes = 600;
  state.world.currentMapId = startMapId;
  const startMap = maps[startMapId];
  state.player.position = startMapId === map.mapId ? { x: adjacent[0], y: adjacent[1] }
    : { ...startMap.metadata.observerStart };
  const hostId = scenario.hostId ?? hostFor(action);
  const hostCard = runtimeCards.find(card => card.id === hostId);
  assert.ok(hostCard?.allowedMaps?.includes(map.mapId), `${hostId} is allowed to enter ${map.mapId} for ${quest.id}`);
  assert.ok(!hostCard?.presenceWindow?.startDate || hostCard.presenceWindow.startDate <= quest.date,
    `${hostId} is present by ${quest.date}`);
  assert.ok(!hostCard?.presenceWindow?.endDate || hostCard.presenceWindow.endDate >= quest.date,
    `${hostId} has not left by ${quest.date}`);
  state.player.embodiment = hostId;
  state.hosts[hostId].historicalAliveAndPresent = true;
  state.hosts[hostId].mapId = startMapId;
  state.hosts[hostId].position = { ...state.player.position };
  state.quests[quest.id] = { ...state.quests[quest.id], status: 'open' };
  const arc = campaign.arcs.find(item => item.id === quest.chapterId);
  const questIndex = arc?.questIds.indexOf(quest.id) ?? -1;
  for (const priorId of questIndex > 0 ? arc.questIds.slice(0, questIndex) : []) {
    state.quests[priorId] = { ...state.quests[priorId], status: 'resolved' };
  }
  for (const prerequisiteId of quest.prerequisiteQuestIds ?? []) {
    state.quests[prerequisiteId] = { ...state.quests[prerequisiteId], status: 'resolved' };
  }
  assert.ok(objectIsPresent(object, state, allQuests), `${quest.id} object gates open at the seeded date and chapter`);
  if (startMapId === map.mapId) assert.ok(game.nearTile(state.player.position,
    { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) }, 1), `${quest.id} player starts adjacent to the event prop`);
  return { save: game.saveGame(state), object, hostId, mapId: map.mapId };
};
const makeOptionalCodaSave = () => {
  const arc = campaign.arcs.find(item => item.id === 'V33_1849_CIRCLE');
  const state = game.createInitialState({ maps, hostCards: runtimeCards, quests: allQuests, startMapId: 'chancery' });
  state.world.chapterId = arc.id;
  state.world.date = '1849-12-22';
  state.world.clockMinutes = 600;
  state.world.currentMapId = 'chancery';
  state.world.v47.focusStoryId = 'MAIN03';
  state.player.embodiment = null;
  for (const questId of arc.questIds) state.quests[questId] = { status: 'resolved' };
  for (const questId of arc.optionalQuestIds ?? []) state.quests[questId] = { status: 'open' };
  return game.saveGame(state);
};
const makePreludeSave = () => {
  const arc = campaign.arcs.find(item => item.id === 'V33_1849_PRELUDE');
  const state = game.createInitialState({ maps, hostCards: runtimeCards, quests: allQuests, startMapId: 'bookshop-interior' });
  state.world.chapterId = arc.id;
  state.world.date = '1849-03-20';
  state.world.clockMinutes = 600;
  state.world.currentMapId = 'bookshop-interior';
  state.world.v47.focusStoryId = 'MAIN03';
  state.player.embodiment = null;
  state.quests.V47_MAIN03_P04 = { status: 'open' };
  return game.saveGame(state);
};

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
const rows = [];
let optionalCoda = null;
let firstDateAdvance = null;
try {
  for (const scenario of scenarios) {
    const quest = allQuests.find(item => item.id === scenario.questId);
    const action = quest?.actions.find(item => item.id === scenario.actionId);
    assert.ok(quest && action, `${scenario.questId}/${scenario.actionId} is registered`);
    const { save, object, hostId, mapId } = makeSave(quest, action, scenario);
    const context = await browser.newContext({ viewport: scenario.viewport, isMobile: scenario.viewport.width < 600, hasTouch: scenario.viewport.width < 600 });
    const page = await context.newPage(), errors = [];
    await serveLocalBuild(page);
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => {
      localStorage.clear();
      localStorage.setItem('v33-rpg-save', value);
      localStorage.setItem('v34-tutorial-stage', 'done');
    }, save);
    await page.goto(`${base}#v47-${scenario.story.toLowerCase()}-${scenario.actionId}`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
    } catch (error) {
      console.error(JSON.stringify({ scenario: `${scenario.questId}/${scenario.actionId}`,
        pageErrors: errors, console: await page.locator('body').innerText().catch(() => ''),
        scriptUrls: await page.locator('script').evaluateAll(nodes => nodes.map(node => node.src)) }, null, 2));
      throw error;
    }
    await page.waitForFunction(expected => JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.date === expected,
      quest.date);
    const storyTab = page.locator(`[data-v47-story="${scenario.story}"]`);
    await storyTab.click();
    assert.equal(await storyTab.getAttribute('aria-pressed'), 'true', `${scenario.story} can be selected from the story tracker`);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state.world.v47.focusStoryId),
      scenario.story, `${scenario.story} focus persists in the campaign save`);
    assert.ok((await page.locator('#bodyname').innerText()).trim(), 'the possessed person is named on screen');
    if (scenario.startMapId && scenario.startMapId !== quest.entry.mapId) {
      const startMap = maps[scenario.startMapId];
      const exit = startMap.layers.flatMap(layer => layer.objects ?? []).find(item => item.type === 'map-exit'
        && item.properties.some(property => property.name === 'targetMapId' && property.value === quest.entry.mapId));
      assert.ok(exit, `${scenario.startMapId} has a physical exit to ${quest.entry.mapId}`);
      const exitTile = { x: Math.floor(exit.x / startMap.tilewidth), y: Math.floor(exit.y / startMap.tileheight) };
      const startCollision = startMap.layers.find(layer => layer.name === 'Collision').data;
      const startPosition = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state.player.position);
      const exitQueue = [{ ...startPosition, path: [] }], exitSeen = new Set([`${startPosition.x},${startPosition.y}`]);
      let exitRoute = null;
      while (exitQueue.length) {
        const node = exitQueue.shift();
        if (Math.abs(node.x - exitTile.x) + Math.abs(node.y - exitTile.y) === 1) { exitRoute = node.path; break; }
        for (const [direction, dx, dy] of [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]]) {
          const x = node.x + dx, y = node.y + dy, key = `${x},${y}`;
          if (x < 0 || y < 0 || x >= startMap.width || y >= startMap.height || startCollision[y * startMap.width + x] !== 0 || exitSeen.has(key)) continue;
          exitSeen.add(key); exitQueue.push({ x, y, path: [...node.path, direction] });
        }
      }
      assert.ok(exitRoute, `the player can walk from ${scenario.startMapId} to its ${quest.entry.mapId} exit`);
      await walkAndConfirm(page, exitRoute, `${scenario.startMapId} exit route`);
      await page.keyboard.press('e');
      const destinationName = maps[quest.entry.mapId].metadata.displayNameKo;
      const exitChoice = page.locator('#actions button').filter({ hasText: `문을 지나 ${destinationName}로` });
      await exitChoice.waitFor({ state: 'visible' });
      await exitChoice.click();
      try {
        await page.waitForFunction(expected => document.body.dataset.worldMap === expected, quest.entry.mapId);
      } catch (error) {
        const state = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state);
        await page.screenshot({ path: path.join(output, `${scenario.story}-${scenario.actionId}-exit-blocked-${scenario.viewport.width}.png`) });
        throw new Error(`could not enter ${quest.entry.mapId}: ${JSON.stringify({ currentMap: state?.world?.currentMapId,
          visibleMap: await page.locator('body').getAttribute('data-world-map'),
          position: state?.player?.position,
          visiblePosition: await page.locator('body').evaluate(body => ({ x: body.dataset.playerX, y: body.dataset.playerY })),
          hostMap: state?.hosts?.[hostId]?.mapId, actions: await page.locator('#actions').innerText().catch(() => ''),
          record: await page.locator('#record').textContent().catch(() => ''),
          availableMaps: state?.hosts?.[hostId]?.allowedMaps })}`);
      }
    }
    const runtimePosition = await page.evaluate(() => ({ x: Number(document.body.dataset.playerX), y: Number(document.body.dataset.playerY) }));
    const targetTile = { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) };
    const collision = maps[mapId].layers.find(layer => layer.name === 'Collision').data;
    const keyFor = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const queue = [{ ...runtimePosition, path: [] }], seen = new Set([`${runtimePosition.x},${runtimePosition.y}`]);
    let route = null;
    while (queue.length) {
      const node = queue.shift();
      if (Math.abs(node.x - targetTile.x) + Math.abs(node.y - targetTile.y) === 1) { route = node.path; break; }
      for (const [direction, dx, dy] of [['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0]]) {
        const x = node.x + dx, y = node.y + dy, key = `${x},${y}`;
        if (x < 0 || y < 0 || x >= maps[mapId].width || y >= maps[mapId].height
          || collision[y * maps[mapId].width + x] !== 0 || seen.has(key)) continue;
        seen.add(key); queue.push({ x, y, path: [...node.path, direction] });
      }
    }
    assert.ok(route, `${scenario.questId} has a walkable route to the physical object`);
    await walkAndConfirm(page, route, `${mapId} event route`);
    await page.keyboard.press('e');
    const choice = page.locator('#actions button').filter({ hasText: action.labelKo });
    try { await choice.waitFor({ state: 'visible', timeout: 4000 }); }
    catch {
      const debug = await page.evaluate(() => ({ body: document.querySelector('#bodyname')?.textContent,
        date: document.querySelector('#calendar-date')?.textContent, map: document.querySelector('#map-label')?.textContent,
        actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        record: document.querySelector('#record')?.textContent,
        savedWorld: JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.currentMapId,
        chapter: JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.chapterId,
        dateValue: JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.date,
        pos: JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.player?.position,
        hostPos: JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.hosts?.printer_ekaterina?.position,
        questStates: Object.entries(JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.quests ?? {})
          .filter(([id]) => id.startsWith('V47_MAIN01') || id === 'E00').map(([id, value]) => [id, value.status]),
      }));
      await page.screenshot({ path: path.join(output, `${scenario.story}-${scenario.actionId}-blocked-${scenario.viewport.width}.png`) });
      throw new Error(`${scenario.questId}/${scenario.actionId} physical action did not appear: ${JSON.stringify(debug)}`);
    }
    assert.equal(await choice.isEnabled(), true, `${scenario.actionId} is enabled at its physical object`);
    await choice.scrollIntoViewIfNeeded();
    const before = await page.evaluate(selectedLabel => ({
      title: document.querySelector('#headline')?.textContent ?? '',
      journal: document.querySelector('#journal-text')?.textContent ?? '',
      map: document.querySelector('#map-name')?.textContent ?? '',
      choice: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
      selectedChoiceInViewport: (() => {
        const button = [...document.querySelectorAll('#actions button')].find(item => item.innerText.includes(selectedLabel));
        if (!button) return false;
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0
          && rect.right <= innerWidth && rect.bottom <= innerHeight;
      })(),
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      world: document.querySelector('#world')?.width > 0,
    }), action.labelKo);
    assert.ok(before.scrollWidth <= before.width + 1, `${scenario.story} has no horizontal overflow at ${scenario.viewport.width}px`);
    assert.ok(before.world && before.choice.some(label => label.includes(action.labelKo)), `${scenario.story} map and selected option are visible`);
    assert.ok(before.selectedChoiceInViewport, `${scenario.story} selected choice is within the visible viewport before clicking`);
    assert.ok(before.choice.every(label => !label.includes('undefined')), `${scenario.story} choice copy contains no missing-value placeholder`);
    assert.ok(!before.journal.includes('undefined'), `${scenario.story} scene introduction contains no missing-value placeholder`);
    for (const turn of quest.dialogue ?? []) {
      assert.ok(before.journal.includes(turn.speakerKo) && before.journal.includes(turn.lineKo),
        `${quest.id} renders authored scene dialogue for ${turn.speakerKo} before the choice`);
    }
    await page.screenshot({ path: path.join(output, `${scenario.story}-${scenario.actionId}-before-${scenario.viewport.width}.png`) });
    await choice.click();
    try {
      await page.waitForFunction(({ questId, actionId }) => {
        const saveData = JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null');
        return saveData?.state?.ledger?.some(row => row.questId === questId && row.actionId === actionId);
      }, { questId: quest.id, actionId: action.id });
    } catch (error) {
      console.error(JSON.stringify({ scenario: `${quest.id}/${action.id}`, pageErrors: errors,
        journal: await page.locator('#journal-text').textContent().catch(() => ''),
        records: await page.locator('#record').textContent().catch(() => ''),
        ledger: await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.ledger?.slice(-3)) }, null, 2));
      throw error;
    }
    const saved = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    const restored = game.loadGame(saved, { maps, hostCards: runtimeCards, quests: allQuests });
    const ledgerRow = restored.ledger.find(row => row.questId === quest.id && row.actionId === action.id);
    assert.ok(ledgerRow, `${scenario.actionId} persists in the saved world ledger`);
    assert.ok(ledgerRow.effectsApplied?.v47WorldChange, `${scenario.actionId} stores its material world changes`);
    assert.deepEqual(errors, [], `${scenario.story} browser runtime has no page errors`);
    await page.screenshot({ path: path.join(output, `${scenario.story}-${scenario.actionId}-after-${scenario.viewport.width}.png`) });
    rows.push({ story: scenario.story, questId: quest.id, actionId: action.id, hostId, mapId, objectId: object.id,
      viewport: scenario.viewport, visibleChoices: before.choice, selectedOutcome: ledgerRow.outcomeKo,
      selectedChoiceInViewport: before.selectedChoiceInViewport,
      materialChangesPersisted: true, overflow: before.scrollWidth > before.width, pageErrors: errors });
    await context.close();
  }
  const codaContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const codaPage = await codaContext.newPage(), codaErrors = [];
  await serveLocalBuild(codaPage);
  codaPage.on('pageerror', error => codaErrors.push(error.message));
  await codaPage.addInitScript(value => {
    localStorage.clear();
    localStorage.setItem('v33-rpg-save', value);
    localStorage.setItem('v34-tutorial-stage', 'done');
  }, makeOptionalCodaSave());
  await codaPage.goto(`${base}#v47-main03-coda-date-advance`, { waitUntil: 'domcontentloaded' });
  await codaPage.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
  const routeContinue = codaPage.locator('#route-continue');
  await routeContinue.waitFor({ state: 'visible' });
  assert.match(await routeContinue.innerText(), /1850년 1월 3일 자료로 이어가기/,
    'the optional post-arrest family coda is offered as the next authored date');
  assert.ok(await codaPage.locator('#actions button').count() === 0,
    'the coda date step does not require an unrelated active dialogue or choice');
  await codaPage.screenshot({ path: path.join(output, 'MAIN03-P11-date-advance-before-1440.png') });
  await routeContinue.click();
  try { await codaPage.waitForFunction(() => JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.date === '1850-01-03', null, { timeout: 5000 }); }
  catch {
    const debug = await codaPage.evaluate(() => ({ date: JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.date,
      headline: document.querySelector('#headline')?.textContent, record: document.querySelector('#record')?.textContent,
      route: document.querySelector('#route-continue')?.textContent, questStates: Object.entries(JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.quests ?? {})
        .filter(([id]) => id.includes('P11') || id.includes('E41')).map(([id, row]) => [id, row.status]) }));
    throw new Error(`Optional coda date did not advance after click: ${JSON.stringify(debug)}`);
  }
  const codaSaved = JSON.parse(await codaPage.evaluate(() => localStorage.getItem('v33-rpg-save'))).state;
  assert.equal(codaSaved.quests.V47_MAIN03_P11.status, 'open', 'the coda remains available after chronological advancement');
  assert.equal(codaSaved.world.chapterId, 'V33_1849_CIRCLE', 'the optional coda remains in its authored event arc');
  assert.deepEqual(codaErrors, [], 'the optional coda date advancement produces no browser errors');
  await codaPage.screenshot({ path: path.join(output, 'MAIN03-P11-date-advance-after-1440.png') });
  optionalCoda = { action: 'advance to optional post-arrest coda', dateBefore: '1849-12-22', dateAfter: codaSaved.world.date,
    questStatus: codaSaved.quests.V47_MAIN03_P11.status, pageErrors: codaErrors };
  await codaContext.close();

  const preludeContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const preludePage = await preludeContext.newPage(), preludeErrors = [];
  await serveLocalBuild(preludePage);
  preludePage.on('pageerror', error => preludeErrors.push(error.message));
  await preludePage.addInitScript(value => {
    localStorage.clear();
    localStorage.setItem('v33-rpg-save', value);
    localStorage.setItem('v34-tutorial-stage', 'done');
  }, makePreludeSave());
  await preludePage.goto(`${base}#v47-main03-first-date-advance`, { waitUntil: 'domcontentloaded' });
  await preludePage.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
  const firstDatedQuestButton = preludePage.locator('#route-continue');
  await firstDatedQuestButton.waitFor({ state: 'visible' });
  assert.match(await firstDatedQuestButton.innerText(), /4월 1일 자료로 이어가기/,
    'the first future-dated quest is offered even though it has no previous quest in its arc');
  await firstDatedQuestButton.click();
  await preludePage.waitForFunction(() => JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.date === '1849-04-01');
  const preludeSaved = JSON.parse(await preludePage.evaluate(() => localStorage.getItem('v33-rpg-save'))).state;
  assert.equal(preludeSaved.quests.V47_MAIN03_P04.status, 'open', 'the first dated MAIN03 quest remains available after advancing');
  assert.deepEqual(preludeErrors, [], 'the first date advance produces no browser errors');
  await preludePage.screenshot({ path: path.join(output, 'MAIN03-P04-first-date-advance-390.png') });
  firstDateAdvance = { action: 'advance to first dated MAIN03 beat', dateBefore: '1849-03-20',
    dateAfter: preludeSaved.world.date, questStatus: preludeSaved.quests.V47_MAIN03_P04.status, pageErrors: preludeErrors };
  await preludeContext.close();
} finally {
  await browser.close();
}
const report = { status: 'PASS', scope: 'seeded physical-scene UI branch acceptance and two chronological date continuations; this is not a full human-length campaign completion', base, branches: rows, optionalCoda, firstDateAdvance };
await writeFile(path.join(output, 'V47_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
