import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { mimeTypeFor } from '../server-mime.mjs';
import { attachV47StoryObjects, v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { main01TimelineSources } from '../rpg/engine/v47-main01-timeline.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { v47RoleProfiles } from '../rpg/data/v47-character-roles.mjs';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';
import { attachMain01StorageShelves, MAIN01_STORAGE_PACKETS, MAIN01_STORAGE_SHELVES } from '../rpg/engine/v47-main01-storage.mjs';
import { storyIdForQuest } from '../rpg/engine/v47-story-entry.mjs';

const root = process.cwd();
const previewPort = Number(process.env.V47_PREVIEW_PORT ?? 4175);
const previewRoot = path.resolve(root, 'dist-v33');
const replayViewport = (process.env.V47_REPLAY_VIEWPORT ?? '1440x900').split('x').map(Number);
const viewport = { width: replayViewport[0], height: replayViewport[1] };
const e41Only = process.argv.includes('--e41-only');
const alternateOnly = process.argv.includes('--alternate-only');
const normalOnly = process.argv.includes('--normal-only');
const main01Only = process.argv.includes('--main01-only');
const outputDir = process.env.V47_REPLAY_OUTPUT
  ? path.resolve(root, process.env.V47_REPLAY_OUTPUT)
  : path.join(root, main01Only ? 'artifacts/v47/MAIN01_ONLY_REPLAY' : 'artifacts/v47/BROWSER_CAMPAIGN_REPLAY');
const readJson = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const [mapNames, characterNames, registry, campaign, sourceIndex, historicalPackets] = await Promise.all([
  readdir(path.join(root, 'rpg/maps')), readdir(path.join(root, 'rpg/characters')),
  readJson('data/era_character_registry.json'), readJson('rpg/quests/campaign.json'),
  readJson('rpg/data/source-reader-index.json'), readJson('rpg/data/historical-source-packets.json'),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapNames.filter(name => name.endsWith('.json')).map(name => readJson(`rpg/maps/${name}`)))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(characterNames.filter(name => name.endsWith('.json')).map(name => readJson(`rpg/characters/${name}`))),
]);
const runtimeCards = decorateCardsWithEraProfiles(cards, {
  ...registry, runtime_profiles: { ...registry.runtime_profiles, ...v47RoleProfiles },
});
const storyQuests = [...v47StoryQuests, ...toV47StoryQuests()];
globalThis.V47MainStories.registerStoryBeats(storyQuests.filter(quest => quest.storyId));
const questList = [...storyQuests, ...await Promise.all((await readdir(path.join(root, 'rpg/quests')))
  .filter(name => name.endsWith('.json') && name !== 'campaign.json')
  .map(name => readJson(`rpg/quests/${name}`))),
  ...await Promise.all(['printshop-article', 'public-discourse-1848', 'europe-news-1848',
    'circle-investigation-1849', 'circle-letter-1849-may'].map(name => readJson(`rpg/quests/${name}.json`)))];
const campaignStoryQuests = questList.filter(quest => storyIdForQuest(quest));
const questsById = new Map(questList.map(quest => [quest.id, quest]));
attachV47StoryObjects(maps);
attachV47StoryBeatObjects(maps, storyQuests);
attachMain01StorageShelves(maps);
const storyQuestIds = new Set(campaignStoryQuests.map(quest => quest.id));
const sourceMap = new Map(sourceIndex.records.map(record => [record.sourceId, record]));
const historicalPacketMap = new Map(historicalPackets.records.map(record => [record.sourceId, record]));
const alternativeActions = {
  V47_MAIN01_A01: 'V47_A01_SEND_PAVEL_TO_PRINTSHOP',
  V47_MAIN01_A10: 'V47_A10_STORE_COPY',
  V47_MAIN03_P03: 'V47_P03_PRESS_AND_ORDER',
  V47_MAIN05_C06: 'V47_C06_DISPERSE_CROWD',
};
const propertyMap = object => Object.fromEntries((object?.properties ?? []).map(property => [property.name, property.value]));
const interactions = map => map.layers.find(layer => layer.name === 'Interactions')?.objects ?? [];
const tileOf = object => ({ x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) });
const movementKeys = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
const deltas = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };

function initialMainStorySave(routeName = 'NORMAL') {
  const arc = campaign.arcs.find(item => item.id === 'V33_1848_PUBLIC');
  const state = game.createInitialState({ maps, hostCards: runtimeCards, quests: questList, startMapId: arc.startMapId });
  state.world.chapterId = arc.id;
  state.world.date = arc.date;
  if (main01Only && routeName === 'ALTERNATE') {
    state.world.date = '1848-05-18';
    for (const host of Object.values(state.hosts)) {
      if (!host.presenceWindow) continue;
      const present = host.presenceWindow.startDate <= state.world.date && state.world.date <= host.presenceWindow.endDate;
      host.historicalAliveAndPresent = present;
      if (present && host.presenceWindow.start) {
        host.mapId = host.presenceWindow.start.mapId;
        host.position = { ...host.presenceWindow.start.position };
      }
    }
  }
  state.world.clockMinutes = 540;
  state.world.currentMapId = arc.startMapId;
  state.player.embodiment = null;
  state.world.v47.focusStoryId = 'MAIN01';
  for (const storyArc of campaign.arcs) for (const questId of [...storyArc.questIds, ...(storyArc.optionalQuestIds ?? [])]) {
    if (!storyQuestIds.has(questId) && questId !== 'E41_SEMENOVSKY_1849') {
      state.quests[questId] = { status: 'resolved', result: 'PRIOR_CAMPAIGN_CONTEXT' };
    }
  }
  if (main01Only) for (const quest of campaignStoryQuests.filter(item => storyIdForQuest(item) !== 'MAIN01')) {
    state.quests[quest.id] = { status: 'resolved', result: 'SEQUENTIAL_MAIN01_BROWSER_SCOPE' };
  }
  if (e41Only) {
    for (const storyArc of campaign.arcs) for (const questId of [...storyArc.questIds, ...(storyArc.optionalQuestIds ?? [])]) {
      state.quests[questId] = { status: 'resolved', result: 'PRIOR_CAMPAIGN_CONTEXT' };
    }
    state.quests.E41_SEMENOVSKY_1849 = { status: 'open', result: null };
    state.quests.V47_MAIN03_P11 = { status: 'open', result: null };
    state.world.chapterId = 'V33_1849_CIRCLE'; state.world.date = '1849-05-29'; state.world.clockMinutes = 540;
    state.world.currentMapId = campaign.arcs.find(item => item.id === 'V33_1849_CIRCLE').startMapId;
    state.player.embodiment = null;
    const advanced = game.advanceCampaignDate(state, '1849-12-22', campaign, questList);
    if (!advanced.ok) throw new Error(`E41 diagnostic fixture could not reach its authored date: ${advanced.reason}`);
    return game.saveGame(advanced.state);
  }
  if (main01Only) for (const quest of campaignStoryQuests.filter(item => storyIdForQuest(item) !== 'MAIN01')) {
    assert.equal(state.quests[quest.id]?.status, 'resolved', `MAIN01-only replay excludes ${quest.id}`);
  }
  return game.saveGame(state);
}

function findPath(map, start, goal, occupied = new Set()) {
  const collision = map.layers.find(layer => layer.name === 'Collision')?.data ?? [];
  const queue = [{ ...start, path: [] }], seen = new Set([`${start.x},${start.y}`]);
  while (queue.length) {
    const node = queue.shift();
    if (Math.abs(node.x - goal.x) + Math.abs(node.y - goal.y) <= 1) return node.path;
    for (const [direction, [dx, dy]] of Object.entries(deltas)) {
      const x = node.x + dx, y = node.y + dy, key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(key)
        || collision[y * map.width + x] !== 0 || occupied.has(key)) continue;
      seen.add(key); queue.push({ x, y, path: [...node.path, direction] });
    }
  }
  return null;
}

function mapRoute(fromMapId, toMapId, hostCard) {
  const queue = [{ mapId: fromMapId, edges: [] }], seen = new Set([fromMapId]);
  while (queue.length) {
    const current = queue.shift();
    if (current.mapId === toMapId) return current.edges;
    for (const object of interactions(maps[current.mapId]).filter(item => item.type === 'map-exit')) {
      const props = propertyMap(object), target = props.targetMapId;
      if (!target || seen.has(target) || !hostCard.allowedMaps.includes(target)) continue;
      seen.add(target); queue.push({ mapId: target, edges: [...current.edges, { from: current.mapId, to: target, object }] });
    }
  }
  return null;
}

