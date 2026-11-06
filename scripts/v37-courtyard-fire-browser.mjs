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
      state.hosts.junior_guard_sergey.mapId = 'courtyard'; state.hosts.junior_guard_sergey.position = { x: 16, y: 11 };
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
      await page.screenshot({ path: path.join(output, `courtyard-fire-${viewport.width}x${viewport.height}.png`) });
      const previous = await page.locator('#record').textContent();
      await evacuate.click();
      await page.waitForFunction(prior => document.querySelector('#record')?.textContent !== prior, previous);
      const saved = game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests });
      if (saved.world.livingEventStates.E27.stage !== 'RESIDENTS_EVACUATED' || pageErrors.length || serverErrors.length)
        throw new Error(`Fire response did not save cleanly: ${JSON.stringify({ stage: saved.world.livingEventStates.E27.stage, pageErrors, serverErrors })}`);
      results.push({ viewport, choices: surface.choices.length, stageAfterClick: saved.world.livingEventStates.E27.stage,
        horizontalOverflow: surface.scrollWidth > surface.width, pageErrors: pageErrors.length });
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally { server.kill(); }
