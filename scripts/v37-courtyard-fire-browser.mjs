import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const maps = Object.fromEntries(fs.readdirSync('rpg/maps').filter(file => file.endsWith('.json'))
  .map(file => { const map = read(path.join('rpg/maps', file)); return [map.mapId, map]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => read(path.join('rpg/characters', file)));
const quests = ['courtyard-fire-1847', 'cold-wave-firewood-1847']
  .map(id => read(path.join('rpg/quests', `${id}.json`)));
const quest = quests[0], output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4197;
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: path.resolve('dist-v33') }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
try {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage(), pageErrors = [];
      page.on('pageerror', error => pageErrors.push(String(error)));
      const state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'courtyard' });
      state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-01-04'; state.world.clockMinutes = 1110;
      const tenant = state.hosts.tenant_mikhail;
      tenant.mapId = 'courtyard'; tenant.position = { x: 15, y: 11 };
      state.player.position = { x: 15, y: 11 };
      for (const [id, position] of [['landlady_polina', { x: 16, y: 11 }], ['porter_gavrila', { x: 14, y: 11 }],
        ['junior_guard_sergey', { x: 15, y: 12 }]]) {
        state.hosts[id].mapId = 'courtyard'; state.hosts[id].position = position;
      }
      state.world.livingEventStates.E03 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E03',
        status: 'RESOLVED', stage: 'FIREWOOD_BOUGHT', resolutionActionId: 'E03_BUY_FIREWOOD', resolvedAtMinute: 1005,
        resolvedByHostId: tenant.id, weather: 'wind', actorHostIds: ['tenant_mikhail', 'landlady_polina', 'porter_gavrila'],
        tenantHostId: tenant.id, landlordHostId: 'landlady_polina', startedAtMinute: 565, resolvesAtMinute: 2005,
        trigger: 'winter_snow_or_wind', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
        validationStatus: 'DESIGN_SEED_NOT_VERIFIED', valueStatus: 'fictional_gameplay_balance' };
      state.world.livingEventStates.E27 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E27',
        status: 'ACTIVE', stage: 'FIRE_REPORTED', trigger: 'tenant_brought_firewood_to_courtyard_on_windy_winter_evening',
        startedAtMinute: 1110, deadlineMinute: 1170,
        actorHostIds: ['tenant_mikhail', 'landlady_polina', 'porter_gavrila', 'junior_guard_sergey'], witnessHostIds: [],
        tenantHostId: tenant.id, landlordHostId: 'landlady_polina', guardHostId: 'junior_guard_sergey',
        scenePosition: { x: 15, y: 11 }, sourceEventId: 'E03', sourceActionId: 'E03_BUY_FIREWOOD', propertyDamage: 0,
        valueStatus: 'fictional_gameplay_balance', occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION',
        validationStatus: 'DESIGN_SEED_NOT_VERIFIED' };
      const possessed = game.possessHost(state, tenant.id, maps.courtyard);
      if (!possessed.ok) throw new Error(`Could not possess tenant: ${possessed.reason}`);
      await context.addInitScript(saved => {
        localStorage.setItem('v33-rpg-save', saved); localStorage.setItem('v33-rpg-tutorial-stage', 'done');
      }, game.saveGame(possessed.state));
      await page.goto(`http://127.0.0.1:${port}/index.html#v37-courtyard-fire-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('미하일'));
      await page.keyboard.press('e');
      const evacuate = page.getByRole('button', { name: '방 안의 사람들을 안뜰 밖으로 이끈다' });
      await evacuate.waitFor({ state: 'visible' });
      const surface = await page.evaluate(() => ({
        choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.clientHeight, bodyHeight: document.body.scrollHeight,
      }));
      if (surface.choices.length !== 3 || surface.scrollWidth > surface.width + 1 || surface.bodyHeight > surface.height + 1)
        throw new Error(`Fire response UI overflowed or hid choices: ${JSON.stringify(surface)}`);
      await page.screenshot({ path: path.join(output, `courtyard-fire-before-choice-${viewport.width}x${viewport.height}.png`) });
      const previous = await page.locator('#record').textContent();
      await evacuate.click();
      await page.waitForFunction(prior => document.querySelector('#record')?.textContent !== prior, previous);
      const readSavedState = async () => game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests });
      let saved = await readSavedState();
      if (saved.world.livingEventStates.E27.stage !== 'EVACUATING')
        throw new Error(`Evacuation choice did not start a persistent route: ${saved.world.livingEventStates.E27.stage}`);
      const gate = maps.courtyard.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.name === '거리로 나가는 안뜰 문');
      const gateTile = { x: gate.x / 16, y: gate.y / 16 }, collision = maps.courtyard.layers.find(layer => layer.name === 'Collision').data;
      const directions = [[0, -1, 'up', 'ArrowUp'], [1, 0, 'right', 'ArrowRight'], [0, 1, 'down', 'ArrowDown'], [-1, 0, 'left', 'ArrowLeft']];
      for (let steps = 0; steps < 120 && saved.world.currentMapId !== 'nevsky'; steps += 1) {
        const exitPosition = saved.player.position;
        if (saved.world.currentMapId === 'courtyard'
          && Math.abs(exitPosition.x - gateTile.x) + Math.abs(exitPosition.y - gateTile.y) <= 1) {
          await page.keyboard.press('e');
          await page.waitForFunction(() => document.querySelector('#record')?.textContent === '직접 문을 지나 장소를 옮겼다.');
          await page.locator('#save').click();
          saved = await readSavedState();
          continue;
        }
        const open = (x, y) => x >= 0 && y >= 0 && x < maps.courtyard.width && y < maps.courtyard.height
          && collision[y * maps.courtyard.width + x] === 0
          && !Object.values(saved.hosts).some(host => host.id !== saved.player.embodiment && host.historicalAliveAndPresent !== false
            && host.mapId === 'courtyard' && host.position.x === x && host.position.y === y);
        const targets = directions.map(([dx, dy]) => ({ x: gateTile.x + dx, y: gateTile.y + dy })).filter(tile => collision[tile.y * maps.courtyard.width + tile.x] === 0);
        const start = saved.player.position, queue = [start], previousTiles = new Map([[`${start.x},${start.y}`, null]]);
        let target = null;
        for (let cursor = 0; cursor < queue.length && !target; cursor += 1) {
          const here = queue[cursor];
          if (targets.some(tile => tile.x === here.x && tile.y === here.y)) { target = here; break; }
          for (const [dx, dy, direction, key] of directions) {
            const next = { x: here.x + dx, y: here.y + dy }, id = `${next.x},${next.y}`;
            if (open(next.x, next.y) && !previousTiles.has(id)) { previousTiles.set(id, { prior: `${here.x},${here.y}`, key }); queue.push(next); }
          }
        }
        if (!target) throw new Error('The embodied tenant has no open path to the courtyard gate');
        let cursor = `${target.x},${target.y}`, nextKey = null;
        while (previousTiles.get(cursor)?.prior) { nextKey = previousTiles.get(cursor).key; cursor = previousTiles.get(cursor).prior; }
        const before = `${saved.player.position.x},${saved.player.position.y}`;
        const trial = game.moveActor(saved, nextKey.slice(5).toLowerCase(), maps.courtyard, maps);
        if (!trial.moved) throw new Error(`The browser route planner chose a blocked first step: ${JSON.stringify({ before,
          key: nextKey, reason: trial.reason, target, blockers: Object.values(saved.hosts).filter(host => host.historicalAliveAndPresent !== false
            && host.mapId === 'courtyard' && host.position.x === target.x && host.position.y === target.y).map(host => host.id) })}`);
        await page.keyboard.press(nextKey); await page.waitForTimeout(25);
        await page.locator('#save').click();
        saved = await readSavedState();
        if (`${saved.player.position.x},${saved.player.position.y}` === before) {
          throw new Error(`Keyboard input did not move the player: ${JSON.stringify({ before, key: nextKey,
            record: await page.locator('#record').textContent() })}`);
        }
      }
      if (saved.world.currentMapId !== 'nevsky') throw new Error(`Tenant did not leave the courtyard through the gate: ${JSON.stringify({ mapId: saved.world.currentMapId,
        position: saved.player.position, event: saved.world.livingEventStates.E27.stage,
        actors: saved.world.livingEventStates.E27.actorHostIds.map(id => ({ id, mapId: saved.hosts[id].mapId, position: saved.hosts[id].position })),
        record: await page.locator('#record').textContent(), body: await page.locator('#mapname').textContent() })}`);
      for (let tick = 0; tick < 40 && saved.world.livingEventStates.E27.stage !== 'RESIDENTS_EVACUATED'; tick += 1) {
        const move = directions.map(([, , , key]) => key).map(key => ({ key,
          result: game.moveActor(saved, key.slice(5).toLowerCase(), maps[saved.world.currentMapId], maps) }))
          .find(candidate => candidate.result.moved);
        if (!move) throw new Error(`No safe Nevsky street step could advance the evacuation: ${JSON.stringify(saved.player.position)}`);
        await page.keyboard.press(move.key); await page.locator('#save').click(); saved = await readSavedState();
      }
      for (let wait = 0; wait < 30 && saved.world.livingEventStates.E27.stage !== 'RESIDENTS_EVACUATED'; wait += 1) {
        saved = await readSavedState();
        if (saved.world.livingEventStates.E27.status !== 'RESOLVED') {
          await page.waitForTimeout(150);
          saved = await readSavedState();
        }
      }
      if (saved.world.livingEventStates.E27.stage !== 'RESIDENTS_EVACUATED' || pageErrors.length || serverErrors.length)
        throw new Error(`Physical evacuation did not finish cleanly: ${JSON.stringify({ stage: saved.world.livingEventStates.E27.stage,
          actors: saved.world.livingEventStates.E27.actorHostIds.map(id => ({ id, mapId: saved.hosts[id].mapId, position: saved.hosts[id].position })), pageErrors, serverErrors })}`);
      await page.screenshot({ path: path.join(output, `courtyard-fire-evacuated-final-${viewport.width}x${viewport.height}.png`) });
      results.push({ viewport, choices: surface.choices.length, stageAfterClick: 'EVACUATING',
        stageAfterWalkingToGate: saved.world.livingEventStates.E27.stage, actorsOutside: saved.world.livingEventStates.E27.actorHostIds.length,
        horizontalOverflow: surface.scrollWidth > surface.width, pageErrors: pageErrors.length });
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally { server.kill(); }
