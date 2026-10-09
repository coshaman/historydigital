import fs from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/?main20=1&v40=1';
const out = 'artifacts/v40-browser';
fs.mkdirSync(out, { recursive: true });
const viewports = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-1366x768', width: 1366, height: 768 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-360x800', width: 360, height: 800 }
];

const waitFor = (page, phase) => page.waitForFunction((wanted) => window.__main20?.getState?.().phase === wanted, phase);
async function clickNext(page) { await page.locator('#choiceArea button').first().click(); }
async function dialogue(page) { return page.evaluate(() => document.querySelector('#dialogue')?.textContent || ''); }
async function advanceUntil(page, phase) {
  for (let i = 0; i < 20; i += 1) {
    if ((await page.evaluate(() => window.__main20?.getState?.().phase)) === phase) return;
    await clickNext(page);
  }
  throw new Error(`could not reach phase ${phase}`);
}
async function screenshot(page, name) { try { await page.screenshot({ path: `${out}/${name}.png`, fullPage: false, animations: 'disabled', timeout: 8000 }); return 'normal'; } catch { await page.evaluate(() => document.querySelectorAll('canvas').forEach((canvas) => { canvas.dataset.v40Display = canvas.style.display; canvas.style.display = 'none'; })); await page.screenshot({ path: `${out}/${name}.png`, fullPage: false, animations: 'disabled', timeout: 8000 }); await page.evaluate(() => document.querySelectorAll('canvas').forEach((canvas) => { canvas.style.display = canvas.dataset.v40Display || ''; })); return 'canvas-fallback'; } }

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__main20));
    await page.waitForFunction(() => Boolean(window.__windowController));
    const headerExpanded = await page.evaluate(() => !document.body.classList.contains('scene-header-collapsed'));
    await screenshot(page, `${viewport.name}-transition-expanded`);
    await page.waitForTimeout(2400);
    await screenshot(page, `${viewport.name}-transition-collapsed`);
    const headerCollapsed = await page.evaluate(() => document.body.classList.contains('scene-header-collapsed'));

    const comprehension = [await dialogue(page)];
    while ((await page.evaluate(() => window.__main20.getState().phase)) === 'onboarding') { await clickNext(page); comprehension.push(await dialogue(page)); }
    for (let i = 0; i < 12; i += 1) {
      comprehension.push(await dialogue(page));
      if ((await page.evaluate(() => window.__main20.getState().phase)) !== 'intro') break;
      await clickNext(page);
    }
    const beforeReadingChoiceCount = await page.locator('#choiceArea .main20-choice-card').count();
    await waitFor(page, 'reading');
    await screenshot(page, `${viewport.name}-reader`);
    const excerptCount = await page.locator('.main20-excerpt').count();
    for (let i = 0; i < excerptCount; i += 1) { const excerpt = page.locator('.main20-excerpt:not(.is-read)').first(); await excerpt.evaluate((node) => { const columns = document.querySelector('#paperColumns'); columns.scrollTop = node.offsetTop - 12; }); await page.waitForTimeout(80); await excerpt.click({ force: true }); await page.waitForTimeout(80); }
    console.log(viewport.name, 'read state', await page.evaluate(() => window.__main20.getState().readExcerptIdsByScene), 'excerptCount', excerptCount);
    await page.getByRole('button', { name: '자료 토론으로 간다' }).click();
    await waitFor(page, 'source_discussion');
    await screenshot(page, `${viewport.name}-discussion`);
    const discussionLines = [];
    while ((await page.evaluate(() => window.__main20.getState().phase)) === 'source_discussion') {
      discussionLines.push(await dialogue(page));
      await clickNext(page);
    }
    await waitFor(page, 'decision');
    await screenshot(page, `${viewport.name}-decision`);
    const labels = await page.locator('.main20-choice-label').allTextContents();
    const hints = await page.locator('.main20-choice-hint').allTextContents();
    await page.locator('.main20-choice-card').first().click();
    await waitFor(page, 'reaction');
    const playerLine = await dialogue(page);
    await screenshot(page, `${viewport.name}-player-line`);
    await clickNext(page);
    const npcSpeaker = await page.locator('#speaker').textContent();
    const npcLine = await dialogue(page);
    await screenshot(page, `${viewport.name}-npc-reaction`);
    while ((await page.evaluate(() => window.__main20.getState().phase)) === 'reaction') await clickNext(page);
    const nextState = await page.evaluate(() => window.__main20.getState());
    const nextScene = nextState.sceneIndex === 1 && nextState.phase === 'intro';
    const nextHeaderExpanded = await page.evaluate(() => !document.body.classList.contains('scene-header-collapsed'));
    await screenshot(page, `${viewport.name}-next-scene`);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__main20));
    await advanceUntil(page, 'intro');
    for (let i = 0; i < 12; i += 1) {
      if ((await page.evaluate(() => window.__main20.getState().phase)) !== 'intro') break;
      await clickNext(page);
    }
    await waitFor(page, 'reading');
    await page.locator('#petersburgWindow').click();
    await page.waitForFunction(() => document.body.classList.contains('window-view'));
    const windowOpen = await page.evaluate(() => document.body.classList.contains('window-view'));
    await page.locator('#petersburgWindow').click();
    await page.waitForFunction(() => !document.body.classList.contains('window-view'));
    const windowClosed = await page.evaluate(() => !document.body.classList.contains('window-view'));
    const imageIssues = await page.evaluate(() => Array.from(document.images).filter((img) => getComputedStyle(img).display !== 'none' && (!img.complete || img.naturalWidth === 0)).map((img) => img.getAttribute('src') || img.alt));
    const comprehensionText = comprehension.join(' ');
    const discussionText = discussionLines.join(' ');
    const environmentWarnings = errors.filter((error) => error.includes('ERR_NETWORK_ACCESS_DENIED') || error.includes('Local Three.js desk runtime failed') || error.includes('Local Three.js courier runtime failed'));
    const runtimeErrors = errors.filter((error) => !environmentWarnings.includes(error));
    results.push({ viewport: viewport.name, headerExpanded, headerCollapsed, nextHeaderExpanded, beforeReadingChoiceCount, excerptCount, labels, hints, playerLine, npcSpeaker, npcLine, nextScene, windowOpen, windowClosed, imageIssues, comprehension: { pushkin: comprehensionText.includes('푸시킨'), twoObituaries: comprehensionText.includes('부고') && comprehensionText.includes('두 장'), noLaterCause: comprehensionText.includes('사망 원인') || comprehensionText.includes('조사 편지'), clerkRole: comprehensionText.includes('허구 서기'), discussionPresent: discussionText.length > 20 }, errors: runtimeErrors, environmentWarnings });
    await context.close();
  }
} finally { await browser.close(); }

const pass = results.length === viewports.length && results.every((item) => item.errors.length === 0 && item.headerExpanded && item.headerCollapsed && item.nextHeaderExpanded && item.beforeReadingChoiceCount === 0 && item.excerptCount > 0 && item.labels.length >= 3 && item.labels.every((label) => label.length <= 28) && item.hints.length === item.labels.length && item.playerLine && item.npcSpeaker !== '서기관' && item.nextScene && item.windowOpen && item.windowClosed && item.imageIssues.length === 0 && Object.values(item.comprehension).every(Boolean));
const report = { schemaVersion: 'V40-BROWSER-FLOW-AUDIT-1', status: pass ? 'PASS' : 'FAIL', checkedAt: new Date().toISOString(), results };
fs.writeFileSync(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!pass) process.exitCode = 1;
