import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url); require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const maps = Object.fromEntries(fs.readdirSync('rpg/maps').filter(file => file.endsWith('.json'))
  .map(file => { const map = read(path.join('rpg/maps', file)); return [map.mapId, map]; }));
const cards = fs.readdirSync('rpg/characters').filter(file => file.endsWith('.json'))
  .map(file => read(path.join('rpg/characters', file)));
const quests = ['funeral-costs-1847', 'funeral-debt-repayment-1847', 'warehouse-injury-1847']
  .map(id => read(path.join('rpg/quests', `${id}.json`)));
const quest = quests[0], output = path.join('artifacts', 'v37', 'BROWSER_ACCEPTANCE');
fs.mkdirSync(output, { recursive: true });
const port = 4198;
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: path.resolve('dist-v33') }, stdio: ['ignore', 'pipe', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
try {
  const deadline = Date.now() + 10000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch {}
    if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`Preview server did not start: ${serverErrors.join('')}`);
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
      const page = await context.newPage(), pageErrors = [];
      page.on('pageerror', error => pageErrors.push(String(error)));
      const state = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'communal-room' });
      state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 700;
      state.hosts.courier_pavel.mapId = 'communal-room'; state.hosts.courier_pavel.position = { x: 11, y: 10 };
      state.hosts.innkeeper_irina.mapId = 'communal-room'; state.hosts.innkeeper_irina.position = { x: 12, y: 10 };
      state.player.position = { x: 11, y: 10 };
      state.world.livingEventStates.E28 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E28',
        status: 'ACTIVE', stage: 'FUNERAL_COSTS_DUE', trigger: 'fictional_relative_death_after_untreated_critical_injury',
        startedAtMinute: 700, deadlineMinute: 1060, deceasedHostId: 'porter_gavrila', organizerHostId: 'courier_pavel',
        lenderHostId: 'innkeeper_irina', actorHostIds: ['courier_pavel', 'innkeeper_irina'], witnessHostIds: [],
        venueMapId: 'communal-room', scenePosition: { x: 11, y: 10 }, cost: 4, unit: 'kopeks',
        occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
        valueStatus: 'fictional_gameplay_balance' };
      const possessed = game.possessHost(state, 'courier_pavel', maps['communal-room']);
      if (!possessed.ok) throw new Error(`Could not possess Pavel: ${possessed.reason}`);
      await context.addInitScript(saved => {
        localStorage.setItem('v33-rpg-save', saved); localStorage.setItem('v34-tutorial-stage', 'done');
      }, game.saveGame(possessed.state));
      await page.goto(`http://127.0.0.1:${port}/index.html#v37-funeral-costs-${viewport.width}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('파벨'));
      await page.keyboard.press('e');
      const pay = page.getByRole('button', { name: '내 돈으로 장례 비용을 낸다' });
      await pay.waitFor({ state: 'visible' });
      const surface = await page.evaluate(() => ({
        choices: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        choiceRects: [...document.querySelectorAll('#actions button')].map(button => {
          const rect = button.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom };
        }),
        missionHidden: document.querySelector('#mission-tracker').hidden,
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.clientHeight, bodyHeight: document.body.scrollHeight,
      }));
      if (surface.choices.length !== 2
        || !surface.choices[0].startsWith('내 돈으로 장례 비용을 낸다')
        || !surface.choices[1].startsWith('이리나에게 장례비를 빌린다')
        || !surface.missionHidden
        || surface.choiceRects.some(rect => rect.top < 0 || rect.bottom > viewport.height)
        || surface.scrollWidth > surface.width + 1 || surface.bodyHeight > surface.height + 1)
        throw new Error(`Funeral choice UI overflowed or hid choices: ${JSON.stringify(surface)}`);
      await page.screenshot({ path: path.join(output, `funeral-costs-${viewport.width}x${viewport.height}.png`) });
      const before = await page.locator('#record').textContent();
      await pay.click();
      await page.waitForFunction(prior => document.querySelector('#record')?.textContent !== prior, before);
      const saved = game.loadGame(await page.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests });
      if (saved.world.livingEventStates.E28.stage !== 'FUNERAL_COSTS_PAID'
        || saved.hosts.courier_pavel.money.amount !== possessed.state.hosts.courier_pavel.money.amount - 4
        || pageErrors.length || serverErrors.length) throw new Error(`Funeral payment did not save cleanly: ${JSON.stringify({
          stage: saved.world.livingEventStates.E28.stage, pageErrors, serverErrors,
        })}`);
      results.push({ viewport, choices: surface.choices.length, savedStage: saved.world.livingEventStates.E28.stage,
        horizontalOverflow: surface.scrollWidth > surface.width, pageErrors: pageErrors.length });

      const debtState = game.createInitialState({ maps, hostCards: cards, quests, startMapId: 'inn-interior' });
      debtState.world.chapterId = 'V33_1847_PRINT'; debtState.world.date = '1847-06-01'; debtState.world.clockMinutes = 700;
      debtState.hosts.courier_pavel.mapId = 'inn-interior'; debtState.hosts.courier_pavel.position = { x: 12, y: 10 };
      debtState.hosts.innkeeper_irina.mapId = 'inn-interior'; debtState.hosts.innkeeper_irina.position = { x: 14, y: 10 };
      debtState.hosts.innkeeper_irina.money.amount -= 4;
      debtState.world.livingEventStates.E28 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E28',
        status: 'RESOLVED', stage: 'FUNERAL_COSTS_ON_CREDIT', trigger: 'fictional_relative_death_after_untreated_critical_injury',
        startedAtMinute: 600, deadlineMinute: 960, resolvedAtMinute: 605, resolutionActionId: 'E28_IRINA_ADVANCES_COSTS',
        deceasedHostId: 'porter_gavrila', organizerHostId: 'courier_pavel', lenderHostId: 'innkeeper_irina',
        actorHostIds: ['courier_pavel', 'innkeeper_irina'], witnessHostIds: [], venueMapId: 'communal-room',
        scenePosition: { x: 11, y: 10 }, cost: 4, unit: 'kopeks',
        debt: { debtorHostId: 'courier_pavel', creditorHostId: 'innkeeper_irina', amount: 4, unit: 'kopeks',
          openedAtMinute: 605, status: 'OUTSTANDING', amountRepaid: 0, remainingAmount: 4,
          dueAtMinute: 1325, nextPaymentAtMinute: 1325, causeId: 'E28_FUNERAL_COSTS' },
        occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
        valueStatus: 'fictional_gameplay_balance' };
      debtState.player.position = { ...debtState.hosts.courier_pavel.position };
      const debtPossession = game.possessHost(debtState, 'courier_pavel', maps['inn-interior']);
      if (!debtPossession.ok) throw new Error('Could not possess Pavel for debt repayment: ' + debtPossession.reason);
      const debtStorage = await context.newPage();
      await debtStorage.addInitScript(saved => {
        localStorage.setItem('v33-rpg-save', saved); localStorage.setItem('v34-tutorial-stage', 'done');
      }, game.saveGame(debtPossession.state));
      const repaymentPageErrors = [];
      debtStorage.on('pageerror', error => repaymentPageErrors.push(String(error)));
      await debtStorage.goto('http://127.0.0.1:' + port + '/index.html#v37-debt-repayment-' + viewport.width, { waitUntil: 'domcontentloaded' });
      await debtStorage.waitForFunction(() => document.querySelector('#bodyname')?.textContent?.includes('파벨'));
      await debtStorage.keyboard.press('e');
      const repay = debtStorage.getByRole('button', { name: '2코페이카를 갚는다' });
      await repay.waitFor({ state: 'visible' });
      const repaymentSurface = await debtStorage.evaluate(() => ({
        labels: [...document.querySelectorAll('#actions button')].map(button => button.innerText),
        rects: [...document.querySelectorAll('#actions button')].map(button => { const r=button.getBoundingClientRect(); return { top:r.top,bottom:r.bottom }; }),
        missionHidden: document.querySelector('#mission-tracker').hidden,
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.clientHeight, bodyHeight: document.body.scrollHeight,
      }));
      if (repaymentSurface.labels.length !== 1 || !repaymentSurface.labels[0].startsWith('2코페이카를 갚는다')
        || !repaymentSurface.missionHidden || repaymentSurface.rects.some(rect => rect.top < 0 || rect.bottom > viewport.height)
        || repaymentSurface.scrollWidth > repaymentSurface.width + 1 || repaymentSurface.bodyHeight > repaymentSurface.height + 1)
        throw new Error('Funeral debt repayment UI overflowed or hid its choice: ' + JSON.stringify(repaymentSurface));
      await debtStorage.screenshot({ path: path.join(output, 'funeral-debt-repayment-' + viewport.width + 'x' + viewport.height + '.png') });
      let currentDebtState = debtPossession.state;
      for (let installment = 1; installment <= 2; installment += 1) {
        await debtStorage.getByRole('button', { name: '2코페이카를 갚는다' }).click();
        await debtStorage.waitForFunction(amount => {
          try {
            const state = JSON.parse(localStorage.getItem('v33-rpg-save'))?.state;
            return state?.world?.livingEventStates?.E28?.debt?.amountRepaid === amount;
          } catch { return false; }
        }, installment * 2);
        currentDebtState = game.loadGame(await debtStorage.evaluate(() => localStorage.getItem('v33-rpg-save')), { maps, hostCards: cards, quests });
        if (currentDebtState.world.livingEventStates.E28.debt.amountRepaid !== installment * 2)
          throw new Error('Funeral debt installment did not persist: ' + installment);
        if (installment === 1) await debtStorage.keyboard.press('e');
      }
      if (currentDebtState.world.livingEventStates.E28.debt.status !== 'SETTLED'
        || currentDebtState.hosts.courier_pavel.money.amount !== debtPossession.state.hosts.courier_pavel.money.amount - 4
        || currentDebtState.hosts.innkeeper_irina.money.amount !== debtPossession.state.hosts.innkeeper_irina.money.amount + 4
        || repaymentPageErrors.length) throw new Error('Funeral debt repayment failed: ' + JSON.stringify({
          status: currentDebtState.world.livingEventStates.E28.debt.status, repaymentPageErrors,
        }));
      results.push({ viewport, flow: 'funeral-debt-repayment', installments: 2,
        debtStatus: currentDebtState.world.livingEventStates.E28.debt.status,
        horizontalOverflow: repaymentSurface.scrollWidth > repaymentSurface.width,
        pageErrors: repaymentPageErrors.length });
      await debtStorage.close();
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally { server.kill(); }
