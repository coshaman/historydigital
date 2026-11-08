import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const play = require('../rpg/data/historical-scene-play.json').events;
const catalog = require('../rpg/data/v38-historical-events.json').events;
const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4173/';
const evidenceDir = path.resolve('artifacts/v38/HISTORICAL_LIVING_SCENES');
fs.mkdirSync(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const evidence = [];

function actorPositions(scene, zoneIndex) {
  const map = require(`../rpg/maps/${scene.backgrounds[zoneIndex]}.json`), collision = map.layers.find(layer => layer.name === 'Collision').data;
  const origin = zoneIndex === 0 ? scene.entryPosition : map.metadata.observerStart;
  const candidates = Array.from({ length: map.width * map.height }, (_, index) => ({ x: index % map.width, y: Math.floor(index / map.width) }))
    .filter(point => collision[point.y * map.width + point.x] === 0 && (point.x !== origin.x || point.y !== origin.y))
    .sort((a, b) => Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y) - Math.abs(b.x - origin.x) - Math.abs(b.y - origin.y));
  const result = [];
  for (const point of candidates) { if (result.every(other => Math.abs(point.x - other.x) + Math.abs(point.y - other.y) >= 2)) result.push(point); if (result.length === 7) break; }
  return { map, positions: result };
}

function actionPositions(scene, zoneIndex) {
  const map = require(`../rpg/maps/${scene.backgrounds[zoneIndex]}.json`), collision = map.layers.find(layer => layer.name === 'Collision').data;
  const origin = zoneIndex === 0 ? scene.entryPosition : map.metadata.observerStart;
  const actions = scene.fieldActions.filter(action => action.mapId === scene.maps[zoneIndex]);
  const candidates = Array.from({ length: map.width * map.height }, (_, index) => ({ x: index % map.width, y: Math.floor(index / map.width) }))
    .filter(point => collision[point.y * map.width + point.x] === 0 && (point.x !== origin.x || point.y !== origin.y))
    .sort((a, b) => Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y) - Math.abs(b.x - origin.x) - Math.abs(b.y - origin.y));
  const result = [];
  for (const point of candidates) { if (result.every(other => Math.abs(point.x - other.x) + Math.abs(point.y - other.y) >= 4)) result.push(point); if (result.length === actions.length + 1) break; }
  return { map, positions: result.slice(0, actions.length), actions };
}

function pathToExit(map, start, target) {
  const collision = map.layers.find(layer => layer.name === 'Collision').data;
  const queue = [[start, '']], seen = new Set([`${start.x},${start.y}`]);
  while (queue.length) {
    const [point, path] = queue.shift();
    if (Math.abs(point.x - target.x) + Math.abs(point.y - target.y) <= 1) return path;
    for (const [dx, dy, direction] of [[1, 0, 'R'], [-1, 0, 'L'], [0, 1, 'D'], [0, -1, 'U']]) {
      const x = point.x + dx, y = point.y + dy, key = `${x},${y}`;
      if (x >= 0 && y >= 0 && x < map.width && y < map.height && collision[y * map.width + x] === 0 && !seen.has(key)) {
        seen.add(key); queue.push([{ x, y }, path + direction]);
      }
    }
  }
  throw new Error(`No route to event area's exit ${target.x},${target.y}`);
}

async function walk(page, path) {
  for (const direction of path) await page.keyboard.press(({ R: 'ArrowRight', L: 'ArrowLeft', D: 'ArrowDown', U: 'ArrowUp' })[direction]);
}
async function playerPosition(page) {
  return page.evaluate(() => ({ x: Number(document.body.dataset.playerX), y: Number(document.body.dataset.playerY) }));
}

