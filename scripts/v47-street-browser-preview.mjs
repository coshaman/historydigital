import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';
import { mimeTypeFor } from '../server-mime.mjs';
import { decorateCardsWithEraProfiles } from '../rpg/engine/era-profiles.mjs';
import { v47RoleProfiles } from '../rpg/data/v47-character-roles.mjs';
import { attachV47StoryObjects, v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';

const root = process.cwd();
const previewPort = Number(process.env.V47_PREVIEW_PORT ?? 4174);
const previewStory = process.env.V47_PREVIEW_STORY ?? 'MAIN01';
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const [mapFiles, cardFiles, registry, campaign] = await Promise.all([
  readdir(path.join(root, 'rpg/maps')), readdir(path.join(root, 'rpg/characters')),
  readJson('data/era_character_registry.json'), readJson('rpg/quests/campaign.json'),
]);
const maps = Object.fromEntries(await Promise.all(mapFiles.filter(file => file.endsWith('.json')).map(async file => {
  const map = await readJson(`rpg/maps/${file}`); return [map.mapId, map];
})));
const cards = await Promise.all(cardFiles.filter(file => file.endsWith('.json')).map(file => readJson(`rpg/characters/${file}`)));
const hostCards = decorateCardsWithEraProfiles(cards, { ...registry,
  runtime_profiles: { ...registry.runtime_profiles, ...v47RoleProfiles } });
const storyBeatQuests = toV47StoryQuests();
attachV47StoryObjects(maps); attachV47StoryBeatObjects(maps, storyBeatQuests);
const quests = [...v47StoryQuests, ...storyBeatQuests];
const state = game.createInitialState({ maps, hostCards, quests, startMapId: 'nevsky' });
const start = hostCards.find(card => card.id === 'courier_pavel')?.start ?? { mapId: 'nevsky', x: 10, y: 16 };
const previewMapId = process.env.V47_PREVIEW_MAP ?? 'nevsky';
assert.ok(maps[previewMapId], `preview map ${previewMapId} exists`);
state.world.chapterId = campaign.arcs.find(arc => arc.id === 'V33_1848_PUBLIC').id;
state.world.date = process.env.V47_PREVIEW_DATE ?? '1848-05-06'; state.world.clockMinutes = 600; state.world.currentMapId = previewMapId;
state.world.v47.focusStoryId = previewStory; state.player.embodiment = 'courier_pavel';
const previewPosition = process.env.V47_PREVIEW_PLAYER_X && process.env.V47_PREVIEW_PLAYER_Y
  ? { x: Number(process.env.V47_PREVIEW_PLAYER_X), y: Number(process.env.V47_PREVIEW_PLAYER_Y) }
  : previewMapId === 'printshop' ? { x: 11, y: 14 } : { x: start.x, y: start.y };
state.player.position = previewPosition;
state.hosts.courier_pavel.mapId = previewMapId; state.hosts.courier_pavel.position = { ...state.player.position };
state.hosts.courier_pavel.historicalAliveAndPresent = true;
const saved = game.saveGame(state);
const staticRoot = path.resolve(root, 'dist-v33');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
try {
  const width = Number(process.env.V47_PREVIEW_WIDTH ?? 1440);
  const height = Number(process.env.V47_PREVIEW_HEIGHT ?? 900);
  const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
  const errors = [], failedResponses = []; page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
  await page.route(`http://127.0.0.1:${previewPort}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, body: 'API disabled in static preview.' });
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.resolve(staticRoot, relative);
    if (!target.startsWith(`${staticRoot}${path.sep}`) && target !== staticRoot) return route.fulfill({ status: 403 });
    try { return route.fulfill({ status: 200, body: await readFile(target), headers: { 'content-type': mimeTypeFor(target) } }); }
    catch { return route.fulfill({ status: 404 }); }
  });
  await page.addInitScript(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value);
    localStorage.setItem('v34-tutorial-stage', 'done'); }, saved);
  await page.goto(`http://127.0.0.1:${previewPort}/#v47-${previewStory.toLowerCase()}-street-preview`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
  await page.waitForTimeout(500);
  const rendered = await page.locator('#world').evaluate(canvas => ({ width: canvas.width, height: canvas.height,
    label: document.querySelector('#mapname')?.textContent, date: document.querySelector('#calendar-date')?.textContent,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    mission: (() => {
      const tracker = document.querySelector('#mission-tracker'), action = document.querySelector('#mission-action');
      const method = document.querySelector('#mission-method'), controls = document.querySelector('.mission-controls');
      if (!tracker || tracker.hidden || !action || !controls || controls.offsetParent === null) return null;
      const actionRect = action.getBoundingClientRect(), methodRect = method.getBoundingClientRect(), controlsRect = controls.getBoundingClientRect();
      return { actionVisible: actionRect.height > 0 && actionRect.top >= 0 && actionRect.bottom <= innerHeight,
        methodVisible: methodRect.height > 0 && methodRect.top >= 0 && methodRect.bottom <= innerHeight,
        controlsOverlap: controlsRect.top < methodRect.bottom - 1,
        actionBottom: actionRect.bottom, methodBottom: methodRect.bottom, controlsTop: controlsRect.top };
    })() }));
  assert.ok(rendered.width && rendered.height, 'map canvas is drawn');
  assert.equal(rendered.label, maps[previewMapId].metadata?.displayNameKo,
    'the selected map name matches its checked-in map metadata');
  assert.equal(rendered.overflow, false, 'desktop map view has no horizontal overflow');
  if (width < 600 && rendered.mission) {
    assert.equal(rendered.mission.actionVisible, true, 'the mobile quest instruction stays visible above its controls');
    assert.equal(rendered.mission.controlsOverlap, false, `mobile mission controls do not cover the instruction: ${JSON.stringify(rendered.mission)}`);
  }
  assert.deepEqual(errors, [], 'street map renders without browser errors');
  assert.deepEqual(failedResponses, [], 'all local visual assets and map resources load without HTTP errors');
  const output = path.join(root, `artifacts/v47/${previewStory}_STREET_VISUAL_REVIEW`);
  await mkdir(output, { recursive: true });
  const dateTag = String(process.env.V47_PREVIEW_DATE ?? '1848-05-06').replaceAll('-', '');
  const screenshotName = `${previewMapId}-scene-${dateTag}-${width}x${height}.png`;
  await page.screenshot({ path: path.join(output, screenshotName) });
  console.log(JSON.stringify({ status: 'PASS', rendered, pageErrors: errors, failedResponses,
    screenshot: `artifacts/v47/${previewStory}_STREET_VISUAL_REVIEW/${screenshotName}` }, null, 2));
} finally { await browser.close(); }