async function runRoute(browser, base, routeName) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage(), pageErrors = [], pageCrashes = [];
  let activeQuestId = 'ROUTE_BOOT';
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' || Number(url.port) !== previewPort) return route.abort('blockedbyclient');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(previewRoot, relative);
    if (!target.startsWith(`${previewRoot}${path.sep}`) && target !== previewRoot) return route.fulfill({ status: 403, body: 'Forbidden' });
    try {
      const body = await readFile(target);
      return route.fulfill({ status: 200, body, headers: { 'content-type': mimeTypeFor(target), 'cache-control': 'no-store' } });
    } catch { return route.fulfill({ status: 404, body: 'Not found' }); }
  });
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('crash', () => {
    pageCrashes.push({ questId: activeQuestId });
    console.error(`${routeName} browser page crashed during ${activeQuestId}`);
  });
  if (process.env.V47_REPLAY_REDUCED_MOTION === '1') await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(value => {
    localStorage.clear();
    localStorage.setItem('v33-rpg-save', value);
    localStorage.setItem('v34-tutorial-stage', 'done');
  }, initialMainStorySave(routeName));
  await page.goto(`${base}#v47-campaign-${routeName.toLowerCase()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
  if (!e41Only) await page.locator('[data-v47-story="MAIN01"]').click();
  await page.locator('#roster-open').click();
  const openingHost = runtimeCards.find(card => card.id === (e41Only ? 'dostoevsky_1849' : 'bookseller_lev'));
  await page.locator('.roster-card').filter({ hasText: openingHost.displayNameKo }).first().click();
  await page.waitForFunction(expected => document.querySelector('#bodyname')?.textContent.includes(expected), openingHost.displayNameKo);
  await page.locator('#save').click();
  const openingState = await page.evaluate(() => ({ bodyname: document.querySelector('#bodyname')?.textContent,
    bodyId: document.body.dataset.playerId, savedHost: JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.player?.embodiment,
    currentDate: JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.date,
    initialQuestStates: Object.fromEntries(['PUBLIC_DISCOURSE_1848','V37_BELINSKY_LETTER_1848','V47_MAIN01_PERMISSION']
      .map(id => [id, JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.quests?.[id]?.status])) }));
  assert.equal(openingState.savedHost, openingHost.id, 'the story route begins with a real roster possession saved');
  const rows = [], transitions = [], screenshots = [], sourceReads = [];
  const exercisedHostsByStory = new Map();
  const currentState = async () => JSON.parse(await page.evaluate(() => localStorage.getItem('v33-rpg-save'))).state;
  const currentMapId = () => page.evaluate(() => document.body.dataset.worldMap);
  const currentPosition = async () => page.evaluate(() => ({
    x: Number(document.body.dataset.playerX), y: Number(document.body.dataset.playerY),
  }));

  async function walkTo(object, label) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const mapId = await currentMapId(), map = maps[mapId], pos = await currentPosition();
      assert.ok(map, `${label}: player is on a known map (${mapId})`);
      const target = tileOf(object), occupied = new Set();
      // Residents are not static blockers: moveActor lets them yield when the player steps into their tile.
      const path = findPath(map, pos, target, occupied);
      assert.ok(path, `${label}: path exists from ${mapId} (${pos.x},${pos.y}) to (${target.x},${target.y})`);
      if (!path.length) return;
      let blocked = false;
      for (const direction of path) {
        const before = await currentPosition();
        await page.keyboard.press(movementKeys[direction]);
        await page.waitForFunction(previous => Number(document.body.dataset.playerX) !== previous.x
          || Number(document.body.dataset.playerY) !== previous.y, before, { timeout: 1800 }).catch(() => {});
        const after = await currentPosition();
        if (after.x === before.x && after.y === before.y) {
          const [dx, dy] = deltas[direction];
          occupied.add(`${before.x + dx},${before.y + dy}`);
          blocked = true;
          break;
        }
      }
      if (!blocked) return;
    }
    const mapId = await currentMapId(), position = await currentPosition();
    const occupants = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state;
      const mapId = document.body.dataset.worldMap;
      return Object.values(save?.hosts ?? {}).filter(host => host.mapId === mapId
        && host.historicalAliveAndPresent !== false).map(host => ({ id: host.id, position: host.position }));
    });
    throw new Error(`${label}: could not walk to map object after replanning; map=${mapId} position=${JSON.stringify(position)} target=${JSON.stringify(tileOf(object))} occupants=${JSON.stringify(occupants)}`);
  }

  async function use() { await page.keyboard.press('e'); await page.waitForTimeout(80); }

  async function waitForEuropeNewsReadingReady() {
    const readingStand = maps.printshop.layers.find(layer => layer.name === 'Interactions')?.objects
      .find(object => object.id === 1184);
    assert.ok(readingStand, 'E42 has a physical proclamation reading stand in the printshop');
    await walkTo(readingStand, 'E42 proclamation reading stand');
    let movementCount = 0;
    for (let tick = 0; tick < 240; tick += 1) {
      const state = await currentState(), event = state.world.livingEventStates?.E42;
      if (event?.stage === 'READING_READY' && event.status === 'ACTIVE') return movementCount;
      if (event?.status === 'RESOLVED') throw new Error(`E42 resolved before the players gathered: ${JSON.stringify({
        event, clockMinutes: state.world.clockMinutes,
        actors: ['clerk_alexei', 'printer_ekaterina', 'reader_darya', 'student_vasily'].map(id => ({
          id, mapId: state.hosts[id]?.mapId, position: state.hosts[id]?.position,
          alive: state.hosts[id]?.historicalAliveAndPresent, allowedPrintshop: state.hosts[id]?.allowedMaps?.includes('printshop'),
          goal: state.hosts[id]?.activeGoal,
        })),
      })}`);
      if ((tick + 1) % 30 === 0) console.log(`${routeName} E42 +${tick + 1} min`, JSON.stringify({
        clockMinutes: state.world.clockMinutes, stage: event?.stage,
        actors: ['clerk_alexei', 'printer_ekaterina', 'reader_darya', 'student_vasily'].map(id => ({
          id, mapId: state.hosts[id]?.mapId, position: state.hosts[id]?.position,
          goal: state.hosts[id]?.activeGoal?.taskId,
        })),
      }));
      assert.equal(await currentMapId(), 'printshop', 'the E42 readers gather at the printshop while the player waits');
      const map = maps.printshop, position = await currentPosition();
      const collision = map.layers.find(layer => layer.name === 'Collision')?.data ?? [];
      const scenePosition = event?.scenePosition ?? tileOf(readingStand);
      let moved = false;
      for (const direction of ['right', 'left', 'down', 'up']) {
        const [dx, dy] = deltas[direction], x = position.x + dx, y = position.y + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height || collision[y * map.width + x] !== 0) continue;
        if (Math.abs(x - scenePosition.x) + Math.abs(y - scenePosition.y) > 5) continue;
        await page.keyboard.press(movementKeys[direction]);
        moved = await page.waitForFunction(previous => Number(document.body.dataset.playerX) !== previous.x
          || Number(document.body.dataset.playerY) !== previous.y, position, { timeout: 700 }).then(() => true).catch(() => false);
        if (moved) break;
      }
      assert.ok(moved, `E42 waiting step ${tick + 1} has an adjacent walkable tile`);
      movementCount += 1;
      if (movementCount % 8 === 0) await page.locator('#save').click();
    }
    const state = await currentState();
    throw new Error(`E42 readers did not gather within 240 movement minutes: ${JSON.stringify({
      event: state.world.livingEventStates?.E42,
      actors: ['clerk_alexei', 'printer_ekaterina', 'reader_darya', 'student_vasily'].map(id => ({
        id, mapId: state.hosts[id]?.mapId, position: state.hosts[id]?.position, goal: state.hosts[id]?.activeGoal,
      })),
      clockMinutes: state.world.clockMinutes,
    })}`);
  }

  async function travelTo(targetMapId, hostCard) {
    for (let hop = 0; hop < 12; hop += 1) {
      const from = await currentMapId();
      if (from === targetMapId) return;
      const route = mapRoute(from, targetMapId, hostCard);
      assert.ok(route?.length, `${routeName}: ${hostCard.id} has a map-exit route ${from} → ${targetMapId}`);
      const edge = route[0];
      await walkTo(edge.object, `exit ${edge.from} → ${edge.to}`);
      const destination = maps[edge.to]?.metadata?.displayNameKo ?? '다음 장소';
      let crossed = false;
      for (let attempt = 0; attempt < 3 && !crossed; attempt += 1) {
        await use();
        const exitChoice = page.locator('#actions button').filter({ hasText: `문을 지나 ${destination}로` }).first();
        if (await exitChoice.isVisible().catch(() => false)) await exitChoice.click();
        crossed = await page.waitForFunction(expected => document.body.dataset.worldMap === expected, edge.to, { timeout: 1200 })
          .then(() => true).catch(() => false);
        if (crossed) break;
        const waitChoice = page.locator('#actions button').filter({ hasText: '문 열릴 때까지 기다린다' }).first();
        if (await waitChoice.isVisible().catch(() => false)) { await waitChoice.click(); continue; }
        break;
      }
      if (!crossed) {
        const diagnostic = await page.evaluate(() => ({ map: document.body.dataset.worldMap,
          position: { x: document.body.dataset.playerX, y: document.body.dataset.playerY },
          headline: document.querySelector('#headline')?.textContent, record: document.querySelector('#record')?.textContent,
          actions: [...document.querySelectorAll('#actions button')].map(button => button.textContent) }));
        throw new Error(`Exit did not reach ${edge.to}; exit diagnostic=${JSON.stringify(diagnostic)}`);
      }
      await page.locator('#save').click();
      transitions.push({ hostId: hostCard.id, from: edge.from, to: edge.to,
        exitId: propertyMap(edge.object).exitId, date: (await currentState()).world.date });
    }
    assert.equal(await currentMapId(), targetMapId, `${routeName}: bounded map traversal reached ${targetMapId}`);
  }

  async function possess(hostId) {
    const card = runtimeCards.find(item => item.id === hostId);
    assert.ok(card, `${hostId} role card exists`);
    if ((await currentState()).player.embodiment === hostId) return card;
    // The in-game roster transfers the observer to the selected host's map.
    // Do not require the previously embodied character to have a route there.
    await page.locator('#roster-open').click();
    const rosterEntry = page.locator('.roster-card').filter({ hasText: card.displayNameKo }).first();
    try { await rosterEntry.waitFor({ state: 'visible', timeout: 3000 }); }
    catch { throw new Error(`${routeName}: ${hostId}/${card.displayNameKo} not present in the dated possession roster`); }
    await rosterEntry.click();
    await page.waitForFunction(expected => document.querySelector('#bodyname')?.textContent.includes(expected), card.displayNameKo);
    await page.locator('#save').click();
    await page.waitForTimeout(60);
    return card;
  }

  async function revealContinuationFor(quest) {
    const button = page.locator('#route-continue');
    if (await button.isVisible().catch(() => false)) return;
    const storyId = storyIdForQuest(quest);
    assert.ok(storyId, `hidden continuation for ${quest.id} needs a selectable story tab`);
    const storyTab = page.locator(`[data-v47-story="${storyId}"]`);
    try { await storyTab.waitFor({ state: 'visible' }); }
    catch (error) {
      const diagnostic = await page.evaluate(() => {
        const tracker = document.querySelector('#mission-tracker'), lower = document.querySelector('.lower');
        return { trackerHidden: tracker?.hidden, trackerDisplay: tracker && getComputedStyle(tracker).display,
          lowerClass: lower?.className, storyOverview: lower?.classList.contains('story-overview'),
          tabs: [...document.querySelectorAll('[data-v47-story]')].map(item => ({ story: item.dataset.v47Story,
            hidden: item.hidden, display: getComputedStyle(item).display, rect: (() => { const r = item.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })() })),
          routeButton: { hidden: document.querySelector('#route-continue')?.hidden,
            text: document.querySelector('#route-continue')?.textContent },
          mission: document.querySelector('#mission-title')?.textContent,
          focusStoryId: JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.v47?.focusStoryId };
      });
      const shot = path.join(outputDir, `${routeName}-HIDDEN-CONTINUATION-${quest.id}.png`);
      await page.screenshot({ path: shot, fullPage: true }); screenshots.push(shot);
      throw new Error(`Story tab ${storyId} stayed hidden for ${quest.id}: ${JSON.stringify(diagnostic)}; screenshot=${shot}; ${error.message}`);
    }
    await storyTab.click();
    await button.waitFor({ state: 'visible' });
  }

  async function advanceToDate(quest, before) {
    const button = page.locator('#route-continue');
    await revealContinuationFor(quest);
    const label = await button.innerText();
    await button.click();
    await page.waitForFunction(expected => JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.date === expected,
      quest.date);
    transitions.push({ kind: 'DATE', from: before.world.date, to: quest.date, questId: quest.id, button: label });
  }

  async function advanceChapter(nextArc, before) {
    const button = page.locator('#route-continue');
    const nextStoryQuest = nextArc.questIds.map(id => questsById.get(id)).find(item => storyIdForQuest(item));
    if (nextStoryQuest) await revealContinuationFor(nextStoryQuest);
    await button.waitFor({ state: 'visible' });
    const label = await button.innerText();
    await button.click();
    try { await page.waitForFunction(expected => JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.chapterId === expected,
      nextArc.id); }
    catch (error) {
      const diagnostic = await page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state;
        return { chapter: state?.world?.chapterId, date: state?.world?.date,
          pending: Object.entries(state?.quests ?? {}).filter(([, quest]) => quest.status !== 'resolved').map(([id, quest]) => [id, quest.status]).slice(0, 25),
          headline: document.querySelector('#headline')?.textContent, record: document.querySelector('#record')?.textContent,
          routeButton: document.querySelector('#route-continue')?.textContent };
      });
      throw new Error(`Chapter did not advance with ${label}: ${error.message}; ${JSON.stringify(diagnostic)}`);
    }
    transitions.push({ kind: 'CHAPTER', from: before.world.chapterId, to: nextArc.id, questId: nextArc.questIds[0], button: label });
  }

  try {
    for (let index = 0; index < 180; index += 1) {
      const state = await currentState();
      const arc = campaign.arcs.find(item => item.id === state.world.chapterId);
      assert.ok(arc, `${routeName}: current chapter ${state.world.chapterId} is authored`);
      const optionalIds = (arc.optionalQuestIds ?? []).filter(id => (questsById.get(id)?.prerequisiteQuestIds ?? [])
        .every(id => state.quests[id]?.status === 'resolved'));
      let pendingId = [...arc.questIds, ...optionalIds].find(id => state.quests[id]?.status !== 'resolved');
      if (main01Only && routeName === 'ALTERNATE' && pendingId === 'V47_MAIN01_A02') {
        const earlierPhysicalLead = ['V47_MAIN01_A03'].find(id => state.quests[id]?.status !== 'resolved');
        if (earlierPhysicalLead) pendingId = earlierPhysicalLead;
      }
      if (!pendingId) {
        const nextArc = campaign.arcs[campaign.arcs.indexOf(arc) + 1];
        if (!nextArc) break;
        await advanceChapter(nextArc, state);
        continue;
      }
      const quest = questsById.get(pendingId);
      assert.ok(quest, `${routeName}: campaign record ${pendingId} has a runtime definition`);
      activeQuestId = quest.id;
      assert.equal(quest.chapterId, arc.id, `${pendingId} belongs to the active chapter`);
      if (quest.date > state.world.date) { await advanceToDate(quest, state); continue; }
      if (quest.id === 'E41_SEMENOVSKY_1849') {
        // Let the documented fixed event resolve on its authored date. The game clock advances only through player actions.
        const actor = (await currentState()).player.embodiment === 'dostoevsky_1849'
          ? runtimeCards.find(card => card.id === 'dostoevsky_1849') : await possess('dostoevsky_1849');
        await travelTo('semenovsky-square', actor);
        const letter = interactions(maps['semenovsky-square']).find(object => propertyMap(object).sourceId === 'OBJ-WS-DOSTOEVSKY-LETTER-1849-DEC22');
        await walkTo(letter, 'E41 source letter'); await use();
        const letterChoice = page.locator('#actions button').filter({ hasText: '자료 읽기 ·' }).first();
        if (await letterChoice.isVisible().catch(() => false)) await letterChoice.click();
        try { await page.locator('#source-reader-complete').waitFor({ state: 'visible', timeout: 4000 }); }
        catch (error) {
          const diagnostic = await page.evaluate(() => ({ map: document.body.dataset.worldMap,
            position: { x: document.body.dataset.playerX, y: document.body.dataset.playerY },
            headline: document.querySelector('#headline')?.textContent, record: document.querySelector('#record')?.textContent,
            actions: [...document.querySelectorAll('#actions button')].map(button => button.textContent),
            sourceDialogOpen: document.querySelector('#source-reader')?.open,
            sourceDialogTitle: document.querySelector('#source-reader-title')?.textContent }));
          throw new Error(`E41 source did not open: ${error.message}; ${JSON.stringify(diagnostic)}`);
        }
        await page.locator('#source-reader-complete').click();
        const eventObject = interactions(maps['semenovsky-square']).find(object => object.id === quest.entry.objectId);
        const square = maps['semenovsky-square'];
        for (let tick = 0; tick < 400 && (await currentState()).world.livingEventStates?.E41?.status === 'SCHEDULED'; tick += 1) {
          const here = await currentPosition(), collision = square.layers.find(layer => layer.name === 'Collision').data;
          const direction = ['right', 'left', 'down', 'up'].find(name => {
            const [dx, dy] = deltas[name], x = here.x + dx, y = here.y + dy;
            return x >= 0 && y >= 0 && x < square.width && y < square.height && collision[y * square.width + x] === 0;
          });
          assert.ok(direction, 'fixed event can be awaited on a walkable public-square tile');
          await page.keyboard.press(movementKeys[direction]);
          await page.locator('#save').click();
        }
        assert.equal((await currentState()).world.livingEventStates.E41.status, 'ACTIVE',
          'the fixed event opens after its authored start time while the witness is present');
        await walkTo(eventObject, 'E41 historical event'); await use();
        const eventAction = page.locator('#actions button').filter({ hasText: '본 일을 개인 수첩에 적는다' }).first();
        try { await eventAction.waitFor({ state: 'visible', timeout: 4000 }); }
        catch (error) {
          const diagnostic = await page.evaluate(() => {
            const state = JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state;
            return { map: document.body.dataset.worldMap, position: { x: document.body.dataset.playerX, y: document.body.dataset.playerY },
              headline: document.querySelector('#headline')?.textContent, record: document.querySelector('#record')?.textContent,
              event: state?.world?.livingEventStates?.E41,
              actions: [...document.querySelectorAll('#actions button')].map(button => button.textContent) };
          });
          throw new Error(`E41 choice not available: ${error.message}; ${JSON.stringify(diagnostic)}`);
        }
        const eventActionLabel = '본 일을 개인 수첩에 적는다';
        await eventAction.click();
        const eventState = await currentState();
        assert.ok(eventState.world.livingEventStates?.E41, '1849 fixed event has a runtime state');
        assert.ok(eventState.ledger.some(row => row.eventType === 'HISTORICAL_EVENT_STAGE' && row.catalogEventId === 'E41'),
          'E41 has reached the source-backed historical stage in the live world');
        // Advance in place by walking a short safe loop until the fixed commutation is announced.
        for (let tick = 0; tick < 240 && (await currentState()).world.livingEventStates.E41.status !== 'RESOLVED'; tick += 1) {
          const here = await currentPosition();
          const candidate = Object.entries(deltas).find(([, [dx, dy]]) => {
            const x = here.x + dx, y = here.y + dy;
            return x >= 0 && y >= 0 && x < square.width && y < square.height
              && square.layers.find(layer => layer.name === 'Collision').data[y * square.width + x] === 0;
          });
          assert.ok(candidate, 'fixed-event timer has a nearby walkable tile');
          await page.keyboard.press(movementKeys[candidate[0]]);
          await page.locator('#save').click();
        }
        const afterE41 = await currentState();
        assert.equal(afterE41.quests.E41_SEMENOVSKY_1849.status, 'resolved', 'the fixed historical outcome resolves on its own timeline');
        assert.equal(afterE41.world.livingEventStates.E41.stage, 'COMMUTATION_ANNOUNCED', 'the commutation is announced as the immutable outcome');
        rows.push({ storyId: 'HISTORICAL_GATE', questId: quest.id, date: afterE41.world.date,
          hostId: 'dostoevsky_1849', mapId: 'semenovsky-square', actionId: eventActionLabel,
          status: afterE41.quests.E41_SEMENOVSKY_1849.status, fixedOutcome: afterE41.world.livingEventStates.E41.stage });
        continue;
      }
      assert.ok(storyQuestIds.has(quest.id), `${routeName}: unexpected campaign gate ${quest.id} is not silently skipped`);
      const targetMap = maps[quest.entry.mapId];
      const targetObject = interactions(targetMap).find(object => object.id === quest.entry.objectId);
      assert.ok(targetObject, `${quest.id} has its physical story object`);
      if (quest.id === 'V47_MAIN01_A11') {
        const letterId = 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848';
        const letter = interactions(targetMap).find(object => propertyMap(object).sourceId === letterId);
        assert.ok(letter, 'MAIN01 A11 exposes the subscriber letter as a physical printshop object');
        assert.equal(propertyMap(letter).availableDate, '1848-11-29', 'the letter stays hidden until its documented arrival date');
        const letterReader = runtimeCards.find(card => card.id === 'printer_ekaterina');
        await possess(letterReader.id);
        await travelTo(quest.entry.mapId, letterReader);
        await walkTo(letter, 'MAIN01 A11 subscriber letter'); await use();
        const letterDialog = page.locator('#source-reader');
        if (!await letterDialog.evaluate(element => element.open)) {
          const readLetter = page.locator('#actions button').filter({ hasText: '자료 읽기 ·' }).first();
          try { await readLetter.waitFor({ state: 'visible', timeout: 5000 }); }
          catch (error) {
            const diagnostic = await page.evaluate(() => ({
              map: document.body.dataset.worldMap,
              position: { x: document.body.dataset.playerX, y: document.body.dataset.playerY },
              headline: document.querySelector('#headline')?.textContent,
              record: document.querySelector('#record')?.textContent,
              actions: [...document.querySelectorAll('#actions button')].map(button => button.textContent),
              sourceDialogOpen: document.querySelector('#source-reader')?.open,
            }));
            throw new Error(`MAIN01 A11 letter read action not shown: ${error.message}; ${JSON.stringify(diagnostic)}`);
          }
          await readLetter.click();
        }
        await letterDialog.waitFor({ state: 'visible', timeout: 5000 });
        const letterView = await page.evaluate(() => ({
          title: document.querySelector('#source-reader-title')?.textContent ?? '',
          provenance: document.querySelector('#source-reader-provenance-text')?.textContent ?? '',
          paragraphCount: document.querySelectorAll('#source-reader-passages .source-passage').length,
          firstRussian: document.querySelector('#source-reader-passages .source-passage-ru')?.textContent ?? '',
          lastKorean: [...document.querySelectorAll('#source-reader-passages .source-passage-ko')].at(-1)?.textContent ?? '',
          openedAtTop: document.querySelector('.source-reader-scroll')?.scrollTop === 0,
          footerInFrame: (() => {
            const footer = document.querySelector('.source-reader-actions')?.getBoundingClientRect();
            const frame = document.querySelector('#source-reader')?.getBoundingClientRect();
            return Boolean(footer && frame && footer.top >= frame.top && footer.bottom <= frame.bottom);
          })(),
          firstParagraphClear: (() => {
            const paragraph = document.querySelector('#source-reader-passages .source-passage')?.getBoundingClientRect();
            const footer = document.querySelector('.source-reader-actions')?.getBoundingClientRect();
            const scroll = document.querySelector('.source-reader-scroll')?.getBoundingClientRect();
            return Boolean(paragraph && footer && scroll && paragraph.top >= scroll.top
              && scroll.bottom <= footer.top && document.querySelector('.source-reader-scroll')?.scrollTop === 0);
          })(),
          visibleResearchNote: /스캔 상태|대조하지 못|원본 .*확인/.test(document.querySelector('#source-reader-provenance-text')?.textContent ?? ''),
        }));
        const letterPacket = historicalPacketMap.get(letterId);
        assert.equal(letterView.paragraphCount, letterPacket?.paragraphs?.length,
          'the subscriber letter renders the complete contiguous source passage');
        assert.ok(letterView.paragraphCount >= 5 && letterView.firstRussian && letterView.lastKorean,
          'the reader shows the letter from its opening through the final translated paragraph');
        assert.equal(letterView.openedAtTop, true, 'opening a new document resets the last document’s scroll position');
        assert.equal(letterView.footerInFrame, true, 'the reading action remains visible inside the mobile paper frame');
        assert.match(letterView.provenance, /RGALI.*RGB|RGALI.*195/, 'the reader identifies the archival locator');
        assert.equal(letterView.firstParagraphClear, true, 'the fixed reading controls do not cover the opening paragraph');
        assert.equal(letterView.visibleResearchNote, false, 'the reading surface contains no research-status meta text');
        const letterShot = path.join(outputDir, `${routeName}-MAIN01-SUBSCRIBER-LETTER-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: letterShot, fullPage: false }); screenshots.push(letterShot);
        await page.locator('#source-reader-passages .source-passage-ko').last().scrollIntoViewIfNeeded();
        const finalLetterParagraph = await page.evaluate(() => {
          const paragraph = [...document.querySelectorAll('#source-reader-passages .source-passage-ko')].at(-1)?.getBoundingClientRect();
          const footer = document.querySelector('.source-reader-actions')?.getBoundingClientRect();
          const scroll = document.querySelector('.source-reader-scroll');
          return { clear: Boolean(paragraph && footer && paragraph.bottom <= footer.top), scrolled: scroll.scrollTop > 0 };
        });
        assert.equal(finalLetterParagraph.scrolled, true, 'the letter body scrolls inside its paper frame');
        assert.equal(finalLetterParagraph.clear, true, 'the final translated sentence clears the fixed reader controls');
        const finalLetterShot = path.join(outputDir, `${routeName}-MAIN01-SUBSCRIBER-LETTER-LAST-PARAGRAPH-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: finalLetterShot, fullPage: false }); screenshots.push(finalLetterShot);
        await page.locator('#source-reader-complete').click(); await page.locator('#save').click();
        sourceReads.push({ sourceId: letterId, date: (await currentState()).world.date,
          hostId: (await currentState()).player.embodiment, mapId: 'printshop',
          paragraphCount: letterView.paragraphCount, screenshot: letterShot });
        await walkTo(targetObject, 'MAIN01 A11 return to printshop decision');
      }
      const preferredId = quest.id === 'V47_MAIN01_A03'
        ? routeName === 'NORMAL' ? 'V47_A03_PANAEV_CATALOGUE_NOTE' : 'V47_A03_PANAEVA_READING_NOTE'
        : quest.id === 'V47_MAIN01_A10'
        ? routeName === 'NORMAL' ? 'V47_A10_HOST_READING' : 'V47_A10_STORE_COPY'
          : routeName === 'ALTERNATE' ? alternativeActions[quest.id] : null;
      const sortedActions = [...quest.actions].sort((a, b) => Number(b.id === preferredId) - Number(a.id === preferredId));
      let selected = null, candidateFailures = [];
      for (const action of sortedActions) {
        const eligible = action.hostIds.map(hostId => runtimeCards.find(card => card.id === hostId))
          .filter(card => card && card.allowedMaps.includes(quest.entry.mapId)
            && (!card.presenceWindow || quest.date >= card.presenceWindow.startDate && quest.date <= card.presenceWindow.endDate));
        if (quest.id === 'V47_MAIN01_A10') eligible.sort((a, b) =>
          Number(b.id === 'sofiya_salon_1848') - Number(a.id === 'sofiya_salon_1848'));
        const storyId = quest.storyId ?? quest.id.match(/MAIN0[135]/)?.[0];
        const exercised = exercisedHostsByStory.get(storyId) ?? new Set();
        if (storyId === 'MAIN03') eligible.sort((a, b) => Number(exercised.has(a.id)) - Number(exercised.has(b.id)));
        for (const card of eligible) {
          try {
            const possessed = await possess(card.id);
            const route = mapRoute(await currentMapId(), quest.entry.mapId, possessed);
            if (!route) { candidateFailures.push(`${card.id}: no map route`); continue; }
            await travelTo(quest.entry.mapId, possessed);
            await walkTo(targetObject, `${quest.id} physical object`);
            if (quest.id === 'V47_MAIN01_PERMISSION') {
              const noticeObject = interactions(targetMap).find(object => propertyMap(object).sourceId === 'V47-NEKRASOV-ALMANAC-CONTENTS-1848');
              const notice = historicalPacketMap.get('V47-NEKRASOV-ALMANAC-CONTENTS-1848');
              const noticeIndex = sourceMap.get('V47-NEKRASOV-ALMANAC-CONTENTS-1848');
              assert.ok(noticeObject && notice?.paragraphs?.length >= 2, 'the primary almanac notice is present as a readable physical object');
              await walkTo(noticeObject, `${quest.id} primary almanac notice`);
              await use();
              const readerDialog = page.locator('#source-reader');
              const noticeReadButton = page.locator('#actions button').filter({ hasText: `자료 읽기 · ${notice.titleKo}` }).first();
              await page.waitForFunction(() => document.querySelector('#source-reader')?.open
                || [...document.querySelectorAll('#actions button')].some(button => button.textContent.includes('자료 읽기 ·')),
              null, { timeout: 5000 });
              if (!await readerDialog.evaluate(element => element.open)) await noticeReadButton.click();
              await page.locator('#source-reader-complete').waitFor({ state: 'visible', timeout: 5000 });
              const noticeView = await page.evaluate(() => ({
                meta: document.querySelector('#source-reader-meta')?.textContent ?? '',
                visibleIdentifiers: [...document.querySelectorAll('#source-reader-ids, #source-reader-meta')]
                  .filter(element => !element.hidden && /EX-|V47-/.test(element.textContent)).map(element => element.textContent),
                title: document.querySelector('#source-reader-title')?.textContent,
                context: document.querySelector('#source-reader-context')?.textContent ?? '',
                provenance: document.querySelector('#source-reader-provenance-text')?.textContent ?? '',
                dateLine: document.querySelector('#source-reader-dates')?.textContent,
                paragraphCount: document.querySelectorAll('#source-reader-passages .source-passage').length,
                artworkVisible: !document.querySelector('#source-reader-artworks')?.hidden,
                artworks: [...document.querySelectorAll('#source-reader-artworks .source-reader-artwork')].map(figure => ({
                  src: figure.querySelector('img')?.getAttribute('src'),
                  loaded: (figure.querySelector('img')?.naturalWidth ?? 0) > 0,
                  caption: figure.querySelector('figcaption')?.textContent,
                })),
                overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              }));
              assert.equal(noticeView.title, notice.titleKo, 'the printshop document opens the almanac notice');
              assert.match(noticeView.provenance, /RA5-PT215–217/, 'the reader keeps the exact periodical page range');
              assert.doesNotMatch(noticeView.provenance, /대조하지 못|스캔 상태|전사문이며 원 잡지 판면/,
                'the reading surface omits research-status commentary');
              assert.doesNotMatch(noticeView.meta, /EX-|V47-/,
                'the player-facing document heading does not expose database source identifiers');
              assert.deepEqual(noticeView.visibleIdentifiers, [], 'document identifiers stay in the provenance drawer, not the reading surface');
              assert.match(noticeView.context, /잡지 호의 발행 허가는 1848년 1월 31일.*아직 발행 전인 연감/,
                'the source context distinguishes the issue permit from the promised almanac');
              assert.match(noticeView.dateLine ?? '', /문서 날짜: 1848-01-31/,
                'the reader shows the issue date without an editorial-status note');
              assert.equal(noticeView.paragraphCount, notice.paragraphs.length, 'the full contiguous notice text appears');
              assert.equal(noticeView.artworkVisible, true, 'the period artwork shelf appears with the notice');
              assert.equal(noticeView.artworks.length, 5, 'the original title page, contiguous notice pages, and separately sourced caricature appear');
              const titlePage = noticeView.artworks.find(artwork => artwork.src?.endsWith('/rpg/assets/v47-illustrated-almanac-titlepage.jpg'));
              const periodicalPages = [215, 216, 217].map(pageNumber => noticeView.artworks.find(artwork =>
                artwork.src?.endsWith(`/rpg/assets/v47-almanac/sovremennik-1848-v7-page-${pageNumber}.png`)));
              const caricature = noticeView.artworks.find(artwork => artwork.src?.endsWith('/rpg/assets/v47-nekrasov-panaev-caricature.jpg'));
              assert.ok(titlePage?.loaded && /실제 책의 표제면/.test(titlePage.caption ?? ''),
                'the authentic 1848 title page resolves from the built asset with its correct caption');
              assert.ok(periodicalPages.every(page => page?.loaded),
                'all three original contiguous periodical pages resolve in the source reader');
              assert.ok(/목차와 그림 공고/.test(periodicalPages[1]?.caption ?? ''),
                'the notice page is identified separately from its surrounding issue context');
              assert.ok(caricature?.loaded && /실제 판면이나 탈니코프 가족 삽화가 아니라/.test(caricature.caption ?? ''),
                'the 1848 caricature remains visibly distinguished from an almanac page');
              assert.equal(noticeView.overflow, false, 'the artwork and document fit the browser width');
              const noticeShot = path.join(outputDir, `${routeName}-MAIN01-ALMANAC-NOTICE-${viewport.width}x${viewport.height}.png`);
              await page.screenshot({ path: noticeShot, fullPage: false }); screenshots.push(noticeShot);
              await page.locator('#source-reader-complete').click();
              await page.locator('#save').click();
              const noticeReadState = await currentState();
              assert.ok(noticeReadState.hosts[noticeReadState.player.embodiment].knownEvidenceIds.includes(notice.sourceId),
                'reading the primary notice records it on the embodied character');
              sourceReads.push({ sourceId: notice.sourceId, excerptId: noticeIndex.excerptId,
                date: noticeReadState.world.date, hostId: noticeReadState.player.embodiment, mapId: 'printshop',
                artworks: ['v47-illustrated-almanac-titlepage', 'v47-sovremennik-v7-page-215',
                  'v47-sovremennik-v7-page-216', 'v47-sovremennik-v7-page-217',
                  'v47-nekrasov-panaev-caricature'], screenshot: noticeShot });
              await walkTo(targetObject, `${quest.id} return to press`);
            }
            if (quest.id === 'V37_EUROPE_NEWS_1848') {
              const manifestoId = 'OBJ-NICHOLAS-MANIFESTO-1848';
              const manifestoObject = interactions(targetMap).find(object => propertyMap(object).sourceId === manifestoId);
              const manifesto = historicalPacketMap.get(manifestoId);
              assert.ok(manifestoObject && manifesto?.paragraphs?.length >= 3,
                'the MAIN03 opener exposes the proclamation as a contiguous physical source');
              assert.equal(propertyMap(manifestoObject).availableDate, '1848-03-27',
                'the proclamation does not appear before its newspaper issue reaches the printshop');
              await walkTo(manifestoObject, 'MAIN03 E42 physical manifesto'); await use();
              const dialog = page.locator('#source-reader');
              const readButton = page.locator('#actions button').filter({ hasText: `자료 읽기 · ${manifesto.titleKo}` }).first();
              await page.waitForFunction(() => document.querySelector('#source-reader')?.open
                || [...document.querySelectorAll('#actions button')].some(button => button.textContent.includes('자료 읽기 ·')),
              null, { timeout: 5000 });
              if (!await dialog.evaluate(element => element.open)) await readButton.click();
              await page.locator('#source-reader-complete').waitFor({ state: 'visible', timeout: 5000 });
              const manifestoView = await page.evaluate(() => ({
                title: document.querySelector('#source-reader-title')?.textContent ?? '',
                dateLine: document.querySelector('#source-reader-dates')?.textContent ?? '',
                paragraphs: document.querySelectorAll('#source-reader-passages .source-passage').length,
                russian: [...document.querySelectorAll('#source-reader-passages .source-passage-ru')].map(node => node.textContent).join('\n'),
                korean: [...document.querySelectorAll('#source-reader-passages .source-passage-ko')].map(node => node.textContent).join('\n'),
              }));
              assert.match(manifestoView.dateLine, /1848-03-14 \(Julian\).*1848-03-27/);
              assert.equal(manifestoView.paragraphs, manifesto.paragraphs.length,
                'the reader shows the full source excerpt before the related decision');
              assert.match(manifestoView.russian, /Объявляем всенародно/);
              assert.match(manifestoView.russian, /Но да не будет так/);
              assert.ok(manifestoView.korean.length > 100, 'the matching Korean translation is present');
              const sourceShot = path.join(outputDir, `${routeName}-MAIN03-E42-SOURCE-${viewport.width}x${viewport.height}.png`);
              await page.screenshot({ path: sourceShot, fullPage: false }); screenshots.push(sourceShot);
              await page.locator('#source-reader-complete').click();
              const readState = await currentState();
              sourceReads.push({ sourceId: manifestoId, date: readState.world.date,
                hostId: readState.player.embodiment, mapId: 'printshop', paragraphCount: manifestoView.paragraphs,
                screenshot: sourceShot });
              const gatherMinutes = await waitForEuropeNewsReadingReady();
              sourceReads.at(-1).eventStage = 'READING_READY';
              sourceReads.at(-1).gatherMovementSteps = gatherMinutes;
              await walkTo(targetObject, 'MAIN03 E42 decision after reading the proclamation');
            }
            if (quest.id === 'V47_MAIN01_A03') {
              const authorId = routeName === 'NORMAL' ? 'panaev_1848' : 'panaeva_1848';
              await possess(authorId);
              const physicalBook = interactions(targetMap).find(object => propertyMap(object).sourceId === 'V47-PANAEVA-TALNIKOV-CH1-1848');
              assert.ok(physicalBook, 'MAIN01 A03 has a physical copy of the source in the workshop');
              await walkTo(physicalBook, `${quest.id} physical book`);
            }
            if (action.requiredKnowledgeId) {
              const state = await currentState();
              const readerHostId = state.player.embodiment;
              if (!state.hosts[readerHostId]?.knownEvidenceIds?.includes(action.requiredKnowledgeId)) {
                const sourceObject = interactions(targetMap).find(object => propertyMap(object).sourceId === action.requiredKnowledgeId);
                const packet = historicalPacketMap.get(action.requiredKnowledgeId);
                const sourceRecord = sourceMap.get(action.requiredKnowledgeId);
                assert.ok(sourceObject && packet?.paragraphs?.length,
                  `${quest.id}/${action.id} has a physical source object and contiguous reader text`);
                assert.ok(sourceRecord, `${action.requiredKnowledgeId} has a provenance record`);
                await walkTo(sourceObject, `${quest.id} required source ${action.requiredKnowledgeId}`);
                await use();
                const readerDialog = page.locator('#source-reader');
                const readButton = page.locator('#actions button')
                  .filter({ hasText: `자료 읽기 · ${packet.titleKo}` }).first();
                await page.waitForFunction(() => document.querySelector('#source-reader')?.open
                  || [...document.querySelectorAll('#actions button')].some(button => button.textContent.startsWith('자료 읽기 ·')),
                null, { timeout: 5000 });
                if (!await readerDialog.evaluate(element => element.open)) await readButton.click();
                await page.locator('#source-reader-complete').waitFor({ state: 'visible', timeout: 5000 });
                const sourceView = await page.evaluate(() => ({
                  title: document.querySelector('#source-reader-title')?.textContent ?? '',
                  paragraphs: document.querySelectorAll('#source-reader-passages .source-passage').length,
                  russian: [...document.querySelectorAll('#source-reader-passages .source-passage-ru')]
                    .map(node => node.textContent).join('\n'),
                  korean: [...document.querySelectorAll('#source-reader-passages .source-passage-ko')]
                    .map(node => node.textContent).join('\n'),
                }));
                assert.equal(sourceView.title, packet.titleKo, `${action.requiredKnowledgeId} opens in the physical source reader`);
                assert.equal(sourceView.paragraphs, packet.paragraphs.length,
                  `${action.requiredKnowledgeId} displays the complete checked excerpt`);
                assert.ok(sourceView.russian.length > 80 && sourceView.korean.length > 80,
                  `${action.requiredKnowledgeId} keeps Russian and Korean text aligned`);
                const sourceShot = path.join(outputDir,
                  `${routeName}-${quest.id}-${action.requiredKnowledgeId}-${viewport.width}x${viewport.height}.png`);
                await page.screenshot({ path: sourceShot, fullPage: false }); screenshots.push(sourceShot);
                await page.locator('#source-reader-complete').click();
                await page.locator('#save').click();
                const readState = await currentState();
                assert.ok(readState.hosts[readerHostId].knownEvidenceIds.includes(action.requiredKnowledgeId),
                  `${readerHostId} personally reads ${action.requiredKnowledgeId} before the choice`);
                sourceReads.push({ sourceId: action.requiredKnowledgeId, excerptId: sourceRecord.excerptId,
                  date: readState.world.date, hostId: readerHostId, mapId: quest.entry.mapId,
                  paragraphCount: sourceView.paragraphs, questId: quest.id, beforeActionId: action.id, screenshot: sourceShot });
                await walkTo(targetObject, `${quest.id} return after reading required source`);
              }
            }
            await use();
            if (quest.id === 'V37_EUROPE_NEWS_1848') {
              const inspectEvent = page.locator('#actions button').filter({ hasText: `사건 살펴보기 · ${quest.titleKo}` }).first();
              await inspectEvent.waitFor({ state: 'visible', timeout: 3000 });
              await inspectEvent.click();
            }
            if (quest.id === 'V47_MAIN01_A03') {
              const source = historicalPacketMap.get('V47-PANAEVA-TALNIKOV-CH1-1848');
              assert.equal(source?.paragraphs?.length, 13, 'the current MAIN01 reader is built from the expanded passage');
              // E opens the reader directly when the book is the only nearby object;
              // otherwise it presents an explicit “자료 읽기” action.
              const dialog = page.locator('#source-reader');
              const readButton = page.locator('#actions button').filter({ hasText: `자료 읽기 · ${source.titleKo}` }).first();
              await page.waitForFunction(() => document.querySelector('#source-reader')?.open
                || [...document.querySelectorAll('#actions button')].some(button => button.textContent.includes('자료 읽기 · 「탈니코프 가족」 첫 장')),
              null, { timeout: 5000 });
              if (!await dialog.evaluate(element => element.open)) await readButton.click();
              await page.locator('#source-reader-complete').waitFor({ state: 'visible', timeout: 5000 });
              const reader = await page.evaluate(() => ({
                title: document.querySelector('#source-reader-title')?.textContent,
                provenance: document.querySelector('#source-reader-provenance-text')?.textContent ?? '',
                dateLine: document.querySelector('#source-reader-dates')?.textContent,
                paragraphCount: document.querySelectorAll('#source-reader-passages .source-passage').length,
                firstRussian: document.querySelector('#source-reader-passages .source-passage-ru')?.textContent,
                lastKorean: [...document.querySelectorAll('#source-reader-passages .source-passage-ko')].at(-1)?.textContent,
                sourcePages: [...document.querySelectorAll('#source-reader-artworks img')].map(image => ({
                  src: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0,
                })),
                sourceCaptions: [...document.querySelectorAll('#source-reader-artworks figcaption')].map(caption => caption.textContent),
                has1928Witness: [...document.querySelectorAll('#source-reader-links a')].some(link =>
                  link.href === 'https://imwerden.de/pdf/panaeva_semejstvo_talnikovykh_academia_1928_text.pdf'
                  && link.textContent.includes('1928년 재수록본')),
                overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              }));
              await page.waitForFunction(() => {
                const pages = [...document.querySelectorAll('#source-reader-artworks img')];
                return pages.length === 3 && pages.every(image => image.complete && image.naturalWidth > 0);
              }, null, { timeout: 5000 });
              reader.sourcePages = await page.locator('#source-reader-artworks img').evaluateAll(images => images.map(image => ({
                src: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0,
              })));
              assert.equal(reader.title, source.titleKo, 'the physical book object opens the right text');
              assert.match(reader.provenance, /9–11/, 'the reader keeps the exact inspected source-leaf range');
              assert.doesNotMatch(reader.provenance, /원본.*대조하지 못|스캔 상태|현대 전사문/,
                'the reading surface omits research-status commentary');
              assert.equal(reader.paragraphCount, 13, 'all contiguous source paragraphs render in the large reader');
              assert.equal(reader.sourcePages.length, 3, 'all collated 1848 scan leaves render with the original passage');
              assert.ok(reader.sourcePages.every(image => image.loaded), 'all original scan images load before the passage can be read');
              await page.locator('#source-reader-artworks figure').last().scrollIntoViewIfNeeded();
              const lastLeafView = await page.evaluate(() => {
                const dialog = document.querySelector('#source-reader');
                const leaf = document.querySelector('#source-reader-artworks figure:last-child')?.getBoundingClientRect();
                const actions = document.querySelector('.source-reader-actions')?.getBoundingClientRect();
                const frame = dialog.getBoundingClientRect();
                return { scrolled: dialog.querySelector('.source-reader-scroll').scrollTop > 0, leafTop: leaf?.top, leafBottom: leaf?.bottom,
                  frameTop: frame.top, actionTop: actions?.top };
              });
              assert.equal(lastLeafView.scrolled, true, 'the long source gallery scrolls inside its document window');
              assert.ok(lastLeafView.leafTop >= lastLeafView.frameTop && lastLeafView.leafBottom <= lastLeafView.actionTop,
                `the final original source leaf can be read above the sticky action bar: ${JSON.stringify(lastLeafView)}`);
              await page.locator('#source-reader-passages .source-passage-ko').last().scrollIntoViewIfNeeded();
              const finalTranslationView = await page.evaluate(() => {
                const dialog = document.querySelector('#source-reader');
                const translations = [...document.querySelectorAll('#source-reader-passages .source-passage-ko')];
                const finalTranslation = translations.at(-1);
                const translation = finalTranslation?.getBoundingClientRect();
                const actions = document.querySelector('.source-reader-actions')?.getBoundingClientRect();
                const frame = dialog.getBoundingClientRect();
                return { top: translation?.top, bottom: translation?.bottom, frameTop: frame.top,
                  actionTop: actions?.top, text: finalTranslation?.textContent };
              });
              assert.ok(finalTranslationView.top >= finalTranslationView.frameTop && finalTranslationView.bottom <= finalTranslationView.actionTop,
                `the final translated paragraph can be read above the sticky action bar: ${JSON.stringify(finalTranslationView)}`);
              const finalPassageShot = path.join(outputDir, `${routeName}-MAIN01-TALNIKOV-DOCUMENT-LAST-PARAGRAPH-${viewport.width}x${viewport.height}.png`);
              await page.screenshot({ path: finalPassageShot, fullPage: false }); screenshots.push(finalPassageShot);
              assert.equal(reader.has1928Witness, true, 'the large reader exposes its accessible 1928 reprint witness link');
              assert.ok(reader.firstRussian?.includes('ГЛАВА I') && reader.lastKorean?.includes('날카로운 비명'),
                'the reader starts at chapter one and retains the complete translated ending of the passage');
              assert.equal(reader.overflow, false, 'the open book reader does not cause horizontal page overflow');
              const documentShot = path.join(outputDir, `${routeName}-MAIN01-TALNIKOV-DOCUMENT-${viewport.width}x${viewport.height}.png`);
              await page.screenshot({ path: documentShot, fullPage: false }); screenshots.push(documentShot);
              await page.locator('#source-reader-complete').click();
              await page.locator('#save').click();
              const readState = await currentState();
              const readingHost = readState.hosts[readState.player.embodiment];
              assert.ok(readingHost.knownEvidenceIds.includes('V47-PANAEVA-TALNIKOV-CH1-1848'),
                `finishing the book marks its evidence as read on the embodied character; ${JSON.stringify({ hostId: readState.player.embodiment, knownEvidenceIds: readingHost.knownEvidenceIds, observed: readState.player.observedEvidenceIds, latestLedger: readState.ledger.slice(-2) })}`);
              sourceReads.push({ sourceId: source.sourceId, date: readState.world.date,
                hostId: readState.player.embodiment, mapId: 'printshop', paragraphCount: reader.paragraphCount, screenshot: documentShot });
            }
            if (quest.id === 'V47_MAIN01_PERMISSION'
              && propertyMap(targetObject).v47PuzzleId === 'MAIN01_PRINTWORK') {
              const workChoices = routeName === 'ALTERNATE' ? [
                '지금 인쇄대로 보낸다', '젖은 종이에 잉크를 더 올린다',
                '구독자 몫을 편집실에 둔다', '서점 몫을 편집실에 돌린다',
                '확인본을 편집부에 둔다', '제본 전 사본을 남긴다',
              ] : [
                '교정쇄를 다시 대조한다', '마른 종이와 얇은 잉크를 쓴다',
                '구독자 몫을 파벨에게 맡긴다', '서점 위탁분을 레프에게 맡긴다',
                '스테판에게 확인본을 건넨다', '남은 종이를 재료로 돌린다',
              ];
              await page.locator('#actions button').filter({ hasText: '활자대를 비우기' }).click();
              for (const [index, glyph] of [...'Семейство Тальниковых'].entries()) {
                const tile = glyph === ' '
                  ? page.locator('.type-tile[aria-label="띄어쓰기 활자"]').first()
                  : page.locator(`.type-tile[aria-label="활자 ${glyph}"]`).first();
                await tile.waitFor({ state: 'visible', timeout: 3000 });
                await tile.click();
                await page.waitForFunction(expected => document.querySelector('.type-setter-composition')
                  ?.getAttribute('aria-label') === `표제 활자 ${expected}/21개`, index + 1);
              }
              const typesetShot = path.join(outputDir, `${routeName}-MAIN01-PRINTWORK-TYPESET-${viewport.width}x${viewport.height}.png`);
              await page.screenshot({ path: typesetShot, fullPage: false }); screenshots.push(typesetShot);
              const impress = page.locator('#actions button').filter({ hasText: '교정 인쇄' }).first();
              assert.equal(await impress.isDisabled(), false, 'the 21 composed Russian sorts enable the proof press');
              await impress.click();
              for (const [index, label] of workChoices.entries()) {
                const workChoice = page.locator('#actions button').filter({ hasText: label }).first();
                try { await workChoice.waitFor({ state: 'visible', timeout: 3000 }); }
                catch (error) {
                  const diagnostic = await page.evaluate(() => ({
                    printwork: JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.world?.v47?.printwork,
                    headline: document.querySelector('#headline')?.textContent,
                    record: document.querySelector('#record')?.textContent,
                    buttons: [...document.querySelectorAll('#actions button')].map(button => button.textContent),
                  }));
                  await page.screenshot({ path: path.join(outputDir, `${routeName}-MAIN01-PRINTWORK-STALLED.png`), fullPage: true });
                  throw new Error(`printwork step ${index} (${label}) not visible: ${error.message}; ${JSON.stringify(diagnostic)}`);
                }
                await workChoice.click();
                if (index < workChoices.length - 1) {
                  const nextWorkStep = page.locator('#actions button').filter({ hasText: '다음 작업' }).first();
                  await nextWorkStep.waitFor({ state: 'visible', timeout: 3000 });
                  await nextWorkStep.click();
                }
              }
              const continueWork = page.locator('#actions button').filter({ hasText: '연감 작업을 계속한다' }).first();
              await continueWork.waitFor({ state: 'visible', timeout: 3000 });
              await continueWork.click();
            }
            const choice = page.locator('#actions button').filter({ hasText: action.labelKo }).first();
            try { await choice.waitFor({ state: 'visible', timeout: 2500 }); }
            catch {
              const detail = quest.id === 'V37_EUROPE_NEWS_1848' ? await page.evaluate(() => {
                const state = JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state;
                return `event=${JSON.stringify(state?.world?.livingEventStates?.E42)} position=${JSON.stringify({
                  mapId: document.body.dataset.worldMap, x: document.body.dataset.playerX, y: document.body.dataset.playerY,
                  hostId: state?.player?.embodiment,
                })} buttons=${JSON.stringify([...document.querySelectorAll('#actions button')].map(button => button.textContent))}`;
              }) : await page.locator('#record').innerText();
              candidateFailures.push(`${action.id}/${card.id}: ${detail}`);
              continue;
            }
            if (await choice.isDisabled()) { candidateFailures.push(`${action.id}/${card.id}: action is disabled`); continue; }
            selected = { action, host: card, choice };
            break;
          } catch (error) {
            candidateFailures.push(`${action.id}/${card.id}: ${error.message}`);
            if (routeName === 'ALTERNATE' && quest.id === 'V47_MAIN01_A05') {
              await page.locator('#save').click();
              const failedMapId = await currentMapId();
              const exitRows = interactions(maps[failedMapId]).filter(object => object.type === 'map-exit').map(object => ({
                name: object.name, tile: tileOf(object), props: propertyMap(object),
              }));
              const diagnostic = await page.evaluate(exitRows => {
                const state = JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state;
                const mapId = document.body.dataset.worldMap;
                return { mapId, position: { x: Number(document.body.dataset.playerX), y: Number(document.body.dataset.playerY) },
                  chapter: state?.world?.chapterId, date: state?.world?.date, clockMinutes: state?.world?.clockMinutes,
                  embodiment: state?.player?.embodiment, quest: state?.quests?.V47_MAIN01_A05,
                  exit: exitRows,
                  occupants: Object.values(state?.hosts ?? {}).filter(host => host.mapId === mapId
                    && host.historicalAliveAndPresent !== false).map(host => ({ id: host.id, position: host.position,
                      kind: host.kind, alive: host.historicalAliveAndPresent })),
                  actions: [...document.querySelectorAll('#actions button')].map(button => button.textContent) };
              }, exitRows);
              await page.screenshot({ path: path.join(outputDir, 'ALTERNATE-MAIN01-A05-exit-failure.png'), fullPage: false });
              await writeFile(path.join(outputDir, 'V47_ALTERNATE_MAIN01_A05_EXIT_FAILURE.json'), `${JSON.stringify({ error: error.message, ...diagnostic }, null, 2)}\n`);
            }
          }
        }
        if (selected) break;
      }
      assert.ok(selected, `${routeName}: ${quest.id} is playable through map exits and possession. ${candidateFailures.join(' | ')}`);
      if (quest.id === 'V47_MAIN01_A03') {
        const sceneView = await page.evaluate(() => ({
          headline: document.querySelector('#headline')?.textContent ?? '',
          journal: document.querySelector('#journal-text')?.textContent ?? '',
          selectedChoice: (() => {
            const button = [...document.querySelectorAll('#actions button')]
              .find(item => item.textContent.includes('작업이 끝난 뒤 함께 읽는다'));
            if (!button) return null;
            const rect = button.getBoundingClientRect();
            return { text: button.innerText, rect: { top: rect.top, bottom: rect.bottom, height: rect.height },
              visibleInViewport: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight };
          })(),
          journalRect: (() => { const rect = document.querySelector('.journal').getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, height: rect.height }; })(),
          actionsRect: (() => { const rect = document.querySelector('#actions').getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, height: rect.height }; })(),
          journalTextScrollTop: document.querySelector('#journal-text')?.scrollTop ?? -1,
          missionHidden: document.querySelector('#mission-tracker')?.hidden ?? false,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }));
        const sceneShot = path.join(outputDir, `${routeName}-MAIN01-TALNIKOV-CHOICE-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: sceneShot, fullPage: false }); screenshots.push(sceneShot);
        assert.ok(sceneView.journal.includes('첫 장부터 어머니가') && sceneView.journal.includes('줄어들 독자'),
          'the Talnikov choice screen keeps its contextual four-person conversation visible');
        assert.ok(sceneView.selectedChoice?.text.includes('작업자') && sceneView.selectedChoice.text.includes('서점'),
          'the shared-reading option names its immediate audience before selection');
        assert.equal(sceneView.selectedChoice.visibleInViewport, true,
          `the shared-reading choice is actually visible in the viewport: ${JSON.stringify(sceneView)}`);
        assert.equal(sceneView.missionHidden, true, 'the redundant mission panel gives the scene dialogue and choice room');
        assert.equal(sceneView.journalTextScrollTop, 0, 'the dialogue starts at its first line while choices stay visible');
        assert.equal(sceneView.overflow, false, 'the Talnikov choice screen fits the desktop viewport');
      }
      const positionBefore = await currentPosition();
      const mapBefore = await currentMapId();
      const dateBefore = (await currentState()).world.date;
      const ledgerLengthBefore = (await currentState()).ledger.length;
      await selected.choice.click();
      try { await page.waitForFunction(({ questId }) => JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state?.quests?.[questId]?.status === 'resolved',
        { questId: quest.id }, { timeout: 7000 }); }
      catch (error) {
        const diagnostic = await page.evaluate(questId => {
          const save = JSON.parse(localStorage.getItem('v33-rpg-save') ?? 'null')?.state;
          return { quest: save?.quests?.[questId], map: document.body.dataset.worldMap,
            position: { x: document.body.dataset.playerX, y: document.body.dataset.playerY },
            headline: document.querySelector('#headline')?.textContent, record: document.querySelector('#record')?.textContent,
            actions: [...document.querySelectorAll('#actions button')].map(button => ({ text: button.textContent, disabled: button.disabled })) };
        }, quest.id);
        throw new Error(`${quest.id}/${selected.action.id}/${selected.host.id} did not resolve after choice: ${error.message}; ${JSON.stringify(diagnostic)}`);
      }
      const after = await currentState();
      const storyId = quest.storyId ?? quest.id.match(/MAIN0[135]/)?.[0];
      (exercisedHostsByStory.get(storyId) ?? exercisedHostsByStory.set(storyId, new Set()).get(storyId)).add(selected.host.id);
      const row = {
        storyId: quest.storyId ?? quest.id.match(/MAIN0[135]/)?.[0], questId: quest.id, beatId: quest.beatId ?? quest.id,
        dateBefore, dateAfter: after.world.date, hostId: selected.host.id, mapId: mapBefore,
        arrivalPosition: positionBefore, actionId: selected.action.id, status: after.quests[quest.id].status,
        personalStoryGoal: after.hosts[selected.host.id].personalGoals?.filter(goal => goal.successCondition?.questId === quest.id
          && (goal.successCondition.actionId === selected.action.id || goal.successCondition.actionIds?.includes(selected.action.id)))
          .map(goal => ({ id: goal.id, status: after.hosts[selected.host.id].personalGoalProgress?.[goal.id]?.status ?? 'ACTIVE' })) ?? [],
        ledgerSaved: after.ledger.some(item => item.questId === quest.id && item.actionId === selected.action.id),
        worldChange: [...(after.world.v47.worldChanges ?? [])].reverse()
          .find(change => change.questId === quest.id && change.actionId === selected.action.id) ?? null,
        autonomousStoryOutcomes: after.ledger.slice(ledgerLengthBefore)
          .filter(item => item.eventType === 'V47_AUTONOMOUS_STORY_OUTCOME')
          .map(item => ({ storyId: item.storyId, questId: item.questId, actionId: item.actionId, unattended: item.unattended })),
        ...(quest.id === 'V47_MAIN01_PERMISSION' ? { printwork: {
          ...after.world.v47.printwork,
          itemHolders: Object.fromEntries(['courier_pavel', 'bookseller_lev', 'print_apprentice_stepan', 'printer_ekaterina', 'editor_sofia']
            .map(hostId => [hostId, after.hosts[hostId].inventory.filter(item =>
              after.world.v47.printwork.outgoingItems.some(output => output.toHostId === hostId && output.itemKo === item))])),
          courierTravel: after.hosts.courier_pavel.v47TravelGoal ?? null,
          moneyByHost: Object.fromEntries(['bookseller_lev', 'editor_sofia'].map(hostId => [hostId, after.hosts[hostId].money.amount])),
          transactionLedger: after.ledger.filter(item => item.eventType === 'V47_PRINTWORK_STEP'),
        } } : {}),
        cholera: { counters: after.world.v47.cholera.counters, waterRisk: after.world.v47.cholera.waterRisk,
          foodRisk: after.world.v47.cholera.foodRisk },
      };
      assert.equal(row.ledgerSaved, true, `${quest.id} action is in the real browser save ledger`);
      if (quest.id === 'V47_MAIN01_A03') {
        const expectedAuthor = routeName === 'NORMAL'
          ? { hostId: 'panaev_1848', actionId: 'V47_A03_PANAEV_CATALOGUE_NOTE' }
          : { hostId: 'panaeva_1848', actionId: 'V47_A03_PANAEVA_READING_NOTE' };
        assert.equal(selected.host.id, expectedAuthor.hostId,
          `${routeName} MAIN01 A03 enters the intended author through the in-game possession roster (selected ${selected.action.id})`);
        assert.equal(selected.action.id, expectedAuthor.actionId,
          `${routeName} MAIN01 A03 performs that author's own physical reading decision`);
        assert.equal(row.personalStoryGoal.length, 1, `${selected.host.id} exposes its A03 individual objective`);
        assert.equal(row.personalStoryGoal[0].status, 'SATISFIED', `${selected.host.id}'s A03 objective completes in the saved browser state`);
      }
      if (quest.id === 'V47_MAIN01_A10') {
        assert.ok(['sofiya_salon_1848', 'reader_darya'].includes(selected.host.id),
          `${routeName} resolves the disposition through the patron or the reader who returns her copy`);
        if (selected.host.id === 'sofiya_salon_1848') {
          assert.equal(row.personalStoryGoal.length, 1, 'Sofiya’s A10 individual objective is tracked');
          assert.equal(row.personalStoryGoal[0].status, 'SATISFIED', 'Sofiya’s chosen reading or storage outcome completes her objective');
        } else if (selected.action.id === 'V47_A10_STORE_COPY') {
          assert.equal(row.worldChange.inventory.filter(item => item.fromHostId === 'reader_darya'
            && item.toHostId === 'sofiya_salon_1848').length, 2,
          'Darya physically returns the book and invitation to Sofiya when she makes this choice');
        } else {
          assert.equal(selected.action.id, 'V47_A10_HOST_READING');
          assert.ok(questsById.get(quest.id).actions.find(action => action.id === selected.action.id)?.hostIds.includes('reader_darya'),
            'Darya is an authored host for the reading-room branch as well as the storage branch');
        }
      }
      if (quest.id === 'V47_MAIN01_PERMISSION') {
        assert.equal(row.printwork.schemaVersion, 'V47_PRINTWORK_V2');
        assert.equal(row.printwork.status, 'COMPLETE');
        assert.equal(row.printwork.decisions.length, 7);
        assert.equal(row.printwork.allocations.length, 4);
        assert.ok((row.printwork.itemHolders.courier_pavel.includes('구독자 주문용 연감 묶음')
          && row.printwork.courierTravel?.targetMapId === 'bookshop-interior')
          || row.printwork.itemHolders.editor_sofia.includes('보류한 구독자 주문 묶음'),
        `${routeName} records the subscription package at its selected physical destination`);
        if (routeName === 'NORMAL') {
          assert.ok(row.printwork.itemHolders.courier_pavel.includes('서점 위탁 연감 묶음'));
          assert.ok(row.printwork.transactionLedger.some(item => item.actionId === 'V47_PRINT_CONSIGN_BOOKSHOP'
            && item.effects.money.some(transfer => transfer.fromHostId === 'bookseller_lev' && transfer.toHostId === 'editor_sofia')),
          'the normal route logs the consignment payment as well as the physical carrier');
        }
      }
      assert.ok(!row.worldChange || (row.worldChange.questId === quest.id && row.worldChange.actionId === selected.action.id),
        `${quest.id}/${selected.action.id} reports only its own direct world change`);
      assert.ok(row.autonomousStoryOutcomes.every(item => item.unattended === true),
        `${quest.id}/${selected.action.id} reports unattended story outcomes separately`);
      rows.push(row);
      if (quest.id === 'V47_MAIN01_DISTRIBUTION_BAN') {
        const host = await possess('printer_ekaterina');
        await travelTo('printshop', host);
        for (const packet of MAIN01_STORAGE_PACKETS) {
          const shelfDefinition = MAIN01_STORAGE_SHELVES.find(item => item.id === packet.shelfId);
          const shelfObject = interactions(maps.printshop).find(object => propertyMap(object).v47StorageShelf === packet.shelfId);
          assert.ok(shelfObject && shelfDefinition, `${packet.shelfId}: physical shelf is on the printshop map`);
          await walkTo(shelfObject, `MAIN01 storage ${shelfDefinition.labelKo}`);
          await use();
          const packetAction = page.locator('#actions button').filter({ hasText: packet.labelKo }).first();
          await packetAction.waitFor({ state: 'visible', timeout: 3000 });
          await packetAction.click();
          const placed = await currentState();
          assert.equal(placed.world.v47.main01Storage.placements[packet.id]?.correct, true,
            `${packet.labelKo} is placed through the in-game shelf action`);
          await page.locator('#save').click();
        }
        const storageResult = await currentState();
        assert.equal(storageResult.world.v47.main01Storage.status, 'COMPLETE', 'the physical four-shelf task completes in browser play');
        assert.ok(storageResult.hosts.printer_ekaterina.inventory.includes('연감 창고 분류표'),
          'the browser interaction gives its earned sorting record to the embodied worker');
        assert.equal(storageResult.ledger.filter(item => item.eventType === 'V47_MAIN01_STORAGE_PLACE').length, 4,
          'each physical placement is persisted in the actual game ledger');
        const storageShot = path.join(outputDir, `${routeName}-MAIN01-STORAGE-SHELVES-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: storageShot, fullPage: false }); screenshots.push(storageShot);
      }
      const progressName = main01Only ? `V47_${routeName}_MAIN01_BROWSER_PROGRESS.json` : `V47_${routeName}_BROWSER_PROGRESS.json`;
      await writeFile(path.join(outputDir, progressName), `${JSON.stringify({ routeName, lastResolved: row, count: rows.length, rows, transitions }, null, 2)}\n`);
      console.log(`${routeName} ${row.storyId} ${row.questId} ${row.actionId}`);
      const countForStory = rows.filter(item => item.storyId === row.storyId).length;
      if (countForStory === 1 || countForStory === 12) {
        const shot = path.join(outputDir, `${routeName}-${row.storyId}-${countForStory === 1 ? 'entry' : 'aftermath'}.png`);
        await page.screenshot({ path: shot, fullPage: true }); screenshots.push(shot);
      }
      if (quest.id === 'V47_MAIN01_A10') {
        const shot = path.join(outputDir, `${routeName}-MAIN01-SOFIYA-SALON-AFTERMATH-${viewport.width}x${viewport.height}.png`);
        await page.screenshot({ path: shot, fullPage: false }); screenshots.push(shot);
      }
      if (main01Only && rows.filter(item => item.storyId === 'MAIN01').length === 12) break;
      if (rows.filter(item => item.storyId === 'MAIN01').length === 12
        && rows.filter(item => item.storyId === 'MAIN03').length === 12
        && rows.filter(item => item.storyId === 'MAIN05').length === 12) break;
    }
    let timelinePuzzle = null;
    if (main01Only) {
      const timelineHost = runtimeCards.find(card => card.id === 'printer_ekaterina');
      await possess(timelineHost.id);
      if (await currentMapId() !== 'printshop') await travelTo('printshop', timelineHost);
      const board = interactions(maps.printshop).find(object => object.id === 9054);
      assert.ok(board, 'the physical MAIN01 date board exists on the printshop map');
      await walkTo(board, 'MAIN01 chronology board'); await use();
      await page.waitForFunction(() => document.querySelector('#headline')?.textContent === '연감의 날짜를 맞추다', null, { timeout: 2500 });
      const boardShot = path.join(outputDir, `${routeName}-MAIN01-CHRONOLOGY-BOARD-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: boardShot, fullPage: true }); screenshots.push(boardShot);
      for (const card of main01TimelineSources) {
        await page.locator('#actions .timeline-date-card').filter({ hasText: card.dateJulian }).click();
      }
      await page.locator('#actions button').filter({ hasText: '순서 확인' }).click();
      const solvedMessage = page.getByText('정리한 대조표는 소피아의 편집 장부에 남아 있다.');
      await solvedMessage.waitFor({ timeout: 2500 });
      const resultRect = await solvedMessage.boundingBox();
      assert.ok(resultRect && resultRect.y >= 0 && resultRect.y + resultRect.height <= viewport.height,
        `${routeName}: chronology result text is visible without being clipped`);
      await page.locator('#actions button').filter({ hasText: '확인' }).waitFor({ state: 'visible', timeout: 2500 });
      const solved = await currentState();
      assert.equal(solved.world.v47.main01Timeline.status, 'COMPLETE', `${routeName}: physical date puzzle solved`);
      assert.ok(solved.hosts.editor_sofia.inventory.includes('연감의 날짜를 정리한 대조표'),
        `${routeName}: the solved chronology becomes an inventory item`);
      const shot = path.join(outputDir, `${routeName}-MAIN01-CHRONOLOGY-SOLVED.png`);
      await page.screenshot({ path: shot, fullPage: true }); screenshots.push(shot);
      timelinePuzzle = { status: 'PASS', orderedSourceIds: solved.ledger.filter(item => item.eventType === 'V47_MAIN01_TIMELINE_STEP').at(-1)?.orderedSourceIds,
        itemHolder: 'editor_sofia', screenshot: shot };
    }
    const storySummary = Object.fromEntries(['MAIN01', 'MAIN03', 'MAIN05'].map(storyId => {
      const events = rows.filter(row => row.storyId === storyId);
      return [storyId, { resolved: events.length, uniqueHosts: [...new Set(events.map(row => row.hostId))].length,
        maps: [...new Set(events.map(row => row.mapId))], status: events.length === 12 && events.every(row => row.status === 'resolved') ? 'PASS' : 'INCOMPLETE' }];
    }));
    if (e41Only) {
      assert.equal(rows.some(row => row.questId === 'E41_SEMENOVSKY_1849'), true, 'E41 browser diagnostic recorded the fixed event');
      assert.equal(rows.some(row => row.questId === 'V47_MAIN03_P11'), true, 'E41 browser diagnostic completed the aftermath beat');
    } else if (main01Only) {
      assert.equal(storySummary.MAIN01.status, 'PASS', `${routeName}: browser completes MAIN01`);
      if (routeName === 'ALTERNATE') {
        const talnikovIndex = rows.findIndex(row => row.questId === 'V47_MAIN01_A03');
        const subscriberIndex = rows.findIndex(row => row.questId === 'V47_MAIN01_A02');
        assert.ok(talnikovIndex >= 0 && subscriberIndex > talnikovIndex,
          'alternate MAIN01 route completes the later Talnikov scene before returning to the earlier subscriber lead');
      }
      assert.ok(sourceReads.some(row => row.sourceId === 'V47-NEKRASOV-ALMANAC-CONTENTS-1848'),
        'the main route logs reading the primary almanac notice before the press decision');
      assert.ok(sourceReads.some(row => row.sourceId === 'V47-PANAEVA-TALNIKOV-CH1-1848'),
        'the main route logs reading the complete Talnikov chapter before its related choice');
      assert.ok(sourceReads.some(row => row.sourceId === 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848'
        && row.paragraphCount === historicalPacketMap.get('V47-NEKRASOV-SUBSCRIBER-LETTER-1848')?.paragraphs?.length),
      'the main route logs the full five-paragraph subscriber letter before its related choice');
    }
    else for (const [storyId, result] of Object.entries(storySummary)) assert.equal(result.status, 'PASS', `${routeName}: full browser route completes ${storyId}`);
    if (!main01Only && !e41Only) for (const [questId, sourceId] of [
      ['V47_MAIN03_P05', 'OBJ-BELINSKY-LETTER-GOGOL-1847'],
      ['V47_MAIN03_P07', 'OBJ-WS-DOSTOEVSKY-ARREST-ORDER-1849'],
    ]) {
      const sourceRead = sourceReads.find(row => row.questId === questId && row.sourceId === sourceId);
      assert.ok(sourceRead, `${routeName}: ${questId} logs physical reading of ${sourceId} before its choice`);
      assert.ok(sourceRead.paragraphCount >= 4 && sourceRead.screenshot,
        `${routeName}: ${sourceId} has a complete reader view and screenshot`);
    }
    assert.deepEqual(pageErrors, [], `${routeName}: continuous browser route has no page errors`);
    await page.locator('#save').click();
    const finalSave = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    game.loadGame(finalSave, { maps, hostCards: runtimeCards, quests: questList });
    const report = { routeName, scope: main01Only ? 'MAIN01 start-to-aftermath browser play' : e41Only ? 'E41 date gate and historical event browser play' : 'full V47 campaign browser play',
      status: main01Only ? storySummary.MAIN01.status : 'PASS', stories: storySummary, quests: rows, transitions, sourceReads, screenshots, timelinePuzzle,
      fixedHistoricalEvent: rows.find(row => row.questId === 'E41_SEMENOVSKY_1849') ?? null,
      pageErrors, pageCrashes, viewport };
    const reportName = main01Only ? `V47_${routeName}_MAIN01_BROWSER_CAMPAIGN.json` : `V47_${routeName}_BROWSER_CAMPAIGN.json`;
    await writeFile(path.join(outputDir, reportName), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally { await context.close(); }
}

