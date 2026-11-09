import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { historicalConversationChoices as getHistoricalConversationChoices } from '../rpg/data/historical-conversation-choices.mjs';
import { buildHistoricalSceneLayout } from '../rpg/engine/historical-scene-layout.mjs';

const require = createRequire(import.meta.url);
const play = require('../rpg/data/historical-scene-play.json').events;
const catalog = require('../rpg/data/v38-historical-events.json').events;
const conversationChoices = require('../rpg/data/historical-conversation-choices.json');
const previewPort = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(error => error ? reject(error) : resolve(port));
  });
});
const base = process.env.V33_RPG_URL || `http://127.0.0.1:${previewPort}/`;
const evidenceDir = path.resolve('artifacts/v38/HISTORICAL_LIVING_SCENES');
fs.mkdirSync(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const preview = process.env.V33_RPG_URL ? null : spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(previewPort), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: path.resolve('dist-v33') }, stdio: ['ignore', 'pipe', 'pipe'] });
let previewOutput = '';
preview?.stdout.on('data', chunk => { previewOutput = `${previewOutput}${chunk}`.slice(-2000); });
preview?.stderr.on('data', chunk => { previewOutput = `${previewOutput}${chunk}`.slice(-2000); });
const evidence = [];

function actorPositions(scene, zoneIndex) {
  const authored = structuredClone(scene), sourceMaps = Object.fromEntries(scene.backgrounds.map(id => [id, require(`../rpg/maps/${id}.json`)]));
  const generated = buildHistoricalSceneLayout(authored, catalog.find(event => event.id === scene.eventId), sourceMaps);
  const actors = authored.actors.filter(actor => actor.mapId === scene.maps[zoneIndex]);
  return { map: generated.maps[scene.maps[zoneIndex]], positions: actors.map(actor => actor.position) };
}

