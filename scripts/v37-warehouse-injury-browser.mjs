import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const port = 4212;
const base = `http://127.0.0.1:${port}/`;
const output = path.join(root, 'artifacts/v37/BROWSER_ACCEPTANCE');
const read = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const [mapFiles, cardFiles, quest] = await Promise.all([
  readdir(path.join(root, 'rpg/maps')), readdir(path.join(root, 'rpg/characters')),
  read('rpg/quests/warehouse-injury-1847.json'),
]);
const [mapRows, hostCards] = await Promise.all([
  Promise.all(mapFiles.filter(name => name.endsWith('.json')).map(name => read(`rpg/maps/${name}`))),
  Promise.all(cardFiles.filter(name => name.endsWith('.json')).map(name => read(`rpg/characters/${name}`))),
]);
const maps = Object.fromEntries(mapRows.map(map => [map.mapId, map]));

function fixture() {
  const state = game.createInitialState({ maps, hostCards, quests: [quest], startMapId: 'market-quay' });
  state.world.chapterId = 'V33_1847_PRINT'; state.world.date = '1847-06-01'; state.world.clockMinutes = 600;
  state.world.currentMapId = 'market-quay';
  state.hosts.porter_gavrila.mapId = 'market-quay'; state.hosts.porter_gavrila.position = { x: 11, y: 13 };
  state.hosts.porter_gavrila.needs.fatigue = 90;
  state.hosts.midwife_avdotya.mapId = 'market-quay'; state.hosts.midwife_avdotya.position = { x: 13, y: 13 };
  state.player.embodiment = 'porter_gavrila'; state.player.position = { x: 11, y: 13 };
  const advanced = game.advanceNpcWorld(state, 1, maps);
  assert.equal(advanced.world.livingEventStates.E12?.stage, 'INJURY', 'the scheduled possessed-work action creates E12');
  return game.saveGame(advanced);
}

await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env,
  CHANCERY_PORT: String(port), CHANCERY_STATIC_ONLY: '1', CHANCERY_STATIC_ROOT: path.resolve(root, 'dist-v33') },
stdio: ['ignore', 'ignore', 'pipe'] });
const serverErrors = [];
server.stderr.on('data', chunk => serverErrors.push(String(chunk)));
let ready = false;
for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
  try { ready = (await fetch(base)).ok; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
}
if (!ready) { server.kill(); throw new Error(`E12 static preview failed: ${serverErrors.join('')}`); }
const executablePath = process.env.V37_CHROME_EXECUTABLE_PATH;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const results = [];
try {
  for (const scenario of [
    { viewport: { width: 1440, height: 900 }, mobile: false, action: 'GAVRILA_INJURY_MIDWIFE_CARE' },
    { viewport: { width: 390, height: 844 }, mobile: true, action: 'GAVRILA_INJURY_REST_AT_QUAY' },
  ]) {
    const label = `${scenario.viewport.width}x${scenario.viewport.height}`;
    const context = await browser.newContext({ viewport: scenario.viewport, isMobile: scenario.mobile, hasTouch: scenario.mobile });
    const page = await context.newPage(), pageErrors = [], consoleErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('console', message => { if (['warning', 'error'].includes(message.type())) consoleErrors.push(message.text()); });
    await context.addInitScript(value => {
      localStorage.clear(); localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v33-tutorial-stage', 'done');
    }, fixture());
    await page.goto(`${base}#v37-e12-${label}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
    assert.match(await page.locator('#bodyname').innerText(), /가브릴라/);
    assert.match(await page.locator('#mapname').innerText(), /장터|부두/);
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth, body: document.querySelector('#bodyname')?.textContent,
      mission: document.querySelector('#mission-title')?.textContent, missionAction: document.querySelector('#mission-action')?.textContent }));
    assert.ok(dimensions.scrollWidth <= dimensions.width + 1, `E12 has no horizontal overflow at ${label}`);
    await page.screenshot({ path: path.join(output, `E12-injury-before-choice-${label}.png`) });
    await page.locator('#use').click();
    const choices = page.locator('#actions button');
    const selected = choices.filter({ hasText: scenario.action === 'GAVRILA_INJURY_MIDWIFE_CARE' ? '조산사에게 상처를 살피고 붕대를 부탁한다' : '자루를 내려놓고 쉬며 주인에게 알린다' });
    await selected.waitFor({ state: 'visible', timeout: 5000 });
    const visibleChoices = await choices.allTextContents();
    assert.equal(visibleChoices.length, 2, 'the event presents both distinct practical outcomes');
    assert.ok(visibleChoices.every(text => !text.includes('undefined')));
    await page.screenshot({ path: path.join(output, `E12-injury-choices-${label}.png`) });
    await selected.click();
    await page.locator('#save').click();
    const after = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('v33-rpg-save')).state;
      return { stage: state.world.livingEventStates.E12.stage, status: state.world.livingEventStates.E12.status,
        porterMoney: state.hosts.porter_gavrila.money.amount, caregiverMoney: state.hosts.midwife_avdotya.money.amount,
        health: state.hosts.porter_gavrila.healthState, quest: state.quests.WAREHOUSE_INJURY_1847.status,
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
    });
    assert.equal(after.stage, scenario.action === 'GAVRILA_INJURY_MIDWIFE_CARE' ? 'TREATED' : 'RESTED');
    assert.equal(after.status, 'RESOLVED');
    assert.equal(after.quest, 'resolved');
    if (scenario.action === 'GAVRILA_INJURY_MIDWIFE_CARE') {
      assert.equal(after.porterMoney, 14); assert.equal(after.caregiverMoney, 20);
      assert.equal(after.health.injury.care, 'MIDWIFE_TREATED');
    } else assert.equal(after.health.injury.care, 'RESTED_WITHOUT_TREATMENT');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expected => JSON.parse(localStorage.getItem('v33-rpg-save')).state.world.livingEventStates.E12.stage === expected,
      after.stage);
    assert.deepEqual(pageErrors, []); assert.deepEqual(consoleErrors, []); assert.deepEqual(serverErrors, []);
    await page.screenshot({ path: path.join(output, `E12-injury-after-reload-${label}.png`) });
    results.push({ viewport: scenario.viewport, action: scenario.action, visibleChoices, afterReloadStage: after.stage,
      moneyTransfer: scenario.action === 'GAVRILA_INJURY_MIDWIFE_CARE' ? { porter: after.porterMoney, midwife: after.caregiverMoney } : null,
      healthCare: after.health.injury.care, dimensions: after, pageErrors, consoleErrors });
    await context.close();
  }
} finally { await browser.close(); server.kill(); }
const report = { status: 'PASS', storyEvent: 'E12', trigger: 'possessed porter performs scheduled heavy sack unloading at high fatigue', branches: results };
await writeFile(path.join(output, 'E12_WAREHOUSE_INJURY_BROWSER_ACCEPTANCE.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