await mkdir(outputDir, { recursive: true });
const base = `http://127.0.0.1:${previewPort}/`;
const browser = await chromium.launch({ headless: true,
  ...(process.env.V47_HEADLESS_SOFTWARE_RENDERING === '1' ? { args: ['--disable-gpu'] } : {}),
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
try {
  const routes = [];
  const routeNames = e41Only ? ['E41_ONLY'] : alternateOnly ? ['ALTERNATE'] : normalOnly ? ['NORMAL'] : ['NORMAL', 'ALTERNATE'];
  for (const routeName of routeNames) routes.push(await runRoute(browser, base, routeName));
  if (!alternateOnly && !normalOnly && !main01Only) await writeFile(path.join(outputDir, 'V47_BROWSER_CAMPAIGN_INDEX.json'), `${JSON.stringify({ status: 'PASS',
    scope: 'continuous in-browser play through physical map traversal and UI choices from MAIN01 entry through MAIN03 aftermath; prior non-V47 campaign arcs are seeded as resolved context',
    routes: routes.map(route => ({ routeName: route.routeName, stories: route.stories,
      questCount: route.quests.filter(row => row.storyId?.startsWith('MAIN')).length,
      transitions: route.transitions.length, screenshots: route.screenshots.length,
      fixedHistoricalEvent: route.fixedHistoricalEvent?.fixedOutcome ?? null, pageErrors: route.pageErrors.length })) }, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', routes: routes.map(route => ({ routeName: route.routeName,
    stories: route.stories, questCount: route.quests.filter(row => row.storyId?.startsWith('MAIN')).length,
    transitions: route.transitions.length, pageErrors: route.pageErrors.length })),
    report: main01Only ? outputDir : path.join(outputDir, 'V47_BROWSER_CAMPAIGN_INDEX.json') }, null, 2));
} finally { await browser.close(); }