function actionPositions(scene, zoneIndex) {
  const authored = structuredClone(scene), sourceMaps = Object.fromEntries(scene.backgrounds.map(id => [id, require(`../rpg/maps/${id}.json`)]));
  const generated = buildHistoricalSceneLayout(authored, catalog.find(event => event.id === scene.eventId), sourceMaps);
  const actions = authored.fieldActions.filter(action => action.mapId === scene.maps[zoneIndex]);
  return { map: generated.maps[scene.maps[zoneIndex]], positions: actions.map(action => action.position), actions };
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
  if (action.requiredActorId) {
    const actor = scene.actors.find(item => item.id === action.requiredActorId);
    assert.ok(actor, `${action.id} names an on-scene person to embody`);
    if (!(await page.locator('#bodyname').textContent()).includes(actor.nameKo)) {
      await page.locator('#roster-open').click();
      const rosterCards = page.locator('.roster-card');
      const roleCardIndex = await rosterCards.evaluateAll((cards, name) => cards.findIndex(card =>
        card.querySelector('.roster-card-copy > strong')?.textContent?.trim() === name), actor.nameKo);
      const roleCard = roleCardIndex >= 0 ? rosterCards.nth(roleCardIndex) : page.locator('.roster-card').nth(-1);
      try { await roleCard.waitFor({ state: 'attached', timeout: 5000 }); await roleCard.scrollIntoViewIfNeeded(); }
      catch (error) { throw new Error(`Required event role is not available in this zone: ${JSON.stringify({ actor: actor.nameKo, lookupError: String(error), roleCardCount: await roleCard.count(),
        map: await page.locator('#mapname').textContent(), body: await page.locator('#bodyname').textContent(),
        roster: await page.locator('.roster-card strong').allTextContents(), texts: await page.locator('.roster-card').allTextContents() })}`); }
      await roleCard.click();
    }
    assert.ok((await page.locator('#bodyname').textContent()).includes(actor.nameKo), `${actor.nameKo} is embodied before the role task`);
  }
  const startPosition = await playerPosition(page);
  await walk(page, pathToExit(map, startPosition, position));
  await page.waitForTimeout(380);
  await page.locator('#use').click();
  const effects = scene.nextEffects ??= {};
  const available = action.options.filter(option => !option.requiresEffects
    || Object.entries(option.requiresEffects).every(([key, value]) => effects[key] === value));
  const downstreamRequirement = scene.fieldActions.flatMap(later => later.options.map(option => option.requiresEffects))
    .find(requirement => requirement && Object.entries(requirement).every(([key, value]) =>
      Object.entries(effects).every(([existingKey, existingValue]) => existingKey !== key || existingValue === value)));
  const option = available.find(candidate => downstreamRequirement
    && Object.entries(downstreamRequirement).every(([key, value]) => candidate.effects?.[key] === value)) ?? available[0];
  const optionButton = page.getByRole('button', { name: new RegExp(`^${option.labelKo.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`) });
  try { await optionButton.waitFor({ timeout: 5000 }); }
  catch { throw new Error(`Historical field choice did not render: ${JSON.stringify({ eventId: scene.eventId, actionId: action.id,
    optionId: option.id, map: await page.locator('#mapname').textContent(), body: await page.locator('#bodyname').textContent(),
    headline: await page.locator('#headline').textContent(), journal: await page.locator('#journal-text').textContent(),
    actions: await page.locator('#actions button').allTextContents(), position: await playerPosition(page) })}`); }
  assert.equal(await optionButton.locator('small').count(), 0, 'event decisions show a single concise line');
  await optionButton.click();
  await page.waitForFunction(name => document.querySelector('#headline')?.textContent === name, action.propKo);
  assert.ok((await page.locator('#journal-text').textContent()).includes(option.textKo));
  if (option.sceneMoves?.length) {
    await page.locator('#save').click();
    const savedState = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save') ?? '{}').state ?? {});
    const savedMoves = savedState.historicalSession?.physicalMoves ?? [];
    for (const move of option.sceneMoves) {
      const target = scene.fieldActions.find(item => item.id === move.targetActionId);
      const targetZone = scene.maps.indexOf(target.mapId), targetArea = actionPositions(scene, targetZone);
      const targetPosition = targetArea.positions[targetArea.actions.findIndex(item => item.id === target.id)];
      const actorMove = savedMoves.find(item => item.actorId === move.actorId && item.choiceId === option.id);
      assert.ok(actorMove, `${action.id}/${option.id} saves its physical resident movement`);
      assert.equal(actorMove.fromMapId, action.mapId, `${action.id}/${option.id} records its actual departure map`);
      assert.equal(actorMove.targetMapId, target.mapId, `${action.id}/${option.id} records the destination map`);
      assert.deepEqual(actorMove.targetPosition, targetPosition, `${action.id}/${option.id} records the destination tile`);
      assert.equal(actorMove.status, 'EN_ROUTE', `${action.id}/${option.id} starts a visible journey instead of teleporting`);
      const resident = savedState.hosts?.[`historical:${scene.eventId}:${move.actorId}`];
      assert.ok(resident, `${action.id}/${option.id} persists the moving resident`);
      assert.equal(resident.mapId, actorMove.fromMapId, `${action.id}/${option.id} leaves the resident at the departure map`);
      assert.ok(Math.abs(resident.position.x - actorMove.fromPosition.x) + Math.abs(resident.position.y - actorMove.fromPosition.y) <= 2,
        `${action.id}/${option.id} lets the resident move naturally from the departure tile`);
      assert.equal(resident.schedule?.[0]?.mapId, actorMove.targetMapId, `${action.id}/${option.id} schedules travel to the destination`);
      scene.observedPhysicalMoves ??= [];
      scene.observedPhysicalMoves.push({ actorId: move.actorId, targetMapId: actorMove.targetMapId,
        choiceId: option.id, status: actorMove.status });
    }
  }
  Object.assign(effects, option.effects ?? {});
  const actual = await playerPosition(page);
  assert.ok(Math.abs(actual.x - position.x) + Math.abs(actual.y - position.y) <= 2,
    `${action.id} was completed beside its physical object: ${JSON.stringify({ actual, position })}`);
  return actual;
}

