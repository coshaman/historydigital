import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const root = process.cwd();
const require = createRequire(import.meta.url);
const engine = require('../rpg/engine/game-state.js');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const maps = Object.fromEntries(fs.readdirSync(path.join(root, 'rpg/maps')).filter(file => file.endsWith('.json')).map(file => [file.slice(0, -5), read(`rpg/maps/${file}`)]));
const cards = fs.readdirSync(path.join(root, 'rpg/characters')).filter(file => file.endsWith('.json')).map(file => read(`rpg/characters/${file}`));
const quests = fs.readdirSync(path.join(root, 'rpg/quests')).filter(file => file.endsWith('.json') && file !== 'campaign.json').map(file => read(`rpg/quests/${file}`));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4173/';
const out = path.join(root, 'artifacts/v33/INTERPERSONAL_DIALOGUE');
fs.mkdirSync(out, { recursive: true });
const report = { status: 'PASS', viewports: [] };

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    const start = engine.createInitialState({ maps, hostCards: cards, quests });
    start.world.currentMapId = 'printshop';
    start.player.position = { x: 10, y: 13 };
    start.hosts.seamstress_anna.mapId = 'printshop';
    start.hosts.seamstress_anna.position = { x: 10, y: 13 };
    start.hosts.printer_ekaterina.mapId = 'printshop';
    start.hosts.printer_ekaterina.position = { x: 11, y: 13 };
    const possessed = engine.possessHost(start, 'seamstress_anna', maps.printshop);
    assert.equal(possessed.ok, true);
    const rawSave = engine.saveGame(possessed.state);

    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(save => { localStorage.clear(); localStorage.setItem('v33-rpg-save', save); }, rawSave);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#talk').click();
    await page.getByLabel('대사 입력').fill('교정쇄를 원문과 대조하고 싶어요.');
    await page.getByRole('button', { name: '말하기' }).click();
    await page.getByText('어느 줄을 말하는 거죠? 원문이랑 나란히 놓고 봐야 알겠어요.').waitFor();
    const portrait = await page.locator('#dialogue-portrait').evaluate(image => ({ src: image.getAttribute('src'), alt: image.alt, width: image.naturalWidth, height: image.naturalHeight, visible: image.getBoundingClientRect().width > 0 }));
    assert.match(portrait.src, /portrait-printer_ekaterina\.png$/);
    assert.equal(portrait.width, 64);
    assert.equal(portrait.height, 64);
    assert.equal(portrait.visible, true);
    const layout = await page.evaluate(() => {
      const input = document.querySelector('.dialogue-input').getBoundingClientRect();
      const pad = document.querySelector('.touch-pad').getBoundingClientRect();
      return { documentWidth: document.documentElement.scrollWidth, input: { top: input.top, bottom: input.bottom, visible: input.width > 0 && input.height > 0 && input.top >= 0 && input.bottom <= innerHeight }, inputOverlapsControls: input.left < pad.right && input.right > pad.left && input.top < pad.bottom && input.bottom > pad.top };
    });
    assert.ok(layout.input.visible, `dialogue input is clipped at ${viewport.width}`);
    assert.equal(layout.inputOverlapsControls, false, `dialogue input overlaps movement controls at ${viewport.width}`);
    assert.equal(layout.documentWidth, viewport.width, `horizontal overflow at ${viewport.width}`);
    assert.equal(await page.locator('#actions > button').count(), 4);
    await page.screenshot({ path: path.join(out, `anna-speaks-with-ekaterina-${viewport.width}.png`) });
    await page.locator('#save').click();
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state);
    const event = state.ledger.at(-1);
    assert.equal(event.eventType, 'DIALOGUE_TURN');
    assert.equal(event.hostId, 'printer_ekaterina');
    assert.equal(event.interlocutorHostId, 'seamstress_anna');
    assert.equal(state.quests.PRINTSHOP_PROOF_1847.status, 'open');
    assert.equal(errors.length, 0, errors.join('\n'));
    report.viewports.push({ viewport, embodiedHost: 'seamstress_anna', speaker: 'printer_ekaterina', portrait, response: 'authored offline fallback', questChangedByConversation: false, ...layout, pageErrors: errors });
    await page.close();
  }
  fs.writeFileSync(path.join(out, 'BROWSER_SMOKE.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
