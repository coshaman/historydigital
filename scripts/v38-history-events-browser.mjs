import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const play = require('../rpg/data/historical-scene-play.json').events;
const catalog = require('../rpg/data/v38-historical-events.json').events;
const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4173/';
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

async function speakTwo(page, scene, zoneIndex, spokenNames) {
  const zoneActors = scene.actors.map((actor, index) => ({ actor, index }))
    .filter(({ index }) => index % 3 === zoneIndex);
  const { positions } = actorPositions(scene, zoneIndex);
  const usedBodies = spokenNames;
  let attempts = 0;
  const targetCount = Math.min(7, Math.max(spokenNames.size + 1, (zoneIndex + 1) * 2 + (zoneIndex === 2 ? 1 : 0)));
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

      for (let zoneIndex = 0; zoneIndex < scene.maps.length; zoneIndex++) {
        const zones = actorPositions(scene, zoneIndex);
        await speakTwo(page, scene, zoneIndex, spokenNames);
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
          const startPosition = spokenNames.currentPosition ?? (zoneIndex === 0 ? scene.entryPosition : zones.map.metadata.observerStart);
          const movement = pathToExit(zones.map, startPosition, exit);
          await walk(page, movement);
          await page.locator('#use').click();
          const exitChoice = page.locator('#actions button').filter({ hasText: `문을 지나 ${scene.zoneTitlesKo[zoneIndex + 1]}` });
          if (await exitChoice.count()) await exitChoice.click();
          await page.waitForTimeout(300);
          assert.equal(await page.locator('#mapname').textContent(), scene.zoneTitlesKo[zoneIndex + 1],
            `physical exit failed ${scene.maps[zoneIndex]} → ${scene.maps[zoneIndex + 1]}: ${await page.locator('#journal-text').textContent()}`);
          const arrivalX = Math.floor(zones.map.width / 2) - 3;
          spokenNames.currentPosition = { x: arrivalX, y: zones.map.metadata.observerStart.y };
        }
      }
      const closing = page.locator('#actions button').filter({ hasText: scene.choices[0].label });
      await closing.waitFor({ timeout: 5000 }); await closing.click();
      assert.match(await page.locator('#journal-text').textContent(), new RegExp(event.sourceLabelKo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('v38-historical-event-records') || '{}'));
      assert.ok(saved[event.id]?.completedAt, `${event.id} records its scene choices`);
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