async function speakTwo(page, scene, zoneIndex, spokenNames) {
  const zoneActors = scene.actors.map((actor, index) => ({ actor, index }))
    .filter(({ index }) => index % 3 === zoneIndex);
  const { positions } = actorPositions(scene, zoneIndex);
  const usedBodies = spokenNames.usedBodies ??= new Set();
  let attempts = 0;
  const targetCount = Math.min(12, Math.max(spokenNames.size + 1, (zoneIndex + 1) * 4));
  while (spokenNames.size < targetCount && attempts++ < 24) {
    await page.locator('#roster-open').click();
    const cards = page.locator('.roster-card');
    await cards.first().waitFor();
    const rosterGuide = await cards.first().innerText();
    assert.match(rosterGuide, /목표/);
    assert.match(rosterGuide, /말 걸 사람/);
    assert.match(rosterGuide, /할 일|완료/);
    let found = false;
    for (let index = 0; index < await cards.count(); index++) {
      const card = cards.nth(index), bodyName = await card.locator('strong').textContent();
      if (usedBodies.has(bodyName)) continue;
      const candidate = zoneActors.find(row => row.actor.nameKo === bodyName);
      if (!candidate) continue;
      await card.click();
      spokenNames.currentPosition = positions[Math.floor(candidate.index / 3)];
      await page.locator('#save').click();
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save') ?? '{}').state ?? {});
      const speakerId = `historical:${scene.eventId}:${candidate.actor.id}`;
      const speaker = state.hosts?.[speakerId];
      const partnerTarget = scene.actors.map(actor => ({ actor, host: state.hosts?.[`historical:${scene.eventId}:${actor.id}`] }))
        .filter(row => row.host && row.actor.id !== candidate.actor.id && row.host.mapId === speaker?.mapId
          && !spokenNames.has(row.actor.nameKo))
        .sort((a, b) => Math.abs(a.host.position.x - speaker.position.x) + Math.abs(a.host.position.y - speaker.position.y)
          - Math.abs(b.host.position.x - speaker.position.x) - Math.abs(b.host.position.y - speaker.position.y))[0];
      if (speaker && partnerTarget) {
        const current = await playerPosition(page), map = require(`../rpg/maps/${scene.backgrounds[zoneIndex]}.json`);
        await walk(page, pathToExit(map, current, partnerTarget.host.position));
      }
      await page.waitForTimeout(380);
      const talk = page.locator('#talk'), enabled = !await talk.isDisabled();
      if (!enabled) continue;
      const partner = (await talk.innerText()).replace(/^말 걸기 ·\s*/, '').trim();
      await talk.click();
      assert.equal(await page.locator('#headline').textContent(), partner);
      const dialogueText = await page.locator('#journal-text').textContent();
      assert.ok(dialogueText.length > 35);
      const nearbyParticipants = scene.actors.filter(actor => dialogueText.includes(actor.nameKo)).length;
      assert.ok(nearbyParticipants >= 4, `${scene.eventId} has a five-person nearby conversation, found ${nearbyParticipants}`);
      const interlocutor = scene.actors.find(actor => actor.nameKo === partner);
      assert.ok(interlocutor, `${partner} is an actor in the current historical scene`);
      const branch = getHistoricalConversationChoices(conversationChoices, scene.eventId, interlocutor.objectiveId)[0];
      const branchButton = page.locator('#actions button').filter({ hasText: branch.labelKo });
      try { await branchButton.waitFor({ timeout: 5000 }); }
      catch { throw new Error(`Event dialogue branch missing for ${scene.eventId}/${candidate.actor.objectiveId}: ${JSON.stringify(await page.evaluate(() => ({
        headline: document.querySelector('#headline')?.textContent, journal: document.querySelector('#journal-text')?.textContent,
        actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        body: document.querySelector('#bodyname')?.textContent,
      })))}`); }
      assert.equal(await branchButton.locator('small').count(), 0, 'conversation decisions have no small-print subcopy');
      await branchButton.click();
      assert.ok((await page.locator('#journal-text').textContent()).includes(branch.reactionKo));
      usedBodies.add(bodyName);
      spokenNames.add(partner); spokenNames.currentBody = bodyName; found = true;
      break;
    }
    if (!found && zoneActors.every(({ actor }) => usedBodies.has(actor.nameKo))) break;
  }
  assert.ok(spokenNames.size >= targetCount, `${scene.eventId} walk-up conversations stalled: ${JSON.stringify({ zone: zoneIndex,
    targetCount, spoken: spokenNames.size, used: [...usedBodies], actors: zoneActors.map(({ actor }) => actor.nameKo),
    roster: await page.locator('.roster-card strong').allTextContents() })}`);
  assert.ok(spokenNames.size >= zoneIndex + 1, `${scene.eventId} must permit a conversation in area ${zoneIndex + 1}`);
}