async function completeFieldAction(page, scene, zoneIndex) {
  const { map, positions, actions } = actionPositions(scene, zoneIndex);
  const action = actions.find(item => item.objectiveId === scene.nextObjectiveId), position = positions[actions.indexOf(action)];
  assert.ok(action && position, `${scene.eventId} has a walkable physical action in area ${zoneIndex + 1}`);
  const startPosition = await playerPosition(page);
  await walk(page, pathToExit(map, startPosition, position));
  await page.waitForTimeout(380);
  await page.locator('#use').click();
  const optionButton = page.getByRole('button', { name: new RegExp(`^${action.options[0].labelKo.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`) });
  await optionButton.waitFor({ timeout: 5000 });
  await optionButton.click();
  await page.waitForFunction(name => document.querySelector('#headline')?.textContent === name, action.propKo);
  assert.ok((await page.locator('#journal-text').textContent()).includes(action.options[0].textKo));
  const actual = await playerPosition(page);
  assert.ok(Math.abs(actual.x - position.x) + Math.abs(actual.y - position.y) <= 2,
    `${action.id} was completed beside its physical object: ${JSON.stringify({ actual, position })}`);
  return actual;
}

async function speakTwo(page, scene, zoneIndex, spokenNames) {
  const zoneActors = scene.actors.map((actor, index) => ({ actor, index }))
    .filter(({ index }) => index % 3 === zoneIndex);
  const { positions } = actorPositions(scene, zoneIndex);
  const usedBodies = spokenNames;
  let attempts = 0;
  const targetCount = Math.min(8, Math.max(spokenNames.size + 1, (zoneIndex + 1) * 3 - (zoneIndex === 2 ? 1 : 0)));
  while (spokenNames.size < targetCount && attempts++ < 24) {
    await page.locator('#roster-open').click();
    const cards = page.locator('.roster-card');
    await cards.first().waitFor();
    let found = false;
    for (let index = 0; index < await cards.count(); index++) {
      const card = cards.nth(index), bodyName = await card.locator('strong').textContent();
      if (usedBodies.has(bodyName)) continue;
      const candidate = zoneActors.find(row => row.actor.nameKo === bodyName);
      if (!candidate) continue;
      await card.click(); usedBodies.add(bodyName);
      spokenNames.currentPosition = positions[Math.floor(candidate.index / 3)];
      const talk = page.locator('#talk'), enabled = !await talk.isDisabled();
      if (!enabled) continue;
      const partner = (await talk.innerText()).replace(/^말 걸기 ·\s*/, '').trim();
      await talk.click();
      assert.equal(await page.locator('#headline').textContent(), partner);
      assert.ok((await page.locator('#journal-text').textContent()).length > 35);
      await page.locator('#actions button').filter({ hasText: '같이 해결할 방법을 찾는다' }).click();
      spokenNames.add(bodyName); spokenNames.currentBody = bodyName; found = true;
      break;
    }
    if (!found && usedBodies.size >= zoneActors.length) break;
  }
  assert.ok(spokenNames.size >= zoneIndex + 1, `${scene.eventId} must permit a conversation in area ${zoneIndex + 1}`);
}

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#roster-open')?.disabled);
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(layout.scrollWidth <= layout.width, `horizontal overflow at ${viewport.width}px`);
    const campaignSnapshot = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    let totalConversations = 0;
    for (const event of catalog) {
      const spokenNames = new Set();
      const scene = play.find(item => item.eventId === event.id);
      await page.locator('#history-events-open').click();
      await page.locator('#actions button').filter({ hasText: event.titleKo }).click();
      assert.equal(await page.locator('#mapname').textContent(), scene.zoneTitlesKo[0]);

      const finishedObjectives = new Set();
      for (let zoneIndex = 0; zoneIndex < scene.maps.length; zoneIndex++) {
        const zones = actorPositions(scene, zoneIndex);
        await speakTwo(page, scene, zoneIndex, spokenNames);
        for (const action of scene.fieldActions.filter(item => item.mapId === scene.maps[zoneIndex]
          && !finishedObjectives.has(item.objectiveId)).slice(0, Math.max(0, 5 - finishedObjectives.size))) {
          scene.nextObjectiveId = action.objectiveId;
          spokenNames.currentPosition = await completeFieldAction(page, scene, zoneIndex);
          finishedObjectives.add(action.objectiveId);
        }
        if (zoneIndex === 0) await page.screenshot({ path: path.join(evidenceDir,
          `${event.id.toLowerCase()}-first-field-action-${viewport.width}x${viewport.height}.png`) });
        if (viewport.width < 761 && zoneIndex === 0) {
          const touch = await page.locator('.touch-pad').evaluate(element => {
            const rect = element.getBoundingClientRect();
            return { display: getComputedStyle(element).display, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
          });
          assert.equal(touch.display, 'grid', 'mobile movement pad stays visible during historical dialogue');
          assert.ok(touch.left >= 0 && touch.right <= viewport.width && touch.top >= 0 && touch.bottom <= viewport.height,
            `mobile touch controls remain inside viewport: ${JSON.stringify(touch)}`);
        }
        if (zoneIndex < scene.maps.length - 1) {
          const exit = { x: Math.floor(zones.map.width / 2) + 3, y: zones.map.height - 3 };
          const startPosition = await playerPosition(page);
          const movement = pathToExit(zones.map, startPosition, exit);
          await walk(page, movement);
          await page.waitForTimeout(380);
          await page.locator('#use').click();
          const exitChoice = page.locator('#actions button').filter({ hasText: `문을 지나 ${scene.zoneTitlesKo[zoneIndex + 1]}` });
          if (await exitChoice.count()) await exitChoice.click();
          await page.waitForTimeout(300);
          assert.equal(await page.locator('#mapname').textContent(), scene.zoneTitlesKo[zoneIndex + 1],
            `physical exit failed ${scene.maps[zoneIndex]} → ${scene.maps[zoneIndex + 1]}: ${await page.locator('#journal-text').textContent()}`);
          spokenNames.currentPosition = await playerPosition(page);
        }
      }
      const finalChoice = scene.choices[catalog.indexOf(event) % scene.choices.length];
      const visibleChoiceCounts = await Promise.all(scene.choices.map(choice => page.locator('#actions button').filter({ hasText: choice.label }).count()));
      assert.deepEqual(visibleChoiceCounts, scene.choices.map(() => 1), `${event.id} exposes every closing strategy exactly once`);
      const closing = page.locator('#actions button').filter({ hasText: finalChoice.label });
      try { await closing.waitFor({ timeout: 5000 }); }
      catch { throw new Error(`Closing choice did not unlock: ${JSON.stringify(await page.evaluate(() => ({
        map: document.querySelector('#mapname')?.textContent, headline: document.querySelector('#headline')?.textContent,
        journal: document.querySelector('#journal-text')?.textContent, actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        tracker: document.querySelector('#mission-reason')?.textContent,
      })))}`); }
      await closing.scrollIntoViewIfNeeded();
      const closingBounds = await closing.boundingBox();
      assert.ok(closingBounds && closingBounds.y >= 0 && closingBounds.y < viewport.height,
        `closing choices must be reachable on screen at ${viewport.width}px`);
      await page.screenshot({ path: path.join(evidenceDir, `${event.id.toLowerCase()}-closing-choices-${viewport.width}x${viewport.height}.png`) });
      await closing.click();
      assert.match(await page.locator('#journal-text').textContent(), new RegExp(event.sourceLabelKo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('v38-historical-event-records') || '{}'));
      assert.ok(saved[event.id]?.completedAt, `${event.id} records its scene choices`);
      assert.ok(saved[event.id]?.choices?.some(choice => choice.id === finalChoice.id),
        `${event.id} persists the selected closing strategy ${finalChoice.id}`);
      assert.equal(Object.keys(saved[event.id]?.actionOutcomes ?? {}).length, 5, `${event.id} records five physical tasks`);
      assert.ok(saved[event.id]?.completedObjectives?.length >= 5, `${event.id} closes only after varied scene work`);
      assert.equal(await page.locator('#mapname').textContent(), '네프스키 거리', 'campaign map is restored after the event');
      assert.equal(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), campaignSnapshot, 'campaign save stays untouched');
      totalConversations += spokenNames.size;
    }
    assert.deepEqual(errors, [], `browser errors at ${viewport.width}px`);
    evidence.push({ viewport, eventScenesEntered: 3, uniqueConversations: totalConversations, campaignSaveRestored: true, errors });
    await context.close();
  }
  console.log(JSON.stringify({ status: 'PASS', evidence }, null, 2));
} finally { await browser.close(); }