try {
  if (preview) {
    const deadline = Date.now() + 10000;
    let ready = false;
    while (Date.now() < deadline && !ready) {
      ready = previewOutput.includes('Chancery of Ink at');
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error(`V38 production preview did not start: ${previewOutput || 'no server output'}`);
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#roster-open')?.disabled);
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(layout.scrollWidth <= layout.width, `horizontal overflow at ${viewport.width}px`);
    await page.locator('#save').click();
    const campaignSnapshot = await page.evaluate(() => localStorage.getItem('v33-rpg-save'));
    let totalConversations = 0;
    for (const event of catalog) {
      const spokenNames = new Set();
      const scene = play.find(item => item.eventId === event.id);
      await page.locator('#history-events-open').click();
      await page.locator('#actions button').filter({ hasText: event.titleKo }).click();
      assert.equal(await page.locator('#mapname').textContent(), scene.zoneTitlesKo[0]);

      const finishedObjectives = new Set();
      scene.nextEffects = {};
      scene.observedPhysicalMoves = [];
      for (let zoneIndex = 0; zoneIndex < scene.maps.length; zoneIndex++) {
        const zones = actorPositions(scene, zoneIndex);
        await speakTwo(page, scene, zoneIndex, spokenNames);
        const zoneActions = [...scene.fieldActions.filter(item => item.mapId === scene.maps[zoneIndex] && item.requiredActorId),
          ...scene.fieldActions.filter(item => item.mapId === scene.maps[zoneIndex] && !item.requiredActorId)];
        const requiredHere = zoneActions.filter(item => item.requiredActorId && !finishedObjectives.has(item.objectiveId));
        const extraHere = zoneActions.filter(item => !item.requiredActorId && !finishedObjectives.has(item.objectiveId));
        for (const action of [...requiredHere, ...extraHere.slice(0, Math.max(0, 7 - finishedObjectives.size - requiredHere.length))]) {
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
          const exit = { x: zones.map.width - 3, y: zones.map.height - 3 };
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
      if (scene.eventId === 'SENATE_SQUARE_1825') assert.deepEqual(scene.observedPhysicalMoves, [
        { actorId: 'coachman', targetMapId: 'senate-river', choiceId: 'turn-cart', status: 'EN_ROUTE' },
      ], 'the evacuation-route choice moves the coachman across the field scene and persists that movement');
      if (scene.eventId === 'GOGOL_INSPECTOR_1836') assert.deepEqual(scene.observedPhysicalMoves, [
        { actorId: 'actor', targetMapId: 'theatre-street', choiceId: 'company-decides', status: 'EN_ROUTE' },
      ], 'the shared backstage decision sends the actor into the public street discussion without interrupting unfinished lobby work');
      if (scene.eventId === 'EMANCIPATION_1861') assert.deepEqual(scene.observedPhysicalMoves, [
        { actorId: 'porter', targetMapId: 'manifesto-lane', choiceId: 'collective-terms', status: 'EN_ROUTE' },
      ], 'the collective wage decision sends the petition bundle into the neighborhood meeting');
      const finalChoice = scene.choices[catalog.indexOf(event) % scene.choices.length];
      const visibleChoiceCounts = await Promise.all(scene.choices.map(choice => page.locator('#actions button').filter({ hasText: choice.label }).count()));
      assert.deepEqual(visibleChoiceCounts, scene.choices.map(() => 1), `${event.id} exposes every closing strategy exactly once: ${JSON.stringify(await page.evaluate(() => ({
        map: document.querySelector('#mapname')?.textContent, headline: document.querySelector('#headline')?.textContent,
        journal: document.querySelector('#journal-text')?.textContent, actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        mission: document.querySelector('#mission-reason')?.textContent,
      })))}`);
      const closing = page.locator('#actions button').filter({ hasText: finalChoice.label });
      try { await closing.waitFor({ timeout: 5000 }); }
      catch { throw new Error(`Closing choice did not unlock: ${JSON.stringify(await page.evaluate(() => ({
        map: document.querySelector('#mapname')?.textContent, headline: document.querySelector('#headline')?.textContent,
        journal: document.querySelector('#journal-text')?.textContent, actions: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        tracker: document.querySelector('#mission-reason')?.textContent,
      })))}`); }
      await closing.scrollIntoViewIfNeeded();
      assert.equal(await closing.locator('small').count(), 0, 'the event’s central choice is a single concise line');
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
      const roleActionCount = scene.fieldActions.filter(action => action.requiredActorId).length;
      assert.ok(Object.keys(saved[event.id]?.actionOutcomes ?? {}).length >= roleActionCount + 1,
        `${event.id} records all body-specific actions and at least one additional field choice`);
      assert.ok(saved[event.id]?.completedObjectives?.length >= 7, `${event.id} closes only after several subquests`);
      const performedRoles = saved[event.id]?.choices?.filter(choice => choice.performedByActorId) ?? [];
      assert.equal(performedRoles.length, roleActionCount, `${event.id} requires each authored on-scene role mission`);
      assert.equal(new Set(performedRoles.map(choice => choice.performedByActorId)).size, roleActionCount,
        `${event.id} requires switching into every assigned role`);
      assert.equal(await page.locator('#mapname').textContent(), '네프스키 거리', 'campaign map is restored after the event');
      await page.locator('#save').click();
      assert.equal(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), campaignSnapshot, 'campaign save stays untouched');
      totalConversations += spokenNames.size;
    }
    if (viewport.width === 1440) {
      const repeatEvent = catalog[0], repeatScene = play.find(item => item.eventId === repeatEvent.id);
      await page.locator('#history-events-open').click();
      await page.locator('#actions button').filter({ hasText: repeatEvent.titleKo }).click();
      await page.locator('#roster-open').click();
      const repeatRoster = await page.locator('.roster-card strong').allTextContents();
      const entryActorCount = repeatScene.actors.filter((actor, index) => index % repeatScene.maps.length === 0).length;
      assert.equal(repeatRoster.length, entryActorCount, 'replaying an event shows its residents in the current area without duplicating them');
      assert.equal(new Set(repeatRoster).size, repeatRoster.length, 'each event resident appears once after replay');
      await page.locator('#actions button').filter({ hasText: '현장을 나간다' }).click();
      assert.equal(await page.locator('#mapname').textContent(), '네프스키 거리', 'leaving a replay returns to the campaign');
    }
    assert.deepEqual(errors, [], `browser errors at ${viewport.width}px`);
    evidence.push({ viewport, eventScenesEntered: 3, uniqueConversations: totalConversations, campaignSaveRestored: true, errors });
    await context.close();
  }
  console.log(JSON.stringify({ status: 'PASS', evidence }, null, 2));
} finally { await browser.close(); preview?.kill(); }
